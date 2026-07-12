import Script from 'next/script';

const MIDTRANS_SNAP_SRC =
  process.env.MIDTRANS_IS_PRODUCTION === 'true'
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';

export function MidtransSnapScript() {
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;

  if (!clientKey) return null;

  return <Script src={MIDTRANS_SNAP_SRC} data-client-key={clientKey} strategy="lazyOnload" />;
}
