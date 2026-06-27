import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Prose } from '@/components/legal/Prose';
import { SITE } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Kebijakan Privasi',
  description:
    'Bagaimana gegarap.id mengumpulkan, menggunakan, dan melindungi data pribadi Anda.',
  path: '/privacy-policy',
});

const EFFECTIVE_DATE = '14 Juni 2026';

const toc = [
  { id: 'data-dikumpulkan', label: 'Data yang Kami Kumpulkan' },
  { id: 'penggunaan-data', label: 'Penggunaan Data' },
  { id: 'keamanan', label: 'Keamanan Data' },
  { id: 'hak-pengguna', label: 'Hak Pengguna' },
  { id: 'cookie', label: 'Cookie' },
  { id: 'kontak', label: 'Kontak' },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="container py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <ShieldCheck className="h-5 w-5" />
          Privasi Anda penting bagi kami
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Kebijakan Privasi
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
            gegarap.id (&quot;kami&quot;) menghubungkan warga Yogyakarta dengan tukang
            terverifikasi. Kebijakan ini menjelaskan data apa yang kami kumpulkan, untuk apa kami
            menggunakannya, dan bagaimana Anda dapat mengendalikannya.
          </p>

          <h2 id="data-dikumpulkan">1. Data yang Kami Kumpulkan</h2>
          <p>Kami hanya mengumpulkan data yang diperlukan untuk menjalankan layanan:</p>
          <ul>
            <li>
              <strong>Identitas:</strong> nama lengkap dan alamat email (melalui akun Google Anda).
            </li>
            <li>
              <strong>Kontak:</strong> nomor HP/WhatsApp untuk koordinasi pekerjaan.
            </li>
            <li>
              <strong>Verifikasi mitra:</strong> foto KTP — khusus untuk calon tukang, demi
              keamanan pengguna lain.
            </li>
            <li>
              <strong>Lokasi:</strong> koordinat GPS atau alamat yang Anda masukkan untuk mencari
              tukang terdekat.
            </li>
          </ul>

          <h2 id="penggunaan-data">2. Penggunaan Data</h2>
          <p>Data Anda digunakan secara terbatas untuk:</p>
          <ul>
            <li>Memverifikasi identitas mitra tukang sebelum profil diaktifkan.</li>
            <li>Mencocokkan kebutuhan Anda dengan tukang yang sesuai dan terdekat.</li>
            <li>Memproses pembayaran DP secara aman melalui mitra pembayaran (Midtrans).</li>
            <li>Mengirim notifikasi status booking via email atau WhatsApp.</li>
          </ul>

          <h2 id="keamanan">3. Keamanan Data</h2>
          <p>
            Data sensitif disimpan dengan enkripsi <em>at-rest</em> dan diakses hanya oleh sistem
            yang berwenang. <strong>Kami tidak pernah menjual data Anda</strong> ke pihak ketiga.
            Foto KTP digunakan semata-mata untuk verifikasi dan tidak ditampilkan kepada pengguna
            lain.
          </p>

          <h2 id="hak-pengguna">4. Hak Pengguna</h2>
          <p>Anda berhak untuk:</p>
          <ul>
            <li>Mengakses data pribadi yang kami simpan tentang Anda.</li>
            <li>Mengoreksi data yang tidak akurat.</li>
            <li>Meminta penghapusan data Anda dari sistem kami.</li>
          </ul>
          <p>
            Untuk menggunakan hak-hak ini,{' '}
            {SITE.privacyEmail ? (
              <>
                kirim email ke <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a>
              </>
            ) : (
              <>hubungi kami melalui <Link href="/help">Pusat Bantuan</Link></>
            )}{' '}
            dan kami akan merespons dalam 7 hari kerja.
          </p>

          <h2 id="cookie">5. Cookie</h2>
          <p>
            Kami hanya menggunakan <em>session cookie</em> dari NextAuth untuk menjaga Anda tetap
            masuk. Kami tidak memasang cookie pelacak (tracking) pihak ketiga untuk iklan.
          </p>

          <h2 id="kontak">6. Kontak</h2>
          <p>
            Ada pertanyaan tentang privasi Anda? Hubungi kami{' '}
            {SITE.privacyEmail ? (
              <>
                di <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a> atau lihat{' '}
              </>
            ) : (
              <>melalui </>
            )}
            <Link href="/help">Pusat Bantuan</Link>.
          </p>
        </Prose>
      </div>
    </div>
  );
}
