import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { ok, fail, handle } from '@/lib/api';
import { requireAdmin } from '@/lib/admin-guard';
import { recordAudit, AuditAction } from '@/lib/audit';

/** Regenerate the ISR-cached public article pages after a status change. */
function revalidateArticle(slug: string) {
  revalidatePath('/artikel');
  revalidatePath(`/artikel/${slug}`);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
});

const AUDIT_FOR: Record<string, string> = {
  PUBLISHED: AuditAction.ArticlePublished,
  ARCHIVED: AuditAction.ArticleArchived,
  DRAFT: AuditAction.ArticleArchived, // unpublish back to draft
};

/** PATCH /api/admin/articles/:id — change publication status. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const admin = await requireAdmin();
    if (!admin) return fail('Akses ditolak.', 403);

    const body = await req.json().catch(() => null);
    if (!body) return fail('Body permintaan tidak valid.', 400);
    const { status } = patchSchema.parse(body);

    const existing = await prisma.article.findUnique({
      where: { id },
      select: { id: true, title: true, status: true, publishedAt: true },
    });
    if (!existing) return fail('Artikel tidak ditemukan.', 404);

    const updated = await prisma.article.update({
      where: { id: existing.id },
      data: {
        status,
        // Stamp publishedAt on first publish; keep it on re-publish; clear on draft.
        publishedAt:
          status === 'PUBLISHED' ? existing.publishedAt ?? new Date() : status === 'DRAFT' ? null : existing.publishedAt,
      },
      select: { id: true, slug: true, status: true, publishedAt: true },
    });

    await recordAudit({
      actorId: admin.id,
      action: AUDIT_FOR[status],
      targetType: 'Article',
      targetId: existing.id,
      metadata: { title: existing.title, from: existing.status, to: status },
    });

    revalidateArticle(updated.slug);

    return ok(updated);
  })();
}

/** DELETE /api/admin/articles/:id — remove an article. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const admin = await requireAdmin();
    if (!admin) return fail('Akses ditolak.', 403);

    const existing = await prisma.article.findUnique({
      where: { id },
      select: { id: true, title: true, slug: true },
    });
    if (!existing) return fail('Artikel tidak ditemukan.', 404);

    await prisma.article.delete({ where: { id: existing.id } });
    await recordAudit({
      actorId: admin.id,
      action: AuditAction.ArticleDeleted,
      targetType: 'Article',
      targetId: existing.id,
      metadata: { title: existing.title },
    });

    revalidateArticle(existing.slug);

    return ok({ id: existing.id, deleted: true });
  })();
}
