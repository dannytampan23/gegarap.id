import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileText, ArrowLeft } from 'lucide-react';
import { requireAdmin } from '@/lib/admin-guard';
import { isContentAIConfigured } from '@/lib/ai/content';
import { ArticlesClient } from './ArticlesClient';

export const metadata: Metadata = { title: 'Admin · Mesin Konten SEO' };
export const dynamic = 'force-dynamic';

export default async function AdminArticlesPage() {
  // Middleware gates /admin/*; this is defence-in-depth.
  const admin = await requireAdmin();
  if (!admin) redirect('/');

  return (
    <div className="container py-10 sm:py-14">
      <div className="mb-8 max-w-2xl">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke panel admin
        </Link>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-light/60 px-3.5 py-1.5 text-sm font-semibold text-primary-800">
          <FileText className="h-4 w-4" />
          Mesin Konten SEO
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Generator Artikel
        </h1>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          Hasilkan artikel SEO yang menyelesaikan masalah nyata pelanggan dan mengarahkan mereka
          memesan tukang. Setiap artikel melewati audit kualitas dan pengecekan duplikat sebelum
          tersimpan sebagai draf.
        </p>
        {!isContentAIConfigured() && (
          <p className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Mode fallback: <code>OPENAI_API_KEY</code> belum diset, jadi artikel dibuat dari
            template grounded (bukan LLM). Tetap dapat dipublikasikan, lalu di-regenerate setelah key
            tersedia.
          </p>
        )}
      </div>

      <ArticlesClient />
    </div>
  );
}
