'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { MapPinOff, WifiOff, RefreshCw } from 'lucide-react';
import { MapSkeleton } from './MapSkeleton';
import type { MapWorker } from '@/app/api/workers/route';

// Leaflet touches `window` on import, so the actual map view is loaded with
// ssr:false. The skeleton covers the brief client-side hydration + chunk load.
const WorkerMapView = dynamic(() => import('./WorkerMapView'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

// Provider data is hyper-local to Yogyakarta, so the marketplace map centres on
// the city with a DIY-wide radius rather than prompting for the visitor's
// location (which would show an empty map to anyone outside the region). The
// /api/workers endpoint still accepts lat/lng/radius for location-aware use.
const YOGYA: [number, number] = [-7.7956, 110.3695];
const RADIUS_KM = 30;

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; workers: MapWorker[] };

/**
 * Self-fetching map of nearby workers. Owns its loading / empty / error states
 * (the spec's three required async states) and only mounts the heavy Leaflet
 * chunk once it has data.
 */
export default function WorkerMap() {
  const center = YOGYA;
  const [state, setState] = React.useState<State>({ status: 'loading' });

  const load = React.useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch(`/api/workers?lat=${YOGYA[0]}&lng=${YOGYA[1]}&radius=${RADIUS_KM}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const workers: MapWorker[] = await res.json();
      setState({ status: 'ready', workers });
    } catch {
      setState({ status: 'error' });
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') return <MapSkeleton />;

  if (state.status === 'error') {
    return (
      <div className="flex h-[500px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card text-center shadow-inner">
        <WifiOff className="h-9 w-9 text-muted-foreground" aria-hidden />
        <p className="font-medium text-foreground">Gagal memuat peta. Periksa koneksi Anda.</p>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          <RefreshCw className="h-4 w-4" /> Coba lagi
        </button>
      </div>
    );
  }

  if (state.workers.length === 0) {
    return (
      <div className="flex h-[500px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-6 text-center">
        <MapPinOff className="h-9 w-9 text-muted-foreground" aria-hidden />
        <p className="font-medium text-foreground">
          Belum ada tukang di area ini. Coba perluas jangkauan.
        </p>
      </div>
    );
  }

  return <WorkerMapView workers={state.workers} center={center} radiusKm={RADIUS_KM} />;
}
