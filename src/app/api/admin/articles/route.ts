import { ok, fail, handle } from '@/lib/api';
import { requireAdmin } from '@/lib/admin-guard';
import { recordAudit, AuditAction } from '@/lib/audit';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { logEvent } from '@/lib/logger';
import {
  articleGenerateSchema,
  createArticleDraft,
  listArticlesForAdmin,
} from '@/lib/services/article';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/articles — list articles for the management table. */
export async function GET() {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return fail('Akses ditolak.', 403);
    return ok({ articles: await listArticlesForAdmin() });
  })();
}

/**
 * POST /api/admin/articles — run the content pipeline for a topic and save a
 * DRAFT. Rate-limited (LLM calls are expensive) and admin-only.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return fail('Akses ditolak.', 403);

    // 10 generations / 5 min per admin — guards against runaway LLM spend.
    const limit = await rateLimit(`articles:generate:${admin.id}:${clientIp(req)}`, {
      windowMs: 5 * 60_000,
      max: 10,
    });
    if (!limit.ok) return fail('Terlalu banyak permintaan generate. Coba lagi sebentar lagi.', 429);

    const body = await req.json().catch(() => null);
    if (!body) return fail('Body permintaan tidak valid.', 400);

    // Throws ZodError → handle() turns it into a 422 field-error map.
    const input = articleGenerateSchema.parse(body);

    const created = await createArticleDraft(input, admin.id);

    await recordAudit({
      actorId: admin.id,
      action: AuditAction.ArticleGenerated,
      targetType: 'Article',
      targetId: created.id,
      metadata: {
        title: created.article.title,
        category: input.category,
        generatedBy: created.generatedBy,
        scoreTotal: created.article.quality_score.total,
        similarity: created.article.duplicate_check.similarity_score,
      },
    });
    logEvent('content.draft_saved', { id: created.id, generatedBy: created.generatedBy });

    return ok(
      {
        id: created.id,
        slug: created.slug,
        status: created.status,
        generatedBy: created.generatedBy,
        ...created.article,
      },
      201
    );
  })();
}
