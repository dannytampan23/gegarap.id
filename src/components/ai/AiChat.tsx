'use client';

import * as React from 'react';
import Link from 'next/link';
import { Sparkles, Send, Star, MapPin, ShieldCheck, AlertTriangle, Loader2, Wrench } from 'lucide-react';
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

const SUGGESTIONS = [
  'Tukang ledeng di Depok, budget 200 ribu',
  'Butuh bersih rumah menyeluruh di Sleman',
  'Pasang lampu taman, ada yang murah?',
];

const SESSION_KEY = 'gegarap_ai_session';

export function AiChat() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const sessionId = React.useRef<string | undefined>(undefined);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    sessionId.current = localStorage.getItem(SESSION_KEY) ?? undefined;
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

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[28rem] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="font-bold text-foreground">Asisten gegarap.id</p>
          <p className="text-xs text-muted-foreground">Ceritakan kebutuhanmu, saya carikan tukangnya.</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
              <Wrench className="h-7 w-7" />
            </span>
            <div>
              <p className="font-semibold text-foreground">Mau cari tukang apa hari ini?</p>
              <p className="mt-1 text-sm text-muted-foreground">Coba salah satu contoh di bawah:</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-card px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex flex-col gap-3">
              <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-foreground">
                {m.pesan}
              </div>

              {m.rekomendasi.length > 0 && (
                <div className="grid gap-2.5">
                  {m.rekomendasi.map((r) => {
                    const info = m.providers.find((p) => p.id === r.id);
                    return (
                      <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
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
                      </div>
                    );
                  })}
                </div>
              )}

              {m.catatan && (
                <p className="max-w-[88%] text-xs text-muted-foreground">💡 {m.catatan}</p>
              )}
              {m.cta && <p className="max-w-[88%] text-sm font-medium text-foreground">{m.cta}</p>}
            </div>
          )
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Mencari tukang terbaik untukmu…
          </div>
        )}
      </div>

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
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Kirim"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow transition-all hover:bg-primary-hover disabled:opacity-50"
        >
          <Send className="h-4.5 w-4.5" />
        </button>
      </form>
    </div>
  );
}
