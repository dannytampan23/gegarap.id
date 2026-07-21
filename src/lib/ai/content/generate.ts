/**
 * Content engine orchestrator (System 5).
 *
 * Runs the spec's pipeline end to end:
 *   [Topic] -> [SEO structuring + generation] -> [self-audit + 1 refinement pass]
 *           -> [dedup vs existing titles] -> [grounded links + CTA] -> [strict JSON].
 *
 * Uses OpenAI structured outputs and a deterministic grounded fallback whenever
 * OPENAI_API_KEY is missing or the model call errors, so the feature degrades
 * instead of breaking.
 */

import { createStructuredResponse, DEFAULT_OPENAI_MODEL, isOpenAIConfigured } from '@/lib/ai/openai';
import { logEvent } from '@/lib/logger';
import {
  ARTICLE_SCHEMA,
  CATEGORY_CTA,
  META_MAX,
  MIN_SCORE,
  TITLE_MAX,
  type GeneratedArticle,
  type ModelArticle,
  type TopicInput,
} from './schema';
import { SYSTEM_PROMPT, buildUserTurn, clampText, fallbackArticle } from './prompt';
import { buildInternalLinks, type RelatedArticle } from './links';
import { checkDuplicate, slugify } from './dedup';

const MODEL = process.env.GEGARAP_CONTENT_MODEL || process.env.GEGARAP_AI_MODEL || DEFAULT_OPENAI_MODEL;

/** Whether a real OpenAI key is present (else we use the grounded fallback). */
export const isContentAIConfigured = isOpenAIConfigured;

export interface GenerateInput extends TopicInput {
  /** Titles of existing articles (for dedup + angle pivoting). */
  existingTitles?: string[];
  /** Published same-category articles, for grounded internal links. */
  related?: RelatedArticle[];
}

export interface GenerateResult {
  article: GeneratedArticle;
  slug: string;
  /** OpenAI model id or "fallback", recorded on the Article row. */
  generatedBy: string;
}

function minCriterion(s: ModelArticle['quality_score']): number {
  return Math.min(s.seo, s.readability, s.value, s.trust, s.conversion);
}

async function callModel(system: string, userTurn: string): Promise<ModelArticle> {
  const parsed = await createStructuredResponse<ModelArticle>({
    model: MODEL,
    maxOutputTokens: Number(process.env.GEGARAP_CONTENT_MAX_TOKENS) || 4096,
    system,
    input: [{ role: 'user', content: userTurn }],
    schemaName: 'gegarap_article',
    schemaDescription: 'SEO article shape for Gegarap content generation',
    schema: ARTICLE_SCHEMA as unknown as Record<string, unknown>,
  });
  if (typeof parsed.content_markdown !== 'string' || !Array.isArray(parsed.faq)) {
    throw new Error('unexpected shape');
  }
  return parsed;
}

function finalize(model: ModelArticle, input: GenerateInput, generatedBy: string): GenerateResult {
  const existingTitles = input.existingTitles ?? [];
  const related = input.related ?? [];

  const title = clampText(model.title, TITLE_MAX);
  const slug = slugify(title);
  const dedup = checkDuplicate(title, existingTitles);

  const cta = CATEGORY_CTA[input.category];
  const body = model.content_markdown.includes(cta)
    ? model.content_markdown
    : `${model.content_markdown.trim()}\n\n**${cta}** - temukan ${input.category} terverifikasi di ${input.location} lewat gegarap.id.`;

  const internal_links = buildInternalLinks({
    category: input.category,
    selfSlug: slug,
    related,
  });

  const s = model.quality_score;
  return {
    article: {
      title,
      meta_description: clampText(model.meta_description, META_MAX),
      content_markdown: body,
      faq: model.faq.slice(0, 5).filter((f) => f && f.q && f.a),
      internal_links,
      quality_score: {
        seo: s.seo,
        readability: s.readability,
        value: s.value,
        trust: s.trust,
        conversion: s.conversion,
        total: Math.round((s.seo + s.readability + s.value + s.trust + s.conversion) / 5),
      },
      duplicate_check: {
        is_duplicate: dedup.isDuplicate,
        similarity_score: dedup.similarityScore,
        new_angle: model.new_angle?.trim() || 'sudut orisinal',
      },
    },
    slug,
    generatedBy,
  };
}

export async function generateArticle(input: GenerateInput): Promise<GenerateResult> {
  if (!isContentAIConfigured()) {
    return finalize(fallbackArticle(input), input, 'fallback');
  }

  try {
    const userTurn = buildUserTurn(input, input.existingTitles ?? []);

    let model = await callModel(SYSTEM_PROMPT, userTurn);

    if (minCriterion(model.quality_score) < MIN_SCORE) {
      logEvent('content.refine', { title: model.title, score: model.quality_score.total });
      const refineSystem = `${SYSTEM_PROMPT}\n\nREVISI: Skor self-audit sebelumnya ada yang di bawah ${MIN_SCORE}. Tulis ULANG artikel dengan kualitas lebih tinggi pada bagian yang lemah (SEO/readability/value/trust/conversion), pertahankan struktur wajib.`;
      try {
        const refined = await callModel(refineSystem, userTurn);
        if (refined.quality_score.total >= model.quality_score.total) model = refined;
      } catch (e) {
        logEvent('content.refine.failed', { error: String(e) }, 'warn');
      }
    }

    logEvent('content.generated', { title: model.title, score: model.quality_score.total });
    return finalize(model, input, MODEL);
  } catch (err) {
    logEvent('content.generate.failed', { error: String(err) }, 'warn');
    return finalize(fallbackArticle(input), input, 'fallback');
  }
}
