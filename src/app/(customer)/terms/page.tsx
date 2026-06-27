import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Prose } from '@/components/legal/Prose';
import { SITE } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Syarat & Ketentuan',
  description: 'Ketentuan penggunaan platform gegarap.id untuk pengguna dan mitra tukang.',
  path: '/terms',
});

const EFFECTIVE_DATE = '14 Juni 2026';

const toc = [
  { id: 'definisi', label: 'Definisi' },
  { id: 'cara-kerja', label: 'Cara Kerja & Tanggung Jawab' },
  { id: 'pembayaran-dp', label: 'Sistem DP & Pembayaran' },
  { id: 'pembatalan', label: 'Pembatalan & Refund' },
  { id: 'sengketa', label: 'Penyelesaian Sengketa' },
  { id: 'batas-tanggung-jawab', label: 'Batas Tanggung Jawab' },
];

export default function TermsPage() {
  return (
    <div className="container py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <FileText className="h-5 w-5" />
          Ketentuan penggunaan
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Syarat &amp; Ketentuan
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Tanggal efektif: {EFFECTIVE_DATE}</p>

        <nav
          aria-label="Daftar isi"
          className="mt-8 rounded-2xl border border-border bg-surface p-5"
        >
          <p className="text-sm font-bold text-foreground">Daftar Isi</p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {toc.map((item, i) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {i + 1}. {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Prose className="mt-8">
          <p>
            Dengan menggunakan gegarap.id, Anda menyetujui ketentuan berikut. Mohon dibaca dengan
            saksama sebelum memesan atau mendaftar sebagai mitra.
          </p>

          <h2 id="definisi">1. Definisi</h2>
          <ul>
            <li>
              <strong>Platform:</strong> situs dan layanan gegarap.id.
            </li>
            <li>
              <strong>Pengguna:</strong> pihak yang mencari dan memesan jasa tukang.
            </li>
            <li>
              <strong>Mitra/Tukang:</strong> penyedia jasa yang terdaftar dan terverifikasi.
            </li>
            <li>
              <strong>Pekerjaan:</strong> jasa yang dipesan Pengguna melalui Platform.
            </li>
            <li>
              <strong>DP:</strong> uang muka yang dibayarkan di awal sebagai komitmen pemesanan.
            </li>
          </ul>

          <h2 id="cara-kerja">2. Cara Kerja &amp; Tanggung Jawab</h2>
          <p>
            gegarap.id adalah platform yang <strong>mempertemukan</strong> Pengguna dengan Mitra.
            Kami memverifikasi identitas Mitra, namun pelaksanaan pekerjaan adalah kesepakatan
            langsung antara Pengguna dan Mitra.
          </p>
          <ul>
            <li>
              <strong>Mitra</strong> bertanggung jawab atas kualitas, keselamatan, dan ketepatan
              waktu pekerjaan.
            </li>
            <li>
              <strong>Pengguna</strong> bertanggung jawab memberikan informasi pekerjaan yang akurat
              dan akses lokasi yang aman.
            </li>
          </ul>

          <h2 id="pembayaran-dp">3. Sistem DP &amp; Pembayaran</h2>
          <p>
            DP diproses melalui Midtrans sebagai mitra pembayaran resmi. DP mengamankan slot
            pemesanan Anda dan menjadi komitmen bagi kedua pihak. Sisa pembayaran diselesaikan
            setelah pekerjaan rampung sesuai kesepakatan.
          </p>
          <ul>
            <li>
              <strong>Yang dilindungi:</strong> DP Anda hanya diteruskan ke Mitra setelah pekerjaan
              dikonfirmasi dimulai.
            </li>
            <li>
              <strong>Yang tidak dilindungi:</strong> kesepakatan tambahan di luar Platform (mis.
              pembayaran tunai langsung) berada di luar tanggung jawab kami.
            </li>
          </ul>

          <h2 id="pembatalan">4. Pembatalan &amp; Refund</h2>
          <ul>
            <li>
              Pembatalan <strong>lebih dari 24 jam</strong> sebelum jadwal: refund DP{' '}
              <strong>100%</strong>.
            </li>
            <li>
              Pembatalan <strong>kurang dari 24 jam</strong> sebelum jadwal: DP{' '}
              <strong>tidak dapat dikembalikan</strong> (sebagai kompensasi waktu Mitra).
            </li>
            <li>
              Jika Mitra membatalkan atau tidak datang, Anda berhak atas refund DP penuh.
            </li>
          </ul>

          <h2 id="sengketa">5. Penyelesaian Sengketa</h2>
          <p>
            Bila terjadi masalah, hubungi{' '}
            {SITE.contact.email ? (
              <a href={`mailto:${SITE.contact.email}`}>{SITE.contact.email}</a>
            ) : (
              <Link href="/help">Pusat Bantuan</Link>
            )}{' '}
            dalam <strong>3×24 jam</strong> setelah pekerjaan. Tim kami akan menengahi secara adil
            berdasarkan bukti dari kedua pihak.
          </p>

          <h2 id="batas-tanggung-jawab">6. Batas Tanggung Jawab</h2>
          <p>
            Tanggung jawab gegarap.id terbatas pada nilai DP transaksi terkait. Kami tidak
            bertanggung jawab atas kerugian tidak langsung yang timbul dari hubungan kerja antara
            Pengguna dan Mitra di luar mekanisme Platform.
          </p>
          <p>
            Pertanyaan lebih lanjut? Kunjungi <Link href="/help">Pusat Bantuan</Link>.
          </p>
        </Prose>
      </div>
    </div>
  );
}
