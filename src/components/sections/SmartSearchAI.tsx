'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, TrendingUp, Tag } from 'lucide-react';
import { SearchInput } from '@/components/ui/SearchInput';
import { useDebounce } from '@/hooks/useDebounce';
import { CATEGORY_META } from '@/components/home/categories';

// A suggestion is either a real service category (deep-links to the pre-filtered
// /search?category=) or a free-text search intent (deep-links to /search?q=).
type Suggestion = { label: string; kind: 'kategori' | 'layanan'; href: string };

// FIXED service intents (master prompt §7). DECISION: these are search intents,
// not categories; on select we deep-link to the real `/search?q=`.
const SERVICES = [
  'Pasang AC',
  'Service AC',
  'Bongkar AC',
  'Cuci AC',
  'Instalasi Listrik',
  'Service Listrik',
  'Perbaikan Pipa',
  'Pasang Pipa',
  'Cat Rumah',
  'Renovasi Rumah',
] as const;

const SERVICE_SUGGESTIONS: Suggestion[] = SERVICES.map((label) => ({
  label,
  kind: 'layanan',
  href: `/search?q=${encodeURIComponent(label)}`,
}));

// Real service categories (single source of truth shared with the landing grid).
const CATEGORY_SUGGESTIONS: Suggestion[] = CATEGORY_META.map((c) => ({
  label: c.name,
  kind: 'kategori',
  href: `/search?category=${encodeURIComponent(c.name)}`,
}));

const POPULAR = SERVICE_SUGGESTIONS.slice(0, 5);
const EMPTY_COPY = 'Tidak ditemukan. Coba kata kunci lain.';
const LISTBOX_ID = 'hero-search-listbox';

/** Wraps the matched fragment in a primary-coloured <mark> (not browser yellow). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-bold text-primary">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function SmartSearchAI() {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [query, setQuery] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [highlight, setHighlight] = React.useState(-1);

  const debounced = useDebounce(query, 300);

  // Matching categories come first (authoritative deep-links), then service
  // intents — prefix matches before substring matches within each group.
  const results = React.useMemo<Suggestion[]>(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return [];
    const rank = (items: Suggestion[]) => {
      const prefix: Suggestion[] = [];
      const substring: Suggestion[] = [];
      for (const s of items) {
        const l = s.label.toLowerCase();
        if (l.startsWith(q)) prefix.push(s);
        else if (l.includes(q)) substring.push(s);
      }
      return [...prefix, ...substring];
    };
    return [...rank(CATEGORY_SUGGESTIONS), ...rank(SERVICE_SUGGESTIONS)];
  }, [debounced]);

  const isEmptyQuery = debounced.trim() === '';
  const items = isEmptyQuery ? POPULAR : results;
  const showEmptyState = !isEmptyQuery && results.length === 0;
  const open = focused && (items.length > 0 || showEmptyState);

  // Reset the active option whenever the visible list changes.
  React.useEffect(() => {
    setHighlight(-1);
  }, [debounced]);

  function select(s: Suggestion) {
    setQuery(s.label);
    setFocused(false);
    inputRef.current?.blur();
    router.push(s.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length) setHighlight((h) => (h + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) setHighlight((h) => (h <= 0 ? items.length - 1 : h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!items.length) {
        // No suggestions but the user typed something — search it literally.
        const q = query.trim();
        if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
        return;
      }
      select(items[highlight >= 0 ? highlight : 0]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setFocused(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className="relative w-full">
      <SearchInput
        ref={inputRef}
        value={query}
        active={open}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        placeholder="Mau perbaiki apa? mis. Pasang AC, Instalasi Listrik…"
        role="combobox"
        aria-expanded={open}
        aria-controls={LISTBOX_ID}
        aria-autocomplete="list"
        aria-activedescendant={highlight >= 0 ? `hero-search-opt-${highlight}` : undefined}
        aria-label="Cari layanan tukang"
      />

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 origin-top overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-elevated"
          >
            {isEmptyQuery && (
              <p className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                Pencarian populer
              </p>
            )}

            {showEmptyState ? (
              <div className="flex items-center gap-2.5 px-3 py-4 text-sm text-muted-foreground">
                <Search className="h-4 w-4 shrink-0" />
                {EMPTY_COPY}
              </div>
            ) : (
              <ul role="listbox" id={LISTBOX_ID} aria-label="Saran pencarian">
                {items.map((s, i) => (
                  <li
                    key={`${s.kind}-${s.label}`}
                    id={`hero-search-opt-${i}`}
                    role="option"
                    aria-selected={highlight === i}
                    // onMouseDown (not onClick) + preventDefault → select before the
                    // input's blur fires, so the dropdown doesn't close first.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      select(s);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    className={[
                      'flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors',
                      highlight === i ? 'bg-primary-light text-primary-800' : 'hover:bg-muted/60',
                    ].join(' ')}
                  >
                    {s.kind === 'kategori' ? (
                      <Tag className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1">
                      <Highlight text={s.label} query={debounced} />
                    </span>
                    {s.kind === 'kategori' && (
                      <span className="shrink-0 rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-semibold text-primary-800">
                        Kategori
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
