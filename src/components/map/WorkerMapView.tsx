'use client';

import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Link from 'next/link';
import type { MapWorker } from '@/app/api/workers/route';

const BRAND = '#059669'; // gegarap.id green — used for both pins and the radius ring

/**
 * Brand-green teardrop pin built as a divIcon so we don't depend on Leaflet's
 * default blue PNG sprites (which also 404 under bundlers). Anchored at the tip.
 */
const workerIcon = L.divIcon({
  className: '',
  html: `<svg width="30" height="40" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.4 18.6 0 12 0z" fill="${BRAND}"/>
    <circle cx="12" cy="12" r="5" fill="#ffffff"/>
  </svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -36],
});

/** "You are here" marker, visually distinct (hollow ring). */
const youIcon = L.divIcon({
  className: '',
  html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${BRAND};border:3px solid #fff;box-shadow:0 0 0 3px ${BRAND}55"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function Stars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`Rating ${rating.toFixed(1)} dari 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="13"
          height="13"
          viewBox="0 0 20 20"
          fill={i < rounded ? '#f59e0b' : '#d1d5db'}
          aria-hidden="true"
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15l-5.2 2.6 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
        </svg>
      ))}
      <span className="ml-1 text-xs font-semibold text-slate-700">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function WorkerMapView({
  workers,
  center,
  radiusKm,
}: {
  workers: MapWorker[];
  center: [number, number];
  radiusKm: number;
}) {
  return (
    <div className="relative z-0 h-[500px] w-full overflow-hidden rounded-2xl border border-border shadow-xl">
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Search-radius ring around the user's location. */}
        <Circle
          center={center}
          radius={radiusKm * 1000}
          pathOptions={{ color: BRAND, fillColor: BRAND, fillOpacity: 0.06, weight: 1 }}
        />
        <Marker position={center} icon={youIcon}>
          <Popup>
            <div className="text-sm font-semibold text-emerald-700">Lokasi Anda</div>
          </Popup>
        </Marker>

        {workers.map((w) => (
          <Marker key={w.id} position={[w.latitude, w.longitude]} icon={workerIcon}>
            <Popup className="rounded-lg">
              <div className="flex min-w-[210px] flex-col gap-2">
                <div className="text-base font-bold text-slate-900">{w.name}</div>
                <span className="inline-block w-fit rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                  {w.category}
                </span>
                <Stars rating={w.rating} />
                <div className="text-sm text-slate-600">
                  Tarif:{' '}
                  <span className="font-bold text-slate-900">
                    Rp {w.dailyRate.toLocaleString('id-ID')}/hari
                  </span>
                </div>
                <Link
                  href={`/book/${w.id}`}
                  className="mt-1 rounded-lg bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  Lihat Profil
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
