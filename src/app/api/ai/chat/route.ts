import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { ok, fail } from '@/lib/api';
import { getSession } from '@/lib/firebase/session';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { cacheGet, cacheSet } from '@/lib/cache';
import { extractFilters } from '@/lib/ai/extract';
import { searchProviders, type SearchedProvider } from '@/lib/ai/search';
import { generateRecommendation, type ChatTurn } from '@/lib/ai/chat';
import type { ChatRecommendation } from '@/lib/ai/prompt';
import { logEvent } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LEN = 500;
const CACHE_TTL_SECONDS = 300;

interface ChatPayload {
  recommendation: ChatRecommendation;
  providers: SearchedProvider[];
}

/** Drop control chars, collapse whitespace, and cap length. */
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

function asHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is ChatTurn =>
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

    // Rate limit per session id (or IP for anonymous): 20 requests / minute.
    const sessionId: string | undefined =
      typeof body.sessionId === 'string' && body.sessionId.length <= 64 ? body.sessionId : undefined;
    const limiterKey = `ai:chat:${sessionId ?? clientIp(req)}`;
    const limit = await rateLimit(limiterKey, { windowMs: 60_000, max: 20 });
    if (!limit.ok) {
      return fail('Terlalu banyak permintaan. Coba lagi sebentar lagi.', 429);
    }

    const filters = extractFilters(message);

    // Cache identical (message + filters) responses for 5 minutes.
    const cacheKey = `ai:chat:${createHash('sha256')
      .update(`${message}|${JSON.stringify(filters)}`)
      .digest('hex')}`;
    let payload = await cacheGet<ChatPayload>(cacheKey);
    let mock = false;

    if (!payload) {
      const providers = await searchProviders(message, filters);
      const { recommendation, mock: m } = await generateRecommendation({
        query: message,
        providers,
        history: asHistory(body.history),
      });
      mock = m;
      payload = { recommendation, providers };
      await cacheSet(cacheKey, payload, CACHE_TTL_SECONDS);
    }

    // Persist the conversation (anonymous allowed). Never let a client append to
    // a session owned by a different user.
    const turns = [
      { role: 'user', content: message },
      { role: 'assistant', content: payload.recommendation.pesan },
    ];
    let resolvedSessionId = sessionId;
    try {
      if (sessionId) {
        const existing = await prisma.chatSession.findUnique({
          where: { id: sessionId },
          select: { messages: true, userId: true },
        });
        if (existing && existing.userId && existing.userId !== userId) {
          resolvedSessionId = undefined; // not yours → start a fresh session
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
      // Persistence is best-effort — never fail the chat over a write hiccup.
      logEvent('ai.chat.persist_failed', { error: String(e) }, 'warn');
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
