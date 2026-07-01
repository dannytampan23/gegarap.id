'use client';

import { motion, type Variants } from 'framer-motion';
import { BookOpen, Bot, ArrowRight, Sparkles } from 'lucide-react';
import { RippleButton } from '@/components/ui/RippleButton';

/**
 * Primary conversion band (master goal): route visitors to the two content
 * entry points — Artikel (SEO hub) and Asisten AI (chat). Two glassmorphism
 * cards with a Framer-Motion hover lift/scale + shadow and a button ripple.
 * Sits high on the homepage, just under the hero + trust bar.
 */
const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

interface CardDef {
  href: string;
  emoji: string;
  icon: typeof BookOpen;
  eyebrow: string;
  title: string;
  desc: string;
  cta: string;
  gradient: string;
  glow: string;
}

const CARDS: CardDef[] = [
  {
    href: '/artikel',
    emoji: '📚',
    icon: BookOpen,
    eyebrow: 'Baca & pelajari',
    title: 'Artikel & Panduan',
    desc: 'Edukasi dan solusi DIY untuk masalah rumah sehari-hari — lengkap dengan perkiraan biaya.',
    cta: 'Jelajahi Artikel',
    gradient: 'from-emerald-500/15 via-emerald-400/5 to-transparent',
    glow: 'group-hover:shadow-[0_24px_60px_-20px_rgb(5_150_105_/_0.45)]',
  },
  {
    href: '/asisten',
    emoji: '🤖',
    icon: Bot,
    eyebrow: 'Tanya langsung',
    title: 'Asisten AI',
    desc: 'Ceritakan masalah rumahmu dalam bahasa sehari-hari, AI kami jawab dan carikan tukangnya.',
    cta: 'Mulai Tanya',
    gradient: 'from-teal-500/15 via-cyan-400/5 to-transparent',
    glow: 'group-hover:shadow-[0_24px_60px_-20px_rgb(20_184_166_/_0.45)]',
  },
];

export function FeatureCards() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 hero-glow opacity-70" aria-hidden />
      <div className="container py-16 sm:py-20">
        {/* Heading + primary CTAs (brief's hero copy, framed as a band) */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="mx-auto mb-12 max-w-2xl text-center"
        >
          <motion.span
            variants={item}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-light/60 px-4 py-1.5 text-sm font-semibold text-primary-800"
          >
            <Sparkles className="h-4 w-4" />
            Cepat, gratis, tanpa ribet
          </motion.span>
          <motion.h2
            variants={item}
            className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
          >
            Solusi Cepat Masalah Rumahmu
          </motion.h2>
          <motion.p variants={item} className="mt-3 text-lg text-muted-foreground">
            Baca panduan atau tanya AI sekarang.
          </motion.p>
          <motion.div
            variants={item}
            className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"
          >
            <RippleButton
              href="/artikel"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-base font-semibold text-primary-foreground shadow-glow hover:bg-primary-hover hover:shadow-elevated"
            >
              <BookOpen className="h-5 w-5" />
              Baca Artikel
            </RippleButton>
            <RippleButton
              href="/asisten"
              rippleClassName="bg-primary/20"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-7 text-base font-semibold text-foreground shadow-soft hover:border-primary/40 hover:bg-muted/50"
            >
              <Bot className="h-5 w-5 text-primary" />
              Tanya Asisten AI
            </RippleButton>
          </motion.div>
        </motion.div>

        {/* Two feature cards */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2 sm:gap-6"
        >
          {CARDS.map((c) => (
            <motion.div key={c.href} variants={item} className="h-full">
              <motion.div
                whileHover={{ y: -6, scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                className="group h-full"
              >
                <RippleButton
                  href={c.href}
                  rippleClassName="bg-primary/15"
                  className={`glass flex h-full flex-col rounded-3xl border border-border/70 p-7 text-left shadow-card transition-shadow duration-300 ${c.glow}`}
                >
                  {/* Icon tile */}
                  <div
                    className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${c.gradient} text-3xl ring-1 ring-border/60`}
                  >
                    <span aria-hidden>{c.emoji}</span>
                  </div>

                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {c.eyebrow}
                  </span>
                  <h3 className="mt-1.5 text-xl font-extrabold tracking-tight text-foreground">
                    {c.title}
                  </h3>
                  <p className="mt-2 flex-1 leading-relaxed text-muted-foreground">{c.desc}</p>

                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary">
                    {c.cta}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </RippleButton>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
