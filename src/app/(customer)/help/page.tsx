import { pageMetadata } from '@/lib/seo';
import { ChevronDown, MessageCircle, Mail, LifeBuoy } from 'lucide-react';
import { ContactForm } from './ContactForm';
import { SITE } from '@/lib/site';
import { buildWALink } from '@/lib/utils';

export const metadata = pageMetadata({
  title: 'Pusat Bantuan',
  description: 'Pertanyaan umum seputar pemesanan, DP, keamanan data, dan kemitraan gegarap.id.',
  path: '/help',
});

const faqs = [
  {
    q: 'Bagaimana cara memesan tukang?',
    a: 'Cari tukang sesuai kategori dan lokasi Anda, pilih profil yang cocok, isi detail pekerjaan, pilih jadwal, lalu bayar DP. Tukang akan mengonfirmasi via WhatsApp.',
  },
  {
    q: 'Berapa DP yang harus dibayar?',
    a: 'DP sebesar 20% dari estimasi tarif pekerjaan, dibayarkan di awal sebagai komitmen. Sisanya dilunasi setelah pekerjaan selesai sesuai kesepakatan.',
  },
  {
    q: 'Apa yang terjadi jika tukang tidak datang?',
    a: 'Jika mitra membatalkan atau tidak hadir, Anda berhak atas pengembalian DP 100%. Laporkan ke tim kami dan akan kami proses.',
  },
  {
    q: 'Bagaimana cara mendaftar sebagai mitra tukang?',
    a: 'Buka halaman "Jadi Mitra", isi profil dan keahlian Anda, lalu unggah KTP untuk verifikasi. Setelah disetujui, profil Anda aktif dan siap menerima pekerjaan.',
  },
  {
    q: 'Apakah data KTP saya aman?',
    a: 'Ya. KTP hanya digunakan untuk verifikasi identitas, disimpan terenkripsi, dan tidak pernah ditampilkan ke pengguna lain atau dijual ke pihak ketiga.',
  },
  {
    q: 'Bisa bayar tanpa DP?',
    a: 'DP wajib untuk mengamankan jadwal dan melindungi kedua pihak. Tanpa DP, pemesanan belum dianggap terkonfirmasi.',
  },
  {
    q: 'Bagaimana jika hasil pekerjaan tidak memuaskan?',
    a: 'Hubungi support dalam 3×24 jam setelah pekerjaan. Tim kami akan menengahi berdasarkan bukti dari kedua pihak untuk mencari solusi yang adil.',
  },
  {
    q: 'Cara membatalkan pesanan?',
    a: 'Batalkan lebih dari 24 jam sebelum jadwal untuk refund DP penuh. Pembatalan kurang dari 24 jam tidak mendapat pengembalian DP.',
  },
];

const waLink = SITE.contact.wa
  ? buildWALink(SITE.contact.wa, 'Halo gegarap.id, saya butuh bantuan.')
  : null;

export default function HelpPage() {
  return (
    <div className="container py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <LifeBuoy className="h-5 w-5" />
          Kami siap membantu
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Pusat Bantuan
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Jawaban cepat untuk pertanyaan yang paling sering ditanyakan.
        </p>

        {/* FAQ */}
        <div className="mt-8 space-y-3">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-2xl border border-border bg-card px-5 shadow-soft transition-colors open:border-primary/30"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                {faq.q}
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>

        {/* Contact form */}
        <div className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Masih ada pertanyaan?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Kirim pesan dan tim kami akan membalas melalui email Anda.
          </p>
          <div className="mt-5">
            <ContactForm />
          </div>
        </div>

        {/* Direct contact — render only the channels that are configured. */}
        {SITE.hasSupport && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/40"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#25D366]">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-foreground">Chat Support</span>
                  <span className="block text-xs text-muted-foreground">Respon cepat via WhatsApp</span>
                </span>
              </a>
            )}
            {SITE.contact.email && (
              <a
                href={`mailto:${SITE.contact.email}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/40"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                  <Mail className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-foreground">Email</span>
                  <span className="block text-xs text-muted-foreground">{SITE.contact.email}</span>
                </span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
