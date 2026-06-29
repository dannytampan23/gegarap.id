import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { listPublishedArticles } from '@/lib/services/article';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Tips & Panduan Tukang Rumah',
  description:
    'Panduan praktis seputar listrik, ledeng, AC, kebersihan, dan renovasi rumah di Yogyakarta — penyebab, solusi, perkiraan biaya, dan kapan harus panggil tukang.',
  path: '/artikel',
});

export default async function ArtikelListPage() {
  const articles = await listPublishedArticles();

  return (
    <div className="container py-12 sm:py-16">
      <div className="mb-10 max-w-2xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-light/60 px-3.5 py-1.5 text-sm font-semibold text-primary-800">
          <BookOpen className="h-4 w-4" />
          Tips & Panduan
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Panduan Perawatan Rumah
        </h1>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          Solusi praktis untuk masalah rumah sehari-hari — ditulis seperti penjelasan tukang
          berpengalaman, lengkap dengan perkiraan biaya di Indonesia.
        </p>
      </div>

      {articles.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-7 w-7" />}
          title="Belum ada artikel"
          description="Panduan akan segera hadir. Sementara itu, kamu bisa langsung mencari tukang terverifikasi."
          action={
            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              Cari tukang
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <Link
              key={a.slug}
              href={`/artikel/${a.slug}`}
              className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated"
            >
              <Badge variant="neutral" className="mb-3 self-start">
                {a.category}
              </Badge>
              <h2 className="text-lg font-bold leading-snug text-foreground group-hover:text-primary">
                {a.title}
              </h2>
              <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
                {a.metaDescription}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                Baca selengkapnya
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
