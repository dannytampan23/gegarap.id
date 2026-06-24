/**
 * Pulse skeleton shown while the map chunk (and its data) loads. Matches the
 * map's footprint so the layout doesn't shift when the real map swaps in.
 */
export function MapSkeleton() {
  return (
    <div
      className="flex h-[500px] w-full animate-pulse items-center justify-center rounded-2xl border border-border bg-muted/40 shadow-inner"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="text-sm font-medium text-muted-foreground">Memuat Peta Interaktif…</span>
      </div>
    </div>
  );
}

export default MapSkeleton;
