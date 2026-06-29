# AI Content Engine (System 5)

Production pipeline that turns a topic into a ready-to-publish, SEO-optimized,
conversion-oriented article for the gegarap.id home-services marketplace. Built
to scale to 1000+ programmatic-SEO articles while keeping E-E-A-T trust high.

It mirrors the engineering contract of the AI assistant (System 4): **Anthropic
structured outputs** for a guaranteed JSON shape, plus a **deterministic, grounded
fallback** so the feature degrades (never breaks) when `ANTHROPIC_API_KEY` is
absent — the same no-op pattern as Midtrans/email.

## Pipeline

```
[Topic Input]
  → [SEO structuring + generation]   (Claude, structured output)
  → [Self-audit + 1 refinement pass] (scores < 8 → one targeted rewrite)
  → [Dedup vs existing titles]       (token Jaccard + char-trigram Dice, no embeddings)
  → [Grounded internal links + CTA]  (real routes only, enforced category CTA)
  → [Strict JSON]                    (persisted as DRAFT Article)
  → [Admin review → PUBLISH]         (public /artikel/<slug> + sitemap + JSON-LD)
```

The **model owns the prose** (title, body, FAQ, self-audit). The **orchestrator
owns everything a marketplace can't let a model hallucinate**: the slug, real
internal links, the enforced per-category CTA, hard length caps (title ≤ 60, meta
≤ 155), and the real similarity score computed against the DB.

## Files

| File | Role |
| --- | --- |
| `src/lib/ai/content/schema.ts` | Output contract, JSON Schema, category CTA map, caps |
| `src/lib/ai/content/prompt.ts` | System prompt, user-turn builder, deterministic fallback |
| `src/lib/ai/content/generate.ts` | Orchestrator: LLM call, self-audit gate, finalize/grounding |
| `src/lib/ai/content/dedup.ts` | Title similarity (Jaccard + trigram Dice), slugify |
| `src/lib/ai/content/links.ts` | Grounded internal links from real routes + related posts |
| `src/lib/services/article.ts` | Bridges pipeline ↔ Postgres (dedup/link context, persist) |
| `src/app/api/admin/articles/route.ts` | `POST` generate (rate-limited), `GET` list — admin only |
| `src/app/api/admin/articles/[id]/route.ts` | `PATCH` publish/archive, `DELETE` |
| `src/app/admin/articles/*` | Admin UI: generate form + management table + preview |
| `src/app/(marketing)/artikel/*` | Public list + detail (SEO metadata, JSON-LD, CTA) |
| `src/components/MarkdownContent.tsx` | Dependency-free, XSS-safe Markdown subset renderer |
| `src/app/sitemap.ts` | Static routes + published articles (ISR hourly) |

## Data model

`Article` (Prisma) — migration `20260629120000_add_article`. DRAFT → PUBLISHED →
ARCHIVED lifecycle; `slug` is the unique public URL key. Stores the five self-audit
scores, the dedup `similarityScore` + `newAngle`, and `generatedBy`
(`claude-sonnet-4-6` or `fallback`) for ops/analytics. No money/PII — these are
public marketing pages.

> ⚠️ The migration is written but **not yet applied to prod**. Apply with
> `prisma migrate deploy` (or `prisma db push`) against Railway, as with prior
> migrations.

## Quality gate (self-audit)

The model scores its own draft 1–10 on seo / readability / value / trust /
conversion. If **any** criterion is below `MIN_SCORE` (8), the orchestrator runs
**one** targeted refinement pass (bounded LLM cost) and keeps the better draft.
`total` is recomputed server-side as the mean — never trusted from the model.

## Duplicate detection

Embedding-free by design (consistent with the assistant's keyword RAG — no new
infra). Title similarity = `max(word-Jaccard, char-trigram-Dice)`. Existing
same-category titles are injected into the prompt so the model **pivots the angle**
(penyebab → biaya → solusi cepat); the real score is then computed against the DB
and stored. `> 0.7` flags `is_duplicate` for admin attention.

## Conversion

Every article funnels to the booking flow: the enforced per-category CTA
(`CATEGORY_CTA`) is appended if the model omits the exact phrase, and the primary
internal link is always `/search?category=<category>`. A CTA card + "Baca juga"
internal links render on the public page.

## SEO

- `pageMetadata()` → unique title/description/canonical + OG/Twitter per article.
- JSON-LD on the detail page: `Article`, `FAQPage`, `BreadcrumbList`.
- `app/sitemap.ts` lists all published articles (and was previously missing — now
  covers the static marketing routes too).

## Config

`ANTHROPIC_API_KEY` (already used by System 4). **Not gated** in
`scripts/check-env.mjs` — absent key → grounded fallback, same as Midtrans/email.
Optional: `UPSTASH_*` (rate-limit on generation), already present.

## Tests

`src/__tests__/content-dedup.test.ts`, `src/__tests__/content-generate.test.ts` —
similarity/slug, grounded links, length caps, CTA enforcement, dedup scoring, and
the deterministic fallback (the SDK is mocked to reject so the grounding path is
covered regardless of any key in the env).

## Try it

1. Apply the migration (see above) so the `Article` table exists.
2. Sign in as an `ADMIN`, open **/admin → Mesin Konten SEO** (`/admin/articles`).
3. Generate, e.g. topic "AC tidak dingin", category "Tukang Listrik", location
   "Yogyakarta". Review the draft + scores in the preview, then **Publikasikan**.
4. Read it at `/artikel/<slug>`; it appears in `/artikel` and `/sitemap.xml`.
