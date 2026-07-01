'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Star, MapPin, ShieldCheck, AlertTriangle, Wrench } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { buttonVariants } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface RecoItem {
  id: string;
  nama: string;
  layanan: string;
  estimasi_harga: string;
  rating: string;
  alasan: string;
  highlight: string;
}
interface ProviderInfo {
  id: string;
  name: string;
  avatarUrl: string | null;
  districts: string[];
  fraudBadge: 'baru' | null;
}
interface AssistantTurn {
  pesan: string;
  rekomendasi: RecoItem[];
  catatan: string;
  cta: string;
  providers: ProviderInfo[];
}
type Message =
  | { role: 'user'; content: string }
  | ({ role: 'assistant' } & AssistantTurn);

// Diagnostic, problem-first quick asks (the assistant still resolves these into
// verified-tukang recommendations). Mirrors the homepage "masalah rumah" framing.
const SUGGESTIONS = [
  'AC tidak dingin, kenapa ya?',
  'Listrik di rumah sering jeglek',
  'Air kamar mandi mampet',
];

const SESSION_KEY = 'gegarap_ai_session';

/** Framer entrance for each chat turn — fade + slide up, staggered a touch. */
const bubbleIn = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
};

function TypingIndicator() {
  return (
    <motion.div {...bubbleIn} className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground animation-delay-100" />
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground animation-delay-200" />
      </div>
    </motion.div>
  );
}

export function AiChat() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const sessionId = React.useRef<string | undefined>(undefined);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    sessionId.current = localStorage.getItem(SESSION_KEY) ?? undefined;
    // Prefill from `?q=` (e.g. the "Tanya AI tentang artikel ini" button) so the
    // reader lands with their question ready — they just review and hit send.
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setInput(q);
  }, []);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setLoading(true);

    // Compact history for the API: assistant turns send their `pesan` text.
    const history = messages.map((m) =>
      m.role === 'user' ? { role: 'user', content: m.content } : { role: 'assistant', content: m.pesan }
    );

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, sessionId: sessionId.current }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            pesan: json.message ?? 'Maaf, asisten sedang sibuk. Coba lagi sebentar lagi.',
            rekomendasi: [],
            catatan: '',
            cta: '',
            providers: [],
          },
        ]);
        return;
      }
      const d = json.data;
      if (d.sessionId) {
        sessionId.current = d.sessionId;
        localStorage.setItem(SESSION_KEY, d.sessionId);
      }
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          pesan: d.pesan,
          rekomendasi: d.rekomendasi ?? [],
          catatan: d.catatan ?? '',
          cta: d.cta ?? '',
          providers: d.providers ?? [],
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          pesan: 'Koneksi bermasalah. Periksa internet kamu lalu coba lagi.',
          rekomendasi: [],
          catatan: '',
          cta: '',
          providers: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const hasChat = messages.length > 0;

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[28rem] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-4">
        <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
          <Sparkles className="h-5 w-5" />
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-400" />
        </span>
        <div>
          <p className="font-bold text-foreground">Asisten gegarap.id</p>
          <p className="text-xs text-muted-foreground">
            {loading ? 'Sedang mengetik…' : 'Online · biasanya balas dalam beberapa detik'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto bg-surface/40 px-4 py-5 sm:px-5"
      >
        {!hasChat && (
          <motion.div
            {...bubbleIn}
            className="flex flex-col items-center justify-center gap-4 py-10 text-center"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
              <Wrench className="h-7 w-7" />
            </span>
            <div>
              <p className="font-semibold text-foreground">Ada masalah apa di rumah?</p>
              <p className="mt-1 text-sm text-muted-foreground">Coba salah satu pertanyaan ini:</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.08 }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="rounded-full border border-border bg-card px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <motion.div key={i} {...bubbleIn} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-soft">
                {m.content}
              </div>
            </motion.div>
          ) : (
            <motion.div key={i} {...bubbleIn} className="flex flex-col gap-3">
              <div className="max-w-[88%] whitespace-pre-line rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm leading-relaxed text-foreground shadow-soft">
                {m.pesan}
              </div>

              {m.rekomendasi.length > 0 && (
                <div className="grid gap-2.5">
                  {m.rekomendasi.map((r, ri) => {
                    const info = m.providers.find((p) => p.id === r.id);
                    return (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + ri * 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="rounded-2xl border border-border bg-card p-4 shadow-soft"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar name={r.nama} size="md" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-foreground">{r.nama}</h4>
                              <Badge variant="primary">{r.layanan}</Badge>
                              {info?.fraudBadge === 'baru' && (
                                <Badge variant="warning">
                                  <AlertTriangle className="h-3 w-3" />
                                  Baru bergabung
                                </Badge>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-500">
                                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                {r.rating}
                              </span>
                              <span>{r.estimasi_harga}</span>
                              {info?.districts?.length ? (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {info.districts.slice(0, 2).join(', ')}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{r.alasan}</p>
                            {r.highlight && (
                              <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {r.highlight}
                              </p>
                            )}
                          </div>
                        </div>
                        <Link
                          href={`/book/${r.id}`}
                          className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'mt-3 w-full')}
                        >
                          Booking {r.nama.split(' ')[0]}
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {m.catatan && (
                <p className="max-w-[88%] text-xs text-muted-foreground">💡 {m.catatan}</p>
              )}
              {m.cta && <p className="max-w-[88%] text-sm font-medium text-foreground">{m.cta}</p>}
            </motion.div>
          )
        )}

        <AnimatePresence>{loading && <TypingIndicator />}</AnimatePresence>
      </div>

      {/* Persistent quick chips (once a conversation has started) */}
      {hasChat && (
        <div className="flex gap-2 overflow-x-auto border-t border-border bg-card px-3 py-2.5 scrollbar-hide sm:px-4">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              disabled={loading}
              className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border bg-card px-3 py-3 sm:px-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Contoh: keran bocor di dapur, area Sleman…"
          aria-label="Pesan untuk asisten"
          className="h-11 flex-1 rounded-xl border border-border bg-card px-4 text-sm text-foreground outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
        />
        <motion.button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Kirim"
          whileTap={{ scale: 0.9 }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow transition-all hover:bg-primary-hover disabled:opacity-50"
        >
          <Send className="h-4.5 w-4.5" />
        </motion.button>
      </form>
    </div>
  );
}
