import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { requireAdmin } from '@/lib/admin-guard';
import { AdminKycClient } from './AdminKycClient';

export const metadata: Metadata = { title: 'Admin · Verifikasi KYC' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // Middleware already gates /admin/* to ADMIN; this is defence-in-depth.
  const admin = await requireAdmin();
  if (!admin) redirect('/');

  return (
    <div className="container py-10 sm:py-14">
      <div className="mb-8 max-w-2xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-light/60 px-3.5 py-1.5 text-sm font-semibold text-primary-800">
          <ShieldCheck className="h-4 w-4" />
          Panel Admin
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Verifikasi KYC Tukang
        </h1>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          Tinjau dokumen KTP dan data pencairan tukang yang menunggu persetujuan. Hanya tukang yang
          disetujui yang tampil di marketplace.
        </p>
      </div>

      <AdminKycClient />
    </div>
  );
}
