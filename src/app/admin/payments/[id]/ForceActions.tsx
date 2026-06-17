'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

const ACTIONABLE = ['PAID', 'HELD', 'DISPUTED', 'REFUND_REQUESTED'];

/**
 * Admin force-action panel. Both actions require a reason (mandatory audit
 * trail, Bagian 12.6). Disabled for statuses where neither action is legal.
 */
export function ForceActions({ paymentId, status }: { paymentId: string; status: string }) {
  const router = useRouter();
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  if (!ACTIONABLE.includes(status)) {
    return (
      <p className="text-sm text-muted-foreground">
        Tidak ada aksi paksa yang tersedia untuk status <span className="font-mono">{status}</span>.
      </p>
    );
  }

  async function act(action: 'REFUND' | 'RELEASE') {
    if (reason.trim().length < 5) {
      setMsg({ ok: false, text: 'Alasan wajib diisi (min. 5 karakter).' });
      return;
    }
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/force`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMsg({ ok: false, text: json.message ?? 'Aksi gagal.' });
        return;
      }
      setMsg({ ok: true, text: `Berhasil: ${action} → ${json.data.status}` });
      setReason('');
      router.refresh();
    } catch {
      setMsg({ ok: false, text: 'Koneksi bermasalah.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Alasan tindakan (wajib, tercatat di audit log)…"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => act('RELEASE')}
          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy === 'RELEASE' ? 'Memproses…' : 'Force Release ke Tukang'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => act('REFUND')}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy === 'REFUND' ? 'Memproses…' : 'Force Refund ke Customer'}
        </button>
      </div>
      {msg && (
        <p className={`text-sm font-medium ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>
      )}
    </div>
  );
}
