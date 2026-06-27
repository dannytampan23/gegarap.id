'use client';

import * as React from 'react';
import { Download, Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

/** Download (PDF) + Share actions for the receipt page. */
export function ReceiptActions({ jobId, shortId }: { jobId: string; shortId: string }) {
  const toast = useToast();
  const [copied, setCopied] = React.useState(false);

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const shareData = { title: `Nota DP gegarap.id #${shortId}`, url };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* user dismissed — ignore */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Tautan disalin', 'Tempel untuk membagikan nota ini.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Gagal menyalin', 'Salin tautan dari address bar.');
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <a
        href={`/api/bookings/${jobId}/receipt`}
        className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-base font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-elevated"
      >
        <Download className="h-4 w-4" />
        Unduh PDF
      </a>
      <Button type="button" variant="outline" size="lg" className="flex-1" onClick={share}>
        {copied ? <Check className="h-4 w-4 text-primary" /> : <Share2 className="h-4 w-4" />}
        {copied ? 'Tersalin' : 'Bagikan'}
      </Button>
    </div>
  );
}
