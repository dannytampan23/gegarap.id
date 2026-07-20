# Module: AI Assistant

A consultation-first home-services assistant for Gegarap.id. It uses a lite LLM
with compact keyword RAG, diagnoses user problems before recommending technicians,
blocks unsafe DIY guidance, and only surfaces booking actions when the handoff
logic says the user is ready.

## Purpose

Turn a free-text home issue into a short, grounded consultation response with
structured metadata:

```json
{
  "message": "string",
  "category": "string",
  "riskLevel": "low | medium | high | critical",
  "confidenceLevel": "low | medium | high",
  "bookingEligible": false,
  "suggestedNextAction": "string"
}
```

The API also returns legacy UI compatibility fields (`pesan`, `rekomendasi`,
`catatan`, `cta`) plus `providers`, `sessionId`, and `mock`.

## Responsibilities

- Classify service category from the latest message and recent history.
- Detect critical safety risks before model or provider recommendation logic.
- Build compact conversation memory so the assistant avoids repeated questions.
- Retrieve local diagnosis snippets plus provider shortlist context for grounded RAG.
- Assemble modular prompts for system, safety, diagnosis, booking, category, tone, and insight rules.
- Validate structured model output with Zod before returning it.
- Apply quality guardrails for long, robotic, bombastic, over-questioning, or repeated-question responses.
- Gate provider cards and booking CTA through `bookingEligible`.
- Persist conversation turns without exposing prompt/debug data in production.

## Key Files

| File | Role |
|------|------|
| `src/ai/gegarap-assistant/engine.ts` | Orchestrates safety, prompts, model call, validation, quality guard, and booking handoff |
| `src/ai/gegarap-assistant/prompts/*.ts` | Modular prompt rules |
| `src/ai/gegarap-assistant/rag.ts` | Lightweight keyword RAG snippets for grounded diagnosis insights |
| `src/ai/gegarap-assistant/safety-classifier.ts` | Critical danger keyword classifier |
| `src/ai/gegarap-assistant/diagnosis-classifier.ts` | Category detection |
| `src/ai/gegarap-assistant/memory.ts` | Compact conversation memory and question history |
| `src/ai/gegarap-assistant/booking-handoff.ts` | Booking eligibility decision |
| `src/ai/gegarap-assistant/quality-guard.ts` | Conversation quality checks |
| `src/ai/gegarap-assistant/validators.ts` | Response contract validation |
| `src/app/api/ai/chat/route.ts` | HTTP entrypoint, rate limit, cache, persistence |
| `src/components/ai/AiChat.tsx` | Consultation UI |
| `src/__tests__/gegarap-assistant.test.ts` | Safety, diagnosis, booking, quality, and contract tests |

## Data Flow

```text
POST /api/ai/chat
  -> sanitize + rate limit
  -> extract filters + provider search
  -> processChat
     -> safety classifier
     -> category classifier
     -> conversation memory
     -> lightweight RAG snippet retrieval
     -> modular prompt assembly
     -> Anthropic tool response
     -> Zod validation
     -> quality guard
     -> booking handoff
  -> persist ChatSession
  -> response
```

Critical safety messages return a deterministic safety response before the model
or recommendation path. If the model is unavailable, the route falls back to the
legacy deterministic recommendation path, but the safety classifier still runs
first through `processChat`.

## Production Notes

- `ANTHROPIC_API_KEY` is required for model-backed consultation.
- The default model is `claude-3-5-haiku-20241022` for lite, low-latency chat.
  Override with `GEGARAP_AI_MODEL` and `GEGARAP_AI_MAX_TOKENS` when needed.
- `NODE_ENV=production` strips any `debug` payload before responding.
- Recommendations must only use provider data returned from the search layer.
- Booking cards must not render unless `bookingEligible` is true.
