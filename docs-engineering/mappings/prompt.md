# Mapping: src/lib/ai/prompt.ts

Prompt construction and the output contract for the AI assistant. The system
prompt holds the stable persona/rules; the per-request provider shortlist is
injected into the user turn. The response shape is enforced structurally by
`RECOMMENDATION_SCHEMA` (OpenAI structured outputs), so replies are never
hand-parsed — the schema is the source of truth.

## Types

- `ChatRecommendationItem` — one recommended provider row: `{ id, nama, layanan, estimasi_harga, rating, alasan, highlight }`.
- `ChatRecommendation` — a full assistant turn: `{ pesan, rekomendasi[], catatan, cta }`.

## Constant: RECOMMENDATION_SCHEMA

- **Purpose:** JSON Schema passed to OpenAI structured outputs so the model returns exactly the four-field shape.
- **Notes:** `additionalProperties: false`; all four fields required. `rekomendasi` may be an empty array.

## Constant: SYSTEM_PROMPT

- **Purpose:** The assistant persona and answering rules.
- **Design (diagnose-first, 2026-07-01):** Rewritten from "recommend up to 3 providers immediately" to a conversational, diagnose-first flow — short chunked lines, ask ONE follow-up when the request is vague, keep `rekomendasi` empty while gathering context, then suggest providers naturally and non-pushily.
- **Grounding rule:** Use only the provider `id`s present in the injected data; never invent providers, prices, or ratings. Empty data → say so honestly and invite loosening location/budget.

## Function: buildUserTurn

- **Purpose:** Render the per-request user message = provider context block + the user's question.
- **Input:** `query: string`, `providers: SearchedProvider[]`.
- **Output:** `string`.
- **Logic:** For each provider, emit an id-tagged block (name, services, area, rating, daily rate, completed jobs, optional new-badge/bio). Empty providers → a "no match" marker so the model can respond honestly.
- **Reasoning:** The stable persona stays in the system prompt; only the volatile shortlist goes in the user turn — clearer separation and better prompt caching.

## Function: fallbackRecommendation

- **Purpose:** Deterministic, grounded result used when OpenAI is unavailable (no `OPENAI_API_KEY`, or an error).
- **Input:** `query`, `providers`.
- **Output:** `ChatRecommendation`.
- **Logic:** Empty providers → friendly "loosen criteria" message with empty `rekomendasi`; otherwise map the top 3 (search order) to grounded rows. Mirrors the Midtrans/email no-op pattern: the feature degrades instead of breaking.

## Consumers

`src/lib/ai/chat.ts` (`generateRecommendation`), and the API route through it.
