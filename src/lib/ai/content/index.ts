/**
 * AI content engine (System 5) — programmatic SEO article generation.
 *
 * Pipeline: topic → SEO structuring → generation → self-audit → dedup →
 * grounded internal links → strict JSON, ready for publishing. Mirrors the
 * assistant (System 4) engineering contract: OpenAI structured outputs with a
 * deterministic, grounded fallback.
 */

export {
  generateArticle,
  isContentAIConfigured,
  type GenerateInput,
  type GenerateResult,
} from './generate';
export {
  CATEGORY_CTA,
  type ContentCategory,
  type GeneratedArticle,
  type TopicInput,
  type Intent,
  type FaqItem,
  type InternalLink,
  type QualityScore,
  type DuplicateCheck,
} from './schema';
export { checkDuplicate, titleSimilarity, slugify, SIMILARITY_THRESHOLD } from './dedup';
export { buildInternalLinks, categorySearchHref, type RelatedArticle } from './links';
