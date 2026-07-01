import type { Metadata } from 'next';
import { AiChat } from '@/components/ai/AiChat';
import { PageTransition } from '@/components/motion/PageTransition';

export const metadata: Metadata = {
  title: 'Asisten AI — Cari Tukang',
  description:
    'Ceritakan kebutuhanmu dalam bahasa sehari-hari, dan asisten AI gegarap.id merekomendasikan tukang terverifikasi yang paling sesuai.',
};

export default function AsistenPage() {
  return (
    <PageTransition className="container max-w-2xl py-8 sm:py-12">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Tanya Asisten AI
        </h1>
        <p className="mt-2 text-muted-foreground">
          Jelaskan masalahmu, biar asisten kami carikan tukang terpercaya di sekitarmu.
        </p>
      </div>
      <AiChat />
    </PageTransition>
  );
}
