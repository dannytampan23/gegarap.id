'use client';

import * as React from 'react';
import {
  Loader2,
  ShieldCheck,
  ShieldX,
  RefreshCw,
  Eye,
  Phone,
  MapPin,
  Wallet,
  Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency } from '@/lib/utils';

interface PendingRow {
  id: string;
  name: string;
  phone: string | null;
  category: string;
  districts: string[];
  dailyRate: number;
  hasKtp: boolean;
  createdAt: string;
}

interface Detail {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  category: string;
  districts: string[];
  dailyRate: number;
  bio: string | null;
  goPayNumber: string | null;
  payoutMethod: string | null;
  payoutDetails: unknown;
  isVerified: boolean;
  kycStatus: string;
  kycReason: string | null;
  hasKtp: boolean;
  ktpUrl: string | null;
  createdAt: string;
}

export function AdminKycClient() {
  const toast = useToast();
  const [rows, setRows] = React.useState<PendingRow[] | null>(null);
  const [loadError, setLoadError] = React.useState(false);

  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [action, setAction] = React.useState<null | 'approve' | 'reject'>(null);

  const loadPending = React.useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/admin/providers/pending');
      const json = await res.json();
      if (json.ok) setRows(json.data);
      else setLoadError(true);
    } catch {
      setLoadError(true);
    }
  }, []);

  React.useEffect(() => {
    loadPending();
  }, [loadPending]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setReason('');
    try {
      const res = await fetch(`/api/admin/providers/${id}`);
      const json = await res.json();
      if (json.ok) setDetail(json.data);
      else toast.error('Gagal memuat detail', json.message ?? 'Coba lagi.');
    } catch {
      toast.error('Koneksi bermasalah', 'Tidak dapat memuat detail tukang.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshKtp() {
    if (detail) await openDetail(detail.id);
  }

  async function approve() {
    if (!detail) return;
    setAction('approve');
    try {
      const res = await fetch(`/api/admin/providers/${detail.id}/approve`, { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Tukang disetujui', `${detail.name} kini tampil di marketplace.`);
        setRows((r) => (r ? r.filter((x) => x.id !== detail.id) : r));
        setDetail(null);
      } else {
        toast.error('Gagal menyetujui', json.message ?? 'Coba lagi.');
      }
    } catch {
      toast.error('Koneksi bermasalah', 'Tidak dapat menyetujui.');
    } finally {
      setAction(null);
    }
  }

  async function reject() {
    if (!detail) return;
    if (reason.trim().length < 5) {
      toast.error('Alasan wajib diisi', 'Tulis alasan penolakan (min. 5 karakter).');
      return;
    }
    setAction('reject');
    try {
      const res = await fetch(`/api/admin/providers/${detail.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success('Pendaftaran ditolak', `Alasan dikirim ke ${detail.name}.`);
        setRows((r) => (r ? r.filter((x) => x.id !== detail.id) : r));
        setDetail(null);
      } else {
        toast.error('Gagal menolak', json.message ?? 'Coba lagi.');
      }
    } catch {
      toast.error('Koneksi bermasalah', 'Tidak dapat menolak.');
    } finally {
      setAction(null);
    }
  }

  // ── Loading / error / empty states ─────────────────────────────────────────
  if (rows === null && !loadError) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <EmptyState
        icon={<ShieldX className="h-7 w-7" />}
        title="Gagal memuat antrean"
        description="Terjadi kesalahan saat mengambil data. Coba muat ulang."
        action={
          <Button variant="outline" onClick={loadPending}>
            <RefreshCw className="h-4 w-4" />
            Muat ulang
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{rows?.length ?? 0}</span> tukang menunggu
          verifikasi
        </p>
        <Button variant="ghost" size="sm" onClick={loadPending}>
          <RefreshCw className="h-4 w-4" />
          Segarkan
        </Button>
      </div>

      {rows && rows.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-7 w-7" />}
          title="Tidak ada antrean"
          description="Semua pendaftaran tukang sudah ditinjau. Kerja bagus! 🎉"
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3.5 font-semibold">Nama</th>
                  <th className="px-5 py-3.5 font-semibold">Kategori</th>
                  <th className="hidden px-5 py-3.5 font-semibold sm:table-cell">Area</th>
                  <th className="hidden px-5 py-3.5 font-semibold sm:table-cell">Tarif/hari</th>
                  <th className="px-5 py-3.5 font-semibold">KTP</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {rows?.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.phone ?? '—'}</div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="primary">{p.category}</Badge>
                    </td>
                    <td className="hidden px-5 py-4 text-muted-foreground sm:table-cell">
                      {p.districts.join(', ') || '—'}
                    </td>
                    <td className="hidden px-5 py-4 font-medium text-foreground sm:table-cell">
                      {formatCurrency(p.dailyRate)}
                    </td>
                    <td className="px-5 py-4">
                      {p.hasKtp ? (
                        <Badge variant="success">Ada</Badge>
                      ) : (
                        <Badge variant="neutral">Tidak ada</Badge>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button size="sm" variant="outline" onClick={() => openDetail(p.id)}>
                        <Eye className="h-4 w-4" />
                        Tinjau
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review modal */}
      <Modal
        open={Boolean(detail) || detailLoading}
        onClose={() => {
          if (!action) setDetail(null);
        }}
        title={detail ? `Verifikasi: ${detail.name}` : 'Memuat...'}
        description={detail?.category}
        className="max-w-2xl"
      >
        {detailLoading || !detail ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* KTP preview */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Dokumen KTP</span>
                <button
                  type="button"
                  onClick={refreshKtp}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Muat ulang (link kedaluwarsa 2 menit)
                </button>
              </div>
              {detail.ktpUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detail.ktpUrl}
                  alt="KTP tukang"
                  className="max-h-72 w-full rounded-xl border border-border bg-muted/30 object-contain"
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                  Dokumen KTP tidak tersedia.
                </div>
              )}
            </div>

            {/* Identity + payout */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoRow icon={<Phone className="h-4 w-4" />} label="WhatsApp" value={detail.phone} />
              <InfoRow
                icon={<MapPin className="h-4 w-4" />}
                label="Area kerja"
                value={detail.districts.join(', ')}
              />
              <InfoRow
                icon={<Wallet className="h-4 w-4" />}
                label="Pencairan"
                value={
                  detail.payoutMethod
                    ? `${detail.payoutMethod} · ${detail.goPayNumber ?? '—'}`
                    : (detail.goPayNumber ?? '—')
                }
              />
              <InfoRow
                icon={<Wallet className="h-4 w-4" />}
                label="Tarif harian"
                value={formatCurrency(detail.dailyRate)}
              />
            </div>

            {detail.bio && (
              <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
                {detail.bio}
              </div>
            )}

            {/* Reject reason */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">
                Alasan penolakan{' '}
                <span className="font-normal text-muted-foreground">(jika ditolak)</span>
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Contoh: Foto KTP buram / data tidak sesuai."
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="destructive"
                loading={action === 'reject'}
                disabled={action === 'approve'}
                onClick={reject}
              >
                <ShieldX className="h-4 w-4" />
                Tolak
              </Button>
              <Button
                variant="primary"
                loading={action === 'approve'}
                disabled={action === 'reject'}
                onClick={approve}
              >
                <ShieldCheck className="h-4 w-4" />
                Setujui & Aktifkan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value || '—'}</p>
      </div>
    </div>
  );
}
