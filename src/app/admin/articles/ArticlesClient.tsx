'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Loader2,
  Sparkles,
  RefreshCw,
  Inbox,
  Eye,
  Trash2,
  Send,
  Archive,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

const CATEGORIES = [
  'Tukang Ledeng',
  'Tukang Listrik',
  'Pembersih Rumah',
  'Tukang Kebun',
  'Tukang Bangunan',
] as const;

interface AdminArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  location: string;
  status: string;
  scoreTotal: number;
  similarityScore: number;
  generatedBy: string;
  publishedAt: string | null;
  createdAt: string;
}

interface GeneratedPreview {
  id: string;
  slug: string;
  status: string;
  generatedBy: string;
  title: string;
  meta_description: string;
  content_markdown: string;
  faq: { q: string; a: string }[];
  internal_links: { label: string; href: string }[];
  quality_score: {
    seo: number;
    readability: number;
    value: number;
    trust: number;
    conversion: number;
    total: number;
  };
  duplicate_check: { is_duplicate: boolean; similarity_score: number; new_angle: string };
}

const STATUS_VARIANT: Record<string, 'success' | 'primary' | 'neutral'> = {
  PUBLISHED: 'success',
  DRAFT: 'primary',
  ARCHIVED: 'neutral',
};

export function ArticlesClient() {
  const toast = useToast();
  const [rows, setRows] = React.useState<AdminArticle[] | null>(null);
  const [loadError, setLoadError] = React.useState(false);

  // Generation form
  const [topic, setTopic] = React.useState('');
  const [location, setLocation] = React.useState('Yogyakarta');
  const [category, setCategory] = React.useState<(typeof CATEGORIES)[number]>('Tukang Listrik');
  const [intent, setIntent] = React.useState<'informational' | 'transactional'>('informational');
  const [primaryKeyword, setPrimaryKeyword] = React.useState('');
  const [secondary, setSecondary] = React.useState('');
  const [priceRange, setPriceRange] = React.useState('');
  const [problems, setProblems] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [preview, setPreview] = React.useState<GeneratedPreview | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/admin/articles');
      const json = await res.json();
      if (json.ok) setRows(json.data.articles);
      else setLoadError(true);
    } catch {
      setLoadError(true);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          location: location.trim(),
          category,
          intent,
          primaryKeyword: primaryKeyword.trim() || undefined,
          secondaryKeywords: splitList(secondary),
          priceRange: priceRange.trim() || undefined,
          commonProblems: splitList(problems),
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setPreview(json.data);
        toast.success('Artikel dibuat', `Tersimpan sebagai draf · skor ${json.data.quality_score.total}/10`);
        setTopic('');
        setPrimaryKeyword('');
        setSecondary('');
        setProblems('');
        load();
      } else if (res.status === 422 && json.errors) {
        setErrors(json.errors);
        toast.error('Periksa input', 'Beberapa kolom belum valid.');
      } else {
        toast.error('Gagal membuat artikel', json.message ?? 'Coba lagi.');
      }
    } catch {
      toast.error('Koneksi bermasalah', 'Tidak dapat menghubungi server.');
    } finally {
      setGenerating(false);
    }
  }

  async function setStatus(id: string, status: 'PUBLISHED' | 'ARCHIVED' | 'DRAFT') {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Status diperbarui', `Artikel kini ${statusLabel(status)}.`);
        load();
      } else {
        toast.error('Gagal memperbarui', json.message ?? 'Coba lagi.');
      }
    } catch {
      toast.error('Koneksi bermasalah', 'Tidak dapat memperbarui status.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus artikel ini? Tindakan tidak bisa dibatalkan.')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/articles/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Artikel dihapus', '');
        setRows((r) => (r ? r.filter((x) => x.id !== id) : r));
      } else {
        toast.error('Gagal menghapus', json.message ?? 'Coba lagi.');
      }
    } catch {
      toast.error('Koneksi bermasalah', 'Tidak dapat menghapus.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-10">
      {/* ── Generation form ─────────────────────────────────────────────── */}
      <form
        onSubmit={generate}
        className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6"
      >
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
          <Sparkles className="h-5 w-5 text-primary" />
          Buat artikel baru
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Topik" required error={errors.topic} className="sm:col-span-2">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Contoh: AC tidak dingin padahal menyala"
              invalid={Boolean(errors.topic)}
            />
          </Field>
          <Field label="Kategori" required error={errors.category}>
            <Select value={category} onChange={(e) => setCategory(e.target.value as never)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lokasi" required error={errors.location}>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Yogyakarta"
              invalid={Boolean(errors.location)}
            />
          </Field>
          <Field label="Intent">
            <Select value={intent} onChange={(e) => setIntent(e.target.value as never)}>
              <option value="informational">Informational</option>
              <option value="transactional">Transactional</option>
            </Select>
          </Field>
          <Field label="Keyword utama" hint="Kosongkan untuk pakai topik">
            <Input
              value={primaryKeyword}
              onChange={(e) => setPrimaryKeyword(e.target.value)}
              placeholder="biaya service AC"
            />
          </Field>
          <Field label="Keyword sekunder" hint="Pisahkan dengan koma" className="sm:col-span-2">
            <Input
              value={secondary}
              onChange={(e) => setSecondary(e.target.value)}
              placeholder="freon AC, AC bocor, servis AC Jogja"
            />
          </Field>
          <Field label="Rentang harga (opsional)">
            <Input
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              placeholder="Rp 50.000 – Rp 350.000"
            />
          </Field>
          <Field label="Masalah umum (opsional)" hint="Pisahkan dengan koma">
            <Input
              value={problems}
              onChange={(e) => setProblems(e.target.value)}
              placeholder="freon habis, filter kotor, kompresor lemah"
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="submit" loading={generating} disabled={topic.trim().length < 4}>
            <Sparkles className="h-4 w-4" />
            {generating ? 'Membuat…' : 'Generate artikel'}
          </Button>
        </div>
      </form>

      {/* ── Articles table ──────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Artikel tersimpan</h2>
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            Segarkan
          </Button>
        </div>

        {rows === null && !loadError ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : loadError ? (
          <EmptyState
            icon={<ShieldAlert className="h-7 w-7" />}
            title="Gagal memuat artikel"
            description="Terjadi kesalahan saat mengambil data."
            action={
              <Button variant="outline" onClick={load}>
                <RefreshCw className="h-4 w-4" />
                Muat ulang
              </Button>
            }
          />
        ) : rows && rows.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-7 w-7" />}
            title="Belum ada artikel"
            description="Buat artikel pertama dengan form di atas."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3.5 font-semibold">Judul</th>
                    <th className="hidden px-5 py-3.5 font-semibold sm:table-cell">Kategori</th>
                    <th className="px-5 py-3.5 font-semibold">Skor</th>
                    <th className="hidden px-5 py-3.5 font-semibold md:table-cell">Mirip</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {rows?.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-foreground">{a.title}</div>
                        <div className="text-xs text-muted-foreground">
                          /{a.slug} · {a.generatedBy === 'fallback' ? 'template' : 'AI'}
                        </div>
                      </td>
                      <td className="hidden px-5 py-4 sm:table-cell">
                        <Badge variant="neutral">{a.category}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={
                            a.scoreTotal >= 8
                              ? 'font-semibold text-emerald-600'
                              : 'font-semibold text-amber-600'
                          }
                        >
                          {a.scoreTotal}/10
                        </span>
                      </td>
                      <td className="hidden px-5 py-4 md:table-cell">
                        <span
                          className={
                            a.similarityScore > 0.7 ? 'font-medium text-red-600' : 'text-muted-foreground'
                          }
                        >
                          {Math.round(a.similarityScore * 100)}%
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={STATUS_VARIANT[a.status] ?? 'neutral'}>
                          {statusLabel(a.status)}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {a.status === 'PUBLISHED' && (
                            <Link
                              href={`/artikel/${a.slug}`}
                              target="_blank"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary"
                              title="Lihat artikel"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          )}
                          {a.status !== 'PUBLISHED' ? (
                            <Button
                              size="sm"
                              variant="primary"
                              loading={busyId === a.id}
                              onClick={() => setStatus(a.id, 'PUBLISHED')}
                            >
                              <Send className="h-4 w-4" />
                              Publikasikan
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busyId === a.id}
                              onClick={() => setStatus(a.id, 'ARCHIVED')}
                            >
                              <Archive className="h-4 w-4" />
                              Arsipkan
                            </Button>
                          )}
                          <button
                            type="button"
                            onClick={() => remove(a.id)}
                            disabled={busyId === a.id}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Generated preview modal ─────────────────────────────────────── */}
      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ''}
        description={preview ? `Draf tersimpan · /${preview.slug}` : ''}
        className="max-w-3xl"
      >
        {preview && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {Object.entries(preview.quality_score).map(([k, v]) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs"
                >
                  <span className="capitalize text-muted-foreground">{k}</span>
                  <span className="font-semibold text-foreground">{v}</span>
                </span>
              ))}
            </div>

            {preview.duplicate_check.is_duplicate && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                ⚠️ Mirip artikel lain ({Math.round(preview.duplicate_check.similarity_score * 100)}%).
                Sudut baru: {preview.duplicate_check.new_angle}
              </p>
            )}

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Meta description
              </p>
              <p className="text-sm text-muted-foreground">{preview.meta_description}</p>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-xl border border-border bg-muted/20 p-4 text-sm leading-relaxed text-foreground">
              <pre className="whitespace-pre-wrap font-sans">{preview.content_markdown}</pre>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setPreview(null)}>
                <Eye className="h-4 w-4" />
                Tutup
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setStatus(preview.id, 'PUBLISHED');
                  setPreview(null);
                }}
              >
                <Send className="h-4 w-4" />
                Publikasikan sekarang
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function splitList(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function statusLabel(s: string): string {
  return s === 'PUBLISHED' ? 'Tayang' : s === 'ARCHIVED' ? 'Arsip' : 'Draf';
}
