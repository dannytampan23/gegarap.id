'use client';

import * as React from 'react';
import {
  IdCard,
  Inbox,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  UserCheck,
  Wallet,
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
  nikMasked: string;
  identityStatus: string;
  payoutStatus: string;
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
  nikMasked: string;
  identityStatus: string;
  identitySubmittedAt: string | null;
  identityVerifiedAt: string | null;
  identityRejectedReason: string | null;
  phoneVerifiedAt: string | null;
  payoutStatus: string;
  payoutVerifiedAt: string | null;
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
        toast.success('Pendaftaran ditolak', `Alasan disimpan untuk ${detail.name}.`);
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
          description="Semua pendaftaran tukang sudah ditinjau."
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
                  <th className="hidden px-5 py-3.5 font-semibold sm:table-cell">NIK</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {rows?.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.phone ?? '-'}</div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="primary">{p.category}</Badge>
                    </td>
                    <td className="hidden px-5 py-4 text-muted-foreground sm:table-cell">
                      {p.districts.join(', ') || '-'}
                    </td>
                    <td className="hidden px-5 py-4 font-medium text-foreground sm:table-cell">
                      {p.nikMasked}
                    </td>
                    <td className="px-5 py-4">
                      <IdentityBadge status={p.identityStatus} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button size="sm" variant="outline" onClick={() => openDetail(p.id)}>
                        <UserCheck className="h-4 w-4" />
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
            <div className="rounded-xl border border-primary/20 bg-primary-light/40 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Verifikasi tanpa foto KTP</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Admin meninjau data identitas yang diajukan. Sistem tidak menyimpan atau
                    menampilkan foto KTP.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoRow icon={<IdCard className="h-4 w-4" />} label="NIK" value={detail.nikMasked} />
              <InfoRow
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Status identitas"
                value={statusLabel(detail.identityStatus)}
              />
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
                    ? `${detail.payoutMethod} - ${detail.goPayNumber ?? '-'}`
                    : (detail.goPayNumber ?? '-')
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

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">
                Alasan penolakan{' '}
                <span className="font-normal text-muted-foreground">(jika ditolak)</span>
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Contoh: NIK tidak sesuai format atau data perlu diperbaiki."
              />
            </div>

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

function statusLabel(status: string): string {
  switch (status) {
    case 'PHONE_VERIFIED':
      return 'Nomor HP terverifikasi';
    case 'IDENTITY_SUBMITTED':
      return 'Identitas diajukan';
    case 'MANUALLY_VERIFIED':
      return 'Terverifikasi Gegarap';
    case 'REJECTED':
      return 'Ditolak';
    case 'SUSPENDED':
      return 'Ditangguhkan';
    default:
      return 'Belum diverifikasi';
  }
}

function IdentityBadge({ status }: { status: string }) {
  const label = statusLabel(status);
  const variant =
    status === 'MANUALLY_VERIFIED'
      ? 'success'
      : status === 'REJECTED' || status === 'SUSPENDED'
        ? 'danger'
        : status === 'IDENTITY_SUBMITTED' || status === 'PHONE_VERIFIED'
          ? 'warning'
          : 'neutral';

  return <Badge variant={variant}>{label}</Badge>;
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
        <p className="truncate text-sm font-medium text-foreground">{value || '-'}</p>
      </div>
    </div>
  );
}
