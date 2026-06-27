/**
 * PDF nota (server-only). Rendered to a Buffer by the receipt API route and the
 * email sender via `@react-pdf/renderer`'s `renderToBuffer`. MUST NOT be imported
 * into any client bundle — `@react-pdf/renderer` is a Node-only renderer.
 */

import * as React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ReceiptData } from '@/lib/receipt';
import { formatBookingDate, formatDateTime, timeSlotLabel } from '@/lib/utils';

const BRAND = '#2D9B4E';
const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 48, paddingHorizontal: 44, fontSize: 10, color: INK, fontFamily: 'Helvetica' },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: BRAND },
  brandSub: { fontSize: 8, color: MUTED, marginTop: 2 },
  paidPill: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#047857', backgroundColor: '#D1FAE5', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  pendingPill: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#B45309', backgroundColor: '#FEF3C7', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 26 },
  rule: { borderBottomWidth: 1, borderBottomColor: LINE, marginVertical: 12 },
  sectionLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', marginBottom: 6 },
  key: { width: 130, color: MUTED },
  val: { flex: 1, fontFamily: 'Helvetica-Bold' },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  moneyKey: { color: MUTED },
  moneyVal: { fontFamily: 'Helvetica-Bold' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: LINE },
  totalKey: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  totalVal: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: BRAND },
  note: { fontSize: 8, color: MUTED, marginTop: 4 },
  watermark: { position: 'absolute', top: 320, left: 90, fontSize: 96, fontFamily: 'Helvetica-Bold', color: BRAND, opacity: 0.08, transform: 'rotate(-28deg)' },
  footer: { position: 'absolute', bottom: 28, left: 44, right: 44, fontSize: 8, color: MUTED, textAlign: 'center', borderTopWidth: 1, borderTopColor: LINE, paddingTop: 10 },
});

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.row}>
      <Text style={s.key}>{k}</Text>
      <Text style={s.val}>{v}</Text>
    </View>
  );
}

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  const paid = data.isPaid;
  return (
    <Document title={`Nota DP ${data.shortId} - gegarap.id`} author="gegarap.id">
      <Page size="A4" style={s.page}>
        {paid && <Text style={s.watermark} fixed>LUNAS</Text>}

        <View style={s.brandRow}>
          <View>
            <Text style={s.brand}>gegarap.id</Text>
            <Text style={s.brandSub}>Tukang terpercaya di Daerah Istimewa Yogyakarta</Text>
          </View>
          <Text style={paid ? s.paidPill : s.pendingPill}>
            {paid ? 'DP LUNAS' : 'BELUM DIBAYAR'}
          </Text>
        </View>

        <Text style={s.title}>NOTA PEMBAYARAN DP</Text>
        <View style={s.rule} />

        <KV k="No. Transaksi" v={data.orderId ?? `GGR-${data.shortId}`} />
        <KV k="Tanggal Bayar" v={data.paidAt ? formatDateTime(data.paidAt) : '-'} />
        <KV k="Metode Bayar" v={data.paymentMethod ?? '-'} />

        <View style={s.rule} />
        <Text style={s.sectionLabel}>Detail Booking</Text>
        <KV k="Tukang" v={data.providerName} />
        <KV k="Layanan" v={data.category} />
        <KV
          k="Jadwal"
          v={`${formatBookingDate(data.scheduledDate)}${data.timeSlot ? ` · ${timeSlotLabel(data.timeSlot)}` : ''}`}
        />
        <KV k="Estimasi" v={`${data.estimatedDays} hari kerja`} />
        <KV k="Lokasi" v={`${data.address}${data.district ? `, ${data.district}` : ''}`} />
        {data.description ? <KV k="Pekerjaan" v={data.description} /> : null}

        <View style={s.rule} />
        <Text style={s.sectionLabel}>Rincian Biaya</Text>
        <View style={s.moneyRow}>
          <Text style={s.moneyKey}>Total Biaya Jasa</Text>
          <Text style={s.moneyVal}>{rp(data.totalFee)}</Text>
        </View>
        <View style={s.moneyRow}>
          <Text style={s.moneyKey}>DP Dibayar ({data.dpPercent}%)</Text>
          <Text style={s.moneyVal}>{rp(data.dpAmount)}</Text>
        </View>
        <View style={s.totalRow}>
          <Text style={s.totalKey}>Sisa Pelunasan</Text>
          <Text style={s.totalVal}>{rp(data.remaining)}</Text>
        </View>
        <Text style={s.note}>Sisa dibayar setelah pekerjaan dikonfirmasi selesai.</Text>

        <Text style={s.footer} fixed>
          gegarap.id — Pembayaran aman & ditahan sistem (escrow) hingga pekerjaan selesai. Nota ini sah tanpa tanda tangan.
        </Text>
      </Page>
    </Document>
  );
}
