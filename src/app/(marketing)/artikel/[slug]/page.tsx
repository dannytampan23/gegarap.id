import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ChevronRight, HelpCircle, Link2 } from 'lucide-react';
import { pageMetadata, BASE_URL } from '@/lib/seo';
import { SITE } from '@/lib/site';
import { getPublishedArticle } from '@/lib/services/article';
import { CATEGORY_CTA, categorySearchHref, type ContentCategory } from '@/lib/ai/content';
import { MarkdownContent } from '@/components/MarkdownContent';
import { ArticleActions } from '@/components/article/ArticleActions';

// ISR: article bodies are immutable-ish SEO content. Cache each slug and
// regenerate hourly; the admin publish/archive/delete flow calls
// revalidatePath('/artikel/<slug>') so a freshly published (or pulled) article
// is served correctly without waiting out this window.
export const revalidate = 3600;

interface FaqItem {
  q: string;
  a: string;
}
interface InternalLink {
  label: string;
  href: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) return { title: 'Artikel tidak ditemukan' };
  return pageMetadata({
    title: article.title,
    description: article.metaDescription,
    path: `/artikel/${article.slug}`,
  });
}

export default async function ArtikelDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) notFound();

  const faq = (article.faq as unknown as FaqItem[]) ?? [];
  const internalLinks = (article.internalLinks as unknown as InternalLink[]) ?? [];
  const cta =
    CATEGORY_CTA[article.category as ContentCategory] ?? 'Pesan Tukang Terpercaya Sekarang';
  const url = `${BASE_URL}/artikel/${article.slug}`;

  // Prefill the AI chat with the article's context so the floating "Tanya AI"
  // button opens a conversation that's already about what the reader is viewing.
  const asistenHref = `/asisten?q=${encodeURIComponent(
    `Saya baca artikel "${article.title}". Bisa bantu soal ${article.category} di ${article.location}?`
  )}`;

  // ── Structured data for rich results ──────────────────────────────────────
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription,
    inLanguage: 'id-ID',
    datePublished: (article.publishedAt ?? article.createdAt).toISOString(),
    dateModified: article.updatedAt.toISOString(),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    about: article.category,
    author: { '@type': 'Organization', name: SITE.name, url: BASE_URL },
    publisher: { '@type': 'Organization', name: SITE.name, url: BASE_URL },
  };

  const faqLd =
    faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }
      : null;

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Beranda', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Artikel', item: `${BASE_URL}/artikel` },
      { '@type': 'ListItem', position: 3, name: article.title, item: url },
    ],
  };

  return (
    <article className="container max-w-3xl py-10 sm:py-14">
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* Breadcrumb */}
      <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">
          Beranda
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/artikel" className="hover:text-primary">
          Artikel
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{article.category}</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
          {article.title}
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          {article.category} · {article.location}
        </p>
      </header>

      {/* Body */}
      <MarkdownContent markdown={article.contentMarkdown} />

      {/* Primary conversion CTA */}
      <div className="my-10 rounded-2xl border border-primary/20 bg-primary-light/50 p-6 text-center">
        <p className="text-lg font-bold text-foreground">Butuh bantuan profesional?</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          Temukan {article.category} terverifikasi Gegarap di {article.location} dengan harga
          transparan, langsung dari aplikasi.
        </p>
        <Link
          href={categorySearchHref(article.category as ContentCategory)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow hover:bg-primary-hover"
        >
          {cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* FAQ */}
      {faq.length > 0 && (
        <section className="my-10">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-foreground">
            <HelpCircle className="h-6 w-6 text-primary" />
            Pertanyaan yang sering ditanyakan
          </h2>
          <div className="space-y-3">
            {faq.map((f, i) => (
              <details
                key={i}
                className="group rounded-xl border border-border bg-card p-4 shadow-soft"
              >
                <summary className="cursor-pointer list-none font-semibold text-foreground marker:hidden">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Internal links */}
      {internalLinks.length > 0 && (
        <section className="my-10 border-t border-border pt-8">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Link2 className="h-4 w-4" />
            Baca juga
          </h2>
          <ul className="space-y-2">
            {internalLinks.map((l, i) => (
              <li key={i}>
                <Link
                  href={l.href}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sticky "Panggil Tukang" bar + floating "Tanya AI" button */}
      <ArticleActions
        searchHref={categorySearchHref(article.category as ContentCategory)}
        ctaLabel={cta}
        asistenHref={asistenHref}
      />
    </article>
  );
}
