import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { ok, fail } from '@/lib/api';
import { getSession } from '@/lib/firebase/session';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { cacheGet, cacheSet } from '@/lib/cache';
import { extractFilters } from '@/lib/ai/extract';
import { searchProviders, type SearchedProvider } from '@/lib/ai/search';
import { logEvent } from '@/lib/logger';

import { processChat, AssistantResponse } from '@/ai/gegarap-assistant';
import { runSafetyClassifier } from '@/ai/gegarap-assistant/safety-classifier';
import { fallbackRecommendation } from '@/lib/ai/prompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LEN = 500;
const CACHE_TTL_SECONDS = 300;

interface ChatPayload {
  recommendation: AssistantResponse;
  providers: SearchedProvider[];
}

function sanitize(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let clean = '';
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    clean += code < 0x20 || code === 0x7f ? ' ' : ch;
  }
  clean = clean.replace(/\s+/g, ' ').trim().slice(0, MAX_MESSAGE_LEN);
  return clean.length > 0 ? clean : null;
}

function asHistory(raw: unknown): { role: 'user' | 'assistant'; content: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is { role: 'user' | 'assistant'; content: string } =>
        !!m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.length <= 2000
    )
    .slice(-6);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return fail('Body permintaan tidak valid.', 400);

    const message = sanitize(body.message);
    if (!message) return fail('Pesan tidak boleh kosong.', 400);

    const session = await getSession();
    const userId = session?.user?.id ?? null;

    const sessionId: string | undefined =
      typeof body.sessionId === 'string' && body.sessionId.length <= 64 ? body.sessionId : undefined;
    const limiterKey = `ai:chat:${sessionId ?? clientIp(req)}`;
    const limit = await rateLimit(limiterKey, { windowMs: 60_000, max: 20 });
    if (!limit.ok) {
      return fail('Terlalu banyak permintaan. Coba lagi sebentar lagi.', 429);
    }

    const filters = extractFilters(message);
    const history = asHistory(body.history);

    const cacheKey = `ai:chat:${createHash('sha256')
      .update(`${message}|${JSON.stringify(filters)}|${JSON.stringify(history)}`)
      .digest('hex')}`;
    let payload = await cacheGet<ChatPayload>(cacheKey);
    let mock = false;

    if (!payload) {
      const safety = runSafetyClassifier(message);
      const providers = safety.riskLevel === 'critical' ? [] : await searchProviders(message, filters);

      let recommendation: AssistantResponse;
      try {
        recommendation = await processChat({
          query: message,
          history,
          providers
        });
      } catch (e) {
        logEvent('ai.chat.engine_failed', { error: String(e) }, 'warn');
        mock = true;
        const legacy = fallbackRecommendation(message, providers);
        recommendation = {
          message: legacy.pesan,
          category: 'Lainnya',
          riskLevel: 'low',
          confidenceLevel: 'low',
          bookingEligible: legacy.rekomendasi.length > 0,
          suggestedNextAction: '',
          pesan: legacy.pesan,
          rekomendasi: legacy.rekomendasi,
          catatan: legacy.catatan,
          cta: legacy.cta
        };
      }

      payload = { recommendation, providers };
      await cacheSet(cacheKey, payload, CACHE_TTL_SECONDS);
    }

    const turns = [
      { role: 'user', content: message },
      { role: 'assistant', content: payload.recommendation.message },
    ];
    let resolvedSessionId = sessionId;
    try {
      if (sessionId) {
        const existing = await prisma.chatSession.findUnique({
          where: { id: sessionId },
          select: { messages: true, userId: true },
        });
        if (existing && existing.userId && existing.userId !== userId) {
          resolvedSessionId = undefined;
        } else {
          const prev = Array.isArray(existing?.messages) ? (existing!.messages as unknown[]) : [];
          const next = [...prev, ...turns].slice(-50) as Prisma.InputJsonValue;
          await prisma.chatSession.upsert({
            where: { id: sessionId },
            update: { messages: next },
            create: { id: sessionId, userId, messages: next },
          });
        }
      }
      if (!resolvedSessionId) {
        const created = await prisma.chatSession.create({
          data: { userId, messages: turns as Prisma.InputJsonValue },
        });
        resolvedSessionId = created.id;
      }
    } catch (e) {
      logEvent('ai.chat.persist_failed', { error: String(e) }, 'warn');
    }

    if (process.env.NODE_ENV === 'production' && payload.recommendation.debug) {
      delete payload.recommendation.debug;
    }

    return ok({
      ...payload.recommendation,
      providers: payload.providers,
      sessionId: resolvedSessionId,
      mock,
    });
  } catch (err) {
    logEvent('ai.chat.error', { error: String(err) }, 'error');
    return fail('Terjadi kesalahan pada asisten. Silakan coba lagi.', 500);
  }
}
