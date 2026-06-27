/**
 * Claude call for the AI assistant (System 4).
 *
 * Uses the Anthropic SDK with `claude-sonnet-4-6` and STRUCTURED OUTPUTS
 * (output_config.format) so the JSON contract is guaranteed by the API rather
 * than fragile prompt-parsing. Without `ANTHROPIC_API_KEY` — or on any error —
 * it returns a deterministic, grounded fallback built from the RAG shortlist, so
 * the feature degrades gracefully (same pattern as Midtrans/email).
 */

import Anthropic from '@anthropic-ai/sdk';
import { logEvent } from '@/lib/logger';
import {
  SYSTEM_PROMPT,
  RECOMMENDATION_SCHEMA,
  buildUserTurn,
  fallbackRecommendation,
  type ChatRecommendation,
} from './prompt';
import type { SearchedProvider } from './search';

const MODEL = 'claude-sonnet-4-6';
const apiKey = process.env.ANTHROPIC_API_KEY;

/** Whether a real Anthropic key is present. */
export const isAIConfigured = Boolean(apiKey);

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface RecommendationResult {
  recommendation: ChatRecommendation;
  /** True when produced by the deterministic fallback (no LLM call). */
  mock: boolean;
}

export async function generateRecommendation(input: {
  query: string;
  providers: SearchedProvider[];
  history?: ChatTurn[];
}): Promise<RecommendationResult> {
  const { query, providers, history = [] } = input;

  if (!isAIConfigured) {
    return { recommendation: fallbackRecommendation(query, providers), mock: true };
  }

  try {
    const client = new Anthropic({ apiKey: apiKey! });
    const messages: Anthropic.MessageParam[] = [
      // Cap history to the last 6 turns to keep token cost predictable.
      ...history.slice(-6).map((t) => ({ role: t.role, content: t.content })),
      { role: 'user', content: buildUserTurn(query, providers) },
    ];

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1536,
      thinking: { type: 'disabled' }, // snappy chat; structured output does the shaping
      system: SYSTEM_PROMPT,
      messages,
      output_config: { format: { type: 'json_schema', schema: RECOMMENDATION_SCHEMA } },
    });

    const block = res.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') throw new Error('no text content');
    const parsed = JSON.parse(block.text) as ChatRecommendation;
    if (typeof parsed.pesan !== 'string' || !Array.isArray(parsed.rekomendasi)) {
      throw new Error('unexpected shape');
    }
    logEvent('ai.chat', { providers: providers.length, recos: parsed.rekomendasi.length });
    return { recommendation: parsed, mock: false };
  } catch (err) {
    logEvent('ai.chat.failed', { error: String(err) }, 'warn');
    return { recommendation: fallbackRecommendation(query, providers), mock: false };
  }
}
