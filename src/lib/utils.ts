import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

/** Human-readable booking date, e.g. "Senin, 23 Juni 2026". Accepts Date | ISO | null. */
export function formatBookingDate(d: Date | string | null | undefined): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Date + time, e.g. "23 Juni 2026, 10:32". */
export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '-';
  return (
    date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) +
    ', ' +
    date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  );
}

/** Concrete START time for a booking slot, e.g. "08:00 WIB". */
export function timeSlotStart(slot: string | null | undefined): string {
  switch (slot) {
    case 'pagi':
      return '08:00 WIB';
    case 'siang':
      return '11:00 WIB';
    case 'sore':
      return '15:00 WIB';
    default:
      return slot || '-';
  }
}

/** Map a booking time slot ("pagi"|"siang"|"sore") to a concrete window with WIB. */
export function timeSlotLabel(slot: string | null | undefined): string {
  switch (slot) {
    case 'pagi':
      return '08:00–11:00 WIB';
    case 'siang':
      return '11:00–15:00 WIB';
    case 'sore':
      return '15:00–18:00 WIB';
    default:
      return slot || '-';
  }
}

/**
 * Builds a wa.me deep link from a phone number and message. Normalises common
 * Indonesian formats (leading 0 → 62, strips spaces/symbols) and URL-encodes
 * the message.
 */
export function buildWALink(phone: string, message = ''): string {
  const cleaned = phone.replace(/\D/g, '').replace(/^0/, '62');
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${cleaned}${text}`;
}
