/**
 * Content engine orchestrator (System 5).
 *
 * Runs the spec's pipeline end to end:
 *   [Topic] → [SEO structuring + generation] → [self-audit + 1 refinement pass]
 *           → [dedup vs existing titles] → [grounded links + CTA] → [strict JSON].
 *
 * Same engineering contract as the assistant (System 4): Anthropic structured
 * outputs (the schema, not prose, guarantees shape), and a deterministic,
 * grounded fallback whenever `ANTHROPIC_API_KEY` is missing OR the call errors —
 * so the feature degrades instead of breaking.
 *
 * The MODEL owns the prose + self-audit; the ORCHESTRATOR owns everything a
 * marketplace can't let a model hallucinate: real internal links, the enforced
 * category CTA, hard length caps, and the real similarity score from the DB.
 */

import Anthropic from '@anthropic-ai/sdk';
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

const MODEL = 'claude-sonnet-4-6';
const apiKey = process.env.ANTHROPIC_API_KEY;

/** Whether a real Anthropic key is present (else we use the grounded fallback). */
export const isContentAIConfigured = Boolean(apiKey);

export interface GenerateInput extends TopicInput {
  /** Titles of existing articles (for dedup + angle pivoting). */
  existingTitles?: string[];
  /** Published same-category articles, for grounded internal links. */
  related?: RelatedArticle[];
}

export interface GenerateResult {
  article: GeneratedArticle;
  slug: string;
  /** "claude-sonnet-4-6" or "fallback" — recorded on the Article row. */
  generatedBy: string;
}

/** Lowest score across the five criteria (the gate the spec checks). */
function minCriterion(s: ModelArticle['quality_score']): number {
  return Math.min(s.seo, s.readability, s.value, s.trust, s.conversion);
}

async function callModel(
  client: Anthropic,
  system: string,
  userTurn: string
): Promise<ModelArticle> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: 'disabled' },
    system,
    messages: [{ role: 'user', content: userTurn }],
    output_config: { format: { type: 'json_schema', schema: ARTICLE_SCHEMA } },
  });
  const block = res.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('no text content');
  const parsed = JSON.parse(block.text) as ModelArticle;
  if (typeof parsed.content_markdown !== 'string' || !Array.isArray(parsed.faq)) {
    throw new Error('unexpected shape');
  }
  return parsed;
}

/**
 * Assemble the strict, ready-to-publish contract from the model's prose + the
 * grounded server-side facts (links, CTA, dedup, length caps).
 */
function finalize(model: ModelArticle, input: GenerateInput, generatedBy: string): GenerateResult {
  const existingTitles = input.existingTitles ?? [];
  const related = input.related ?? [];

  const title = clampText(model.title, TITLE_MAX);
  const slug = slugify(title);
  const dedup = checkDuplicate(title, existingTitles);

  // Enforce the dynamic category CTA: append it as a closing call-out if the
  // model didn't already include the exact mandated phrase.
  const cta = CATEGORY_CTA[input.category];
  const body = model.content_markdown.includes(cta)
    ? model.content_markdown
    : `${model.content_markdown.trim()}\n\n**${cta}** — temukan ${input.category} terverifikasi di ${input.location} lewat gegarap.id.`;

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
        // Trust our own arithmetic for total rather than the model's.
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

/**
 * Generate one ready-to-publish article. Never throws — on any failure it
 * returns the grounded deterministic fallback so a route can always respond.
 */
export async function generateArticle(input: GenerateInput): Promise<GenerateResult> {
  if (!isContentAIConfigured) {
    return finalize(fallbackArticle(input), input, 'fallback');
  }

  try {
    const client = new Anthropic({ apiKey: apiKey! });
    const userTurn = buildUserTurn(input, input.existingTitles ?? []);

    let model = await callModel(client, SYSTEM_PROMPT, userTurn);

    // Self-audit gate: if any criterion is below threshold, ask for ONE targeted
    // refinement pass (bounded cost) before accepting the article.
    if (minCriterion(model.quality_score) < MIN_SCORE) {
      logEvent('content.refine', { title: model.title, score: model.quality_score.total });
      const refineSystem = `${SYSTEM_PROMPT}\n\nREVISI: Skor self-audit sebelumnya ada yang di bawah ${MIN_SCORE}. Tulis ULANG artikel dengan kualitas lebih tinggi pada bagian yang lemah (SEO/readability/value/trust/conversion), pertahankan struktur wajib.`;
      try {
        const refined = await callModel(client, refineSystem, userTurn);
        if (refined.quality_score.total >= model.quality_score.total) model = refined;
      } catch (e) {
        logEvent('content.refine.failed', { error: String(e) }, 'warn');
      }
    }

    logEvent('content.generated', { title: model.title, score: model.quality_score.total });
    return finalize(model, input, MODEL);
  } catch (err) {
    logEvent('content.generate.failed', { error: String(err) }, 'warn');
    // Graceful degradation — still return a real, grounded article.
    return finalize(fallbackArticle(input), input, 'fallback');
  }
}
