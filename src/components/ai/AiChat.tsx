'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Star, MapPin, ShieldCheck, AlertTriangle, Wrench, ArrowRight } from 'lucide-react';
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
  category?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  confidenceLevel?: 'low' | 'medium' | 'high';
  bookingEligible?: boolean;
  quickReplies?: string[];
  timestamp?: number;
}
type Message =
  | { role: 'user'; content: string; timestamp?: number }
  | ({ role: 'assistant' } & AssistantTurn);

const SUGGESTIONS = [
  'AC tidak dingin, kenapa ya?',
  'Listrik di rumah sering jeglek',
  'Air kamar mandi mampet',
];

const SESSION_KEY = 'gegarap_ai_session';

const bubbleIn = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
};

function TypingIndicator() {
  return (
    <motion.div {...bubbleIn} className="flex justify-start">
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground mr-1">Gegarap sedang menganalisis</span>
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground animation-delay-100" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground animation-delay-200" />
      </div>
    </motion.div>
  );
}

function formatTime(ts?: number) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function AiChat() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const sessionId = React.useRef<string | undefined>(undefined);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    sessionId.current = localStorage.getItem(SESSION_KEY) ?? undefined;
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
    setMessages((m) => [...m, { role: 'user', content: message, timestamp: Date.now() }]);
    setLoading(true);

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
            timestamp: Date.now()
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
          pesan: d.message ?? d.pesan,
          rekomendasi: d.rekomendasi ?? [],
          catatan: d.catatan ?? '',
          cta: d.cta ?? '',
          providers: d.providers ?? [],
          category: d.category,
          riskLevel: d.riskLevel,
          confidenceLevel: d.confidenceLevel,
          bookingEligible: d.bookingEligible,
          quickReplies: d.quickReplies,
          timestamp: Date.now()
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
          timestamp: Date.now()
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const hasChat = messages.length > 0;

  const latestAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant') as AssistantTurn | undefined;
  const currentCategory = latestAssistantMsg?.category;
  const currentRisk = latestAssistantMsg?.riskLevel;

  let currentSuggestions = SUGGESTIONS;
  if (latestAssistantMsg?.quickReplies && latestAssistantMsg.quickReplies.length > 0) {
    currentSuggestions = latestAssistantMsg.quickReplies;
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[28rem] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-4">
        <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
          <Sparkles className="h-5 w-5" />
          <span className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
            currentRisk === 'critical' ? "bg-red-500 animate-pulse" :
            currentRisk === 'high' ? "bg-orange-500" :
            currentRisk === 'medium' ? "bg-yellow-500" :
            "bg-emerald-400"
          )} />
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-bold text-foreground">Asisten gegarap.id</p>
            {currentCategory && currentCategory !== 'Lainnya' && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">{currentCategory}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {loading ? 'Sedang mengetik...' : 'Online - Konsultasi gratis'}
          </p>
        </div>
      </div>

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
              <div className="flex flex-col items-end gap-1">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-soft">
                  {m.content}
                </div>
                {m.timestamp && <span className="text-[10px] text-muted-foreground mr-1">{formatTime(m.timestamp)}</span>}
              </div>
            </motion.div>
          ) : (
            <motion.div key={i} {...bubbleIn} className="flex flex-col gap-3">
              {m.riskLevel === 'critical' && (
                <div className="max-w-[88%] rounded-2xl border-l-4 border-red-500 bg-red-50 p-4 shadow-soft dark:bg-red-950/30">
                  <div className="flex items-start gap-3 text-red-700 dark:text-red-400">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <h4 className="font-bold">Peringatan Keselamatan!</h4>
                      <p className="mt-1 text-sm">Masalah ini berisiko tinggi. Harap jauhi area tersebut dan ikuti instruksi di bawah ini demi keselamatan Anda.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col items-start gap-1">
                <div className={cn(
                  "max-w-[88%] whitespace-pre-line rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed shadow-soft",
                  m.riskLevel === 'critical' ? "bg-red-50 text-red-900 border border-red-100 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/30" : "bg-muted text-foreground"
                )}>
                  {m.pesan}
                </div>
                {m.timestamp && <span className="text-[10px] text-muted-foreground ml-1">{formatTime(m.timestamp)}</span>}
              </div>

              {m.bookingEligible && m.rekomendasi.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-[88%] rounded-2xl border border-primary/20 bg-primary/5 p-4"
                >
                  <p className="mb-3 text-sm font-medium text-foreground">Perlu teknisi sekarang?</p>
                  <Link
                    href={`/search${m.category ? `?category=${encodeURIComponent(m.category)}` : ''}`}
                    className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), "w-full gap-2")}
                  >
                    Cari Teknisi <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              )}

              {m.bookingEligible && m.rekomendasi.length > 0 && (
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
                <p className="max-w-[88%] text-xs text-muted-foreground">{m.catatan}</p>
              )}
              {m.cta && <p className="max-w-[88%] text-sm font-medium text-foreground">{m.cta}</p>}
            </motion.div>
          )
        )}

        <AnimatePresence>{loading && <TypingIndicator />}</AnimatePresence>
      </div>

      {hasChat && (
        <div className="flex gap-2 overflow-x-auto border-t border-border bg-card px-3 py-2.5 scrollbar-hide sm:px-4">
          {currentSuggestions.map((s) => (
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
          placeholder="Ketik balasan Anda di sini..."
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
