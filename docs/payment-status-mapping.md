# Payment Status → Label Mapping (untuk tim Frontend)

> Sumber kebenaran ada di kode: [`src/lib/payment-state.ts`](../src/lib/payment-state.ts)
> (`STATUS_LABELS`, `customerStatusLabel()`, `providerStatusLabel()`). Dokumen ini
> hanya ringkasan. **Jangan pernah menampilkan status mentah** (`PENDING`, `HELD`, …)
> ke end-user.

## Lifecycle

```
DRAFT → PENDING → PAID → HELD → RELEASED
                   │       ├→ REFUND_REQUESTED → REFUNDED | REFUND_REJECTED
                   │       └→ DISPUTED → RELEASED | REFUNDED
                   ├→ EXPIRED   (PENDING > 60 menit tanpa bayar)
                   └→ FAILED    (gateway menolak)
```

Transisi **hanya** dipicu backend (webhook gateway / aksi user yang divalidasi
ulang). Setiap transisi tercatat di `PaymentEvent` (audit immutable).

## Tabel label

| Status internal    | Label Customer                                   | Label Provider                                   | Tone    |
| ------------------ | ------------------------------------------------ | ------------------------------------------------ | ------- |
| `DRAFT`            | Menyiapkan Pembayaran                            | —                                                | info    |
| `PENDING`          | Menunggu Pembayaran                              | — (belum muncul ke provider)                     | warning |
| `PAID`             | Pembayaran Diterima, Mencari Provider            | Job Baru — Pembayaran Customer Sudah Aman        | success |
| `HELD`             | Dana Ditahan Aman — Provider Sedang Mengerjakan  | Sedang Dikerjakan — Dana Akan Cair Setelah Selesai | info  |
| `RELEASED`         | Selesai — Terima kasih!                          | Dana Telah Dicairkan ke Rekening Anda            | success |
| `REFUND_REQUESTED` | Refund Sedang Diproses                           | Pembatalan Sedang Ditinjau                       | warning |
| `REFUNDED`         | Dana Telah Dikembalikan                          | Pembatalan Disetujui — Dana Dikembalikan ke Customer | info |
| `REFUND_REJECTED`  | Pengajuan Refund Ditolak                         | Pembatalan Ditolak — Pekerjaan Dilanjutkan       | info    |
| `DISPUTED`         | Sedang Ditinjau Tim Kami (estimasi 48 jam)       | Ada Komplain — Tim Kami Akan Hubungi Anda        | warning |
| `EXPIRED`          | Pembayaran Kedaluwarsa                           | —                                                | danger  |
| `FAILED`           | Pembayaran Gagal                                 | —                                                | danger  |

`—` artinya status itu tidak disurfacing ke pihak tersebut.

## Cara pakai

```ts
import { customerStatusLabel, providerStatusLabel, STATUS_LABELS } from '@/lib/payment-state';

customerStatusLabel(payment.status); // string aman untuk customer
providerStatusLabel(payment.status); // string aman untuk provider
STATUS_LABELS[payment.status].tone;  // 'info' | 'success' | 'warning' | 'danger' → warna badge
```

Setiap perubahan status WAJIB memicu notifikasi (push/WA), bukan hanya update
diam-diam di DB (Bagian 9).
