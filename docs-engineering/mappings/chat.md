# Mapping: src/lib/ai/chat.ts

Legacy recommendation helper for the assistant UI migration path. It calls the
OpenAI Responses API through `src/lib/ai/openai.ts` with structured outputs, so
the JSON contract is validated by the API response format and then checked again
by local shape guards.

Without `OPENAI_API_KEY`, or when a model call fails, the helper degrades to the
deterministic grounded fallback from `src/lib/ai/prompt.ts`.

## Constants

- Default model is `gpt-5.6-sol`, overridable with `GEGARAP_AI_MODEL`.
- `isAIConfigured()` returns true when `OPENAI_API_KEY` is set.

## Function: generateRecommendation

Input:

```ts
{
  query: string;
  providers: SearchedProvider[];
  history?: { role: 'user' | 'assistant'; content: string }[];
}
```

Flow:

1. If OpenAI is not configured, return `fallbackRecommendation(...), mock: true`.
2. Build a grounded user turn with the provider shortlist.
3. Call OpenAI Responses with `RECOMMENDATION_SCHEMA`.
4. Validate the minimal legacy shape.
5. On failure, log and return deterministic fallback.
