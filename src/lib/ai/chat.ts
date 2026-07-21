import { createStructuredResponse, DEFAULT_OPENAI_MODEL, isOpenAIConfigured } from '@/lib/ai/openai';
import { logEvent } from '@/lib/logger';
import {
  SYSTEM_PROMPT,
  RECOMMENDATION_SCHEMA,
  buildUserTurn,
  fallbackRecommendation,
  type ChatRecommendation,
} from './prompt';
import type { SearchedProvider } from './search';

export const isAIConfigured = isOpenAIConfigured;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface RecommendationResult {
  recommendation: ChatRecommendation;
  mock: boolean;
}

export async function generateRecommendation(input: {
  query: string;
  providers: SearchedProvider[];
  history?: ChatTurn[];
}): Promise<RecommendationResult> {
  const { query, providers, history = [] } = input;

  if (!isAIConfigured()) {
    return { recommendation: fallbackRecommendation(query, providers), mock: true };
  }

  try {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...history.slice(-6).map((t) => ({ role: t.role, content: t.content })),
      { role: 'user', content: buildUserTurn(query, providers) },
    ];

    const parsed = await createStructuredResponse<ChatRecommendation>({
      model: process.env.GEGARAP_AI_MODEL || DEFAULT_OPENAI_MODEL,
      maxOutputTokens: 1536,
      system: SYSTEM_PROMPT,
      input: messages,
      schemaName: 'gegarap_recommendation',
      schemaDescription: 'Legacy recommendation shape for the Gegarap chat UI',
      schema: RECOMMENDATION_SCHEMA,
    });

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
