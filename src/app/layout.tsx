import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { WhatsAppReminderModal } from '@/components/providers/WhatsAppReminderModal';

const MIDTRANS_SNAP_SRC =
  process.env.MIDTRANS_IS_PRODUCTION === 'true'
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';
const MIDTRANS_CLIENT_KEY = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;

const inter = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'gegarap.id — Jasa Tukang Terpercaya di Yogyakarta',
    template: '%s · gegarap.id',
  },
  description:
    'Temukan tukang ledeng, listrik, dan kebersihan profesional & terverifikasi di sekitar Anda. Booking mudah, pembayaran aman via DP.',
  keywords: ['jasa tukang', 'tukang ledeng', 'tukang listrik', 'Yogyakarta', 'gegarap'],
  metadataBase: new URL('https://gegarap.id'),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'gegarap.id — Jasa Tukang Terpercaya di Yogyakarta',
    description: 'Tukang terverifikasi di sekitar Anda. Cepat, aman, terpercaya.',
    url: 'https://gegarap.id',
    siteName: 'gegarap.id',
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'gegarap.id — Jasa Tukang Terpercaya di Yogyakarta',
    description: 'Tukang terverifikasi di sekitar Anda. Cepat, aman, terpercaya.',
  },
};

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <AuthProvider>
          <ToastProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
            <WhatsAppReminderModal />
          </ToastProvider>
        </AuthProvider>
        {MIDTRANS_CLIENT_KEY && (
          <Script src={MIDTRANS_SNAP_SRC} data-client-key={MIDTRANS_CLIENT_KEY} strategy="lazyOnload" />
        )}
      </body>
    </html>
  );
}
