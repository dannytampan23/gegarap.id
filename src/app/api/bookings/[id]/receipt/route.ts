import { renderToBuffer } from '@react-pdf/renderer';
import { getSession } from '@/lib/firebase/session';
import { getReceiptData } from '@/lib/receipt';
import { ReceiptDocument } from '@/components/receipt/ReceiptDocument';

// @react-pdf/renderer is Node-only; pin the runtime and never cache (per-user, db-backed).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/bookings/:id/receipt — stream the DP nota as a PDF. Owner-only, and
 * only once the DP is actually paid (the nota documents a real payment).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const data = await getReceiptData(id);
  if (!data || data.customerId !== session.user.id) {
    return new Response('Not found', { status: 404 });
  }
  if (!data.isPaid) {
    return new Response('Nota belum tersedia — DP belum dibayar.', { status: 409 });
  }

  // Call the document component directly so the root element is a <Document>
  // (what renderToBuffer's types expect); wrap the Node Buffer as a Uint8Array
  // so it satisfies the Web Response BodyInit type.
  const pdf = await renderToBuffer(ReceiptDocument({ data }));

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Nota-DP-${data.shortId}-gegarap.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
