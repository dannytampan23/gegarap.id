/**
 * Output contract + constants for the AI content engine (System 5).
 *
 * The JSON shape Claude must return is enforced STRUCTURALLY via
 * `ARTICLE_SCHEMA` (Anthropic structured outputs / output_config.format), the
 * same pattern as the assistant (System 4) — so we never hand-parse free-form
 * text. The model owns the *prose* (title, body, FAQ, self-audit); the
 * orchestrator owns the *grounded* facts (slug, internal links, dedup score,
 * CTA enforcement) so nothing user-facing can be hallucinated.
 */

import { PROVIDER_CATEGORIES } from '@/lib/validations';

/** Canonical content category. Drives the dynamic CTA and grounded links. */
export type ContentCategory = (typeof PROVIDER_CATEGORIES)[number];

export type Intent = 'informational' | 'transactional';

/** The pipeline's input — what a topic looks like before generation. */
export interface TopicInput {
  topic: string;
  location: string;
  category: ContentCategory;
  intent?: Intent;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  priceRange?: string;
  commonProblems?: string[];
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface InternalLink {
  label: string;
  href: string;
}

export interface QualityScore {
  seo: number;
  readability: number;
  value: number;
  trust: number;
  conversion: number;
  total: number;
}

export interface DuplicateCheck {
  is_duplicate: boolean;
  similarity_score: number;
  new_angle: string;
}

/** The strict, ready-to-publish contract (matches the spec's OUTPUT FORMAT). */
export interface GeneratedArticle {
  title: string;
  meta_description: string;
  content_markdown: string;
  faq: FaqItem[];
  internal_links: InternalLink[];
  quality_score: QualityScore;
  duplicate_check: DuplicateCheck;
}

/** What the MODEL returns. Grounded fields (links/dedup) are added server-side. */
export interface ModelArticle {
  title: string;
  meta_description: string;
  content_markdown: string;
  faq: FaqItem[];
  /** Free-text link ideas, used only as audit hints — never rendered raw. */
  internal_link_ideas: string[];
  quality_score: QualityScore;
  /** The pivot the model took to stay distinct from existing titles. */
  new_angle: string;
}

export const TITLE_MAX = 60;
export const META_MAX = 155;
/** Self-audit gate: any criterion below this triggers one refinement pass. */
export const MIN_SCORE = 8;

/** Dynamic conversion CTA per category (spec's CONVERSION ENGINE). */
export const CATEGORY_CTA: Record<ContentCategory, string> = {
  'Tukang Ledeng': 'Pesan Tukang Ledeng Terpercaya Sekarang',
  'Tukang Listrik': 'Hubungi Tukang Listrik Profesional Sekarang',
  'Pembersih Rumah': 'Pesan Jasa Bersih Rumah Terpercaya Sekarang',
  'Tukang Kebun': 'Panggil Tukang Kebun Berpengalaman Sekarang',
  'Tukang Bangunan': 'Hubungi Tukang Bangunan Profesional Sekarang',
};

/** JSON Schema for Anthropic structured outputs (output_config.format). */
export const ARTICLE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    meta_description: { type: 'string' },
    content_markdown: { type: 'string' },
    faq: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { q: { type: 'string' }, a: { type: 'string' } },
        required: ['q', 'a'],
      },
    },
    internal_link_ideas: { type: 'array', items: { type: 'string' } },
    quality_score: {
      type: 'object',
      additionalProperties: false,
      properties: {
        seo: { type: 'integer' },
        readability: { type: 'integer' },
        value: { type: 'integer' },
        trust: { type: 'integer' },
        conversion: { type: 'integer' },
        total: { type: 'integer' },
      },
      required: ['seo', 'readability', 'value', 'trust', 'conversion', 'total'],
    },
    new_angle: { type: 'string' },
  },
  required: [
    'title',
    'meta_description',
    'content_markdown',
    'faq',
    'internal_link_ideas',
    'quality_score',
    'new_angle',
  ],
} as const;
