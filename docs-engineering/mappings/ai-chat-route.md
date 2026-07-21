# Mapping: src/app/api/ai/chat/route.ts

HTTP entrypoint for the Gegarap assistant. The route stays responsible for
transport concerns: validation, rate limiting, provider lookup, cache,
conversation persistence, and response envelope.

## Constants

- `MAX_MESSAGE_LEN = 500`
- `CACHE_TTL_SECONDS = 300`

## Function: sanitize

- Input: unknown message payload.
- Output: clean `string | null`.
- Behavior: removes control characters, collapses whitespace, trims, limits to
  500 characters, and rejects empty messages.

## Function: asHistory

- Input: unknown client history payload.
- Output: recent `{ role, content }[]` turns.
- Behavior: accepts only `user` and `assistant` roles, caps each message at
  2,000 characters, and keeps the last 6 turns.

## Function: POST

- Input body: `{ message, history?, sessionId? }`
- Success response: `ok({ ...assistantResponse, providers, sessionId, mock })`
- Error response: `fail(message, status)`

## Flow

1. Parse JSON body.
2. Sanitize `message`.
3. Resolve Firebase session for optional `userId`.
4. Rate limit by authenticated user id or client IP.
5. Extract filters and normalize conversation history.
6. Cache by message, filters, and history.
7. On cache miss, search providers and call `processChat`.
8. If OpenAI is unavailable or the model path fails, use deterministic fallback recommendation.
9. Persist the latest user and assistant turns to `ChatSession`.
10. Strip `debug` in production.
11. Return the assistant payload plus UI metadata.

## Response Contract

The assistant response includes:

- `message`
- `category`
- `riskLevel`
- `confidenceLevel`
- `bookingEligible`
- `suggestedNextAction`

Legacy UI fields are still returned during the chat UI migration:

- `pesan`
- `rekomendasi`
- `catatan`
- `cta`

The route also returns `providers`, `sessionId`, and `mock`. `mock` is true when
the cached payload source is fallback rather than OpenAI.

## Safety

`processChat` runs the safety classifier before model calls. Critical danger
cases return a deterministic safety-first response and never include provider
recommendations.

## Logging

The route logs operational failures with stable event names only. It does not
log raw prompts, full conversation history, API keys, or provider secrets.
