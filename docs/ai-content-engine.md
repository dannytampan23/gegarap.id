# AI Content Engine (System 5)

Production pipeline that turns a topic into a ready-to-publish, SEO-optimized,
conversion-oriented article for the gegarap.id home-services marketplace. It is
designed to scale programmatic SEO while keeping trust and grounding high.

It mirrors the AI assistant contract: OpenAI structured outputs for a guaranteed
JSON shape, plus a deterministic grounded fallback so the feature degrades when
`OPENAI_API_KEY` is absent.

## Pipeline

```text
[Topic Input]
  -> [SEO structuring + generation]   (OpenAI structured output)
  -> [Self-audit + 1 refinement pass] (scores < 8 -> one targeted rewrite)
  -> [Dedup vs existing titles]       (token Jaccard + char-trigram Dice)
  -> [Grounded internal links + CTA]  (real routes only)
  -> [Strict JSON]                    (persisted as DRAFT Article)
  -> [Admin review -> PUBLISH]        (public /artikel/<slug> + sitemap + JSON-LD)
```

The model owns the prose: title, body, FAQ, and self-audit. The orchestrator owns
the grounded facts: slug, real internal links, per-category CTA, length caps, and
the similarity score computed against stored article titles.

## Files

| File | Role |
| --- | --- |
| `src/lib/ai/openai.ts` | Shared OpenAI Responses API structured-output helper |
| `src/lib/ai/content/schema.ts` | Output contract, JSON Schema, category CTA map, caps |
| `src/lib/ai/content/prompt.ts` | System prompt, user-turn builder, deterministic fallback |
| `src/lib/ai/content/generate.ts` | Orchestrator: model call, self-audit gate, finalize/grounding |
| `src/lib/ai/content/dedup.ts` | Title similarity and slugify |
| `src/lib/ai/content/links.ts` | Grounded internal links from real routes + related posts |
| `src/lib/services/article.ts` | Bridges pipeline to Postgres |
| `src/app/api/admin/articles/route.ts` | Generate/list API, admin only |
| `src/app/admin/articles/*` | Admin UI |

## Config

`OPENAI_API_KEY` powers model-backed generation. If it is missing, generation
uses the deterministic fallback and still returns a publishable draft.

Optional overrides:

- `GEGARAP_CONTENT_MODEL`, default `gpt-5.6-sol`
- `GEGARAP_CONTENT_MAX_TOKENS`, default `4096`

## Tests

`src/__tests__/content-dedup.test.ts` and
`src/__tests__/content-generate.test.ts` cover similarity/slug behavior,
grounded links, length caps, CTA enforcement, dedup scoring, and deterministic
fallback behavior.
