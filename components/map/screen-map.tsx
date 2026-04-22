'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const STYLES = { light: 'mapbox://styles/mapbox/light-v11', dark: 'mapbox://styles/mapbox/dark-v11' };

const TYPE_COLORS: Record<string, string> = {
  LED: '#FF6B2C',
  STATIC: '#3B82F6',
  STOP: '#8B5CF6',
  AIRPORT: '#10B981',
  BUS: '#F59E0B',
};

const TYPE_LABELS: Record<string, string> = {
  LED: 'LED',
  STATIC: 'Статика',
  STOP: 'Остановки',
  AIRPORT: 'Аэропорт',
  BUS: 'Транспорт',
};

interface MapScreen {
  id: string;
  lat: number;
  lng: number;
  type: string;
  address: string;
  city: string;
  size: string | null;
  ots: number | null;
  otsFact: number | null;
  photoUrl: string | null;
}


export function ScreenMap({ screens }: { screens: MapScreen[] }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const { resolvedTheme } = useTheme();

  const screensWithCoords = screens.filter(s => s.lat && s.lng);

  useEffect(() => {
    if (!mapContainer.current || !TOKEN || TOKEN.includes('placeholder')) return;

    // Destroy previous map on theme change
    if (map.current) {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.current.remove();
      map.current = null;
    }

    mapboxgl.accessToken = TOKEN;

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: resolvedTheme === 'dark' ? STYLES.dark : STYLES.light,
      center: [69.28, 41.31], // Tashkent default
      zoom: 11,
    });

    m.addControl(new mapboxgl.NavigationControl(), 'top-right');

    m.on('load', () => {
      // Add markers
      for (const s of screensWithCoords) {
        const color = TYPE_COLORS[s.type] || '#888';

        const el = document.createElement('div');
        el.style.width = '14px';
        el.style.height = '14px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = color;
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';

        const popup = new mapboxgl.Popup({ offset: 15, maxWidth: '260px' }).setHTML(`
          <div style="font-family:var(--font-sans);font-size:13px;line-height:1.4;">
            <div style="font-weight:600;margin-bottom:6px;">${s.address}</div>
            <div style="color:#888;font-size:11px;margin-bottom:6px;">${s.city} · ${TYPE_LABELS[s.type] || s.type}${s.size ? ` · ${s.size}` : ''}</div>
            ${s.otsFact != null
              ? `<div style="display:flex;align-items:baseline;gap:6px;">
                   <span style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#888;">Показы</span>
                   <span style="font-family:monospace;font-size:13px;font-weight:600;">${s.otsFact.toLocaleString('ru-RU')}</span>
                 </div>`
              : s.ots != null
                ? `<div style="display:flex;align-items:baseline;gap:6px;">
                     <span style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#888;">OTS план</span>
                     <span style="font-family:monospace;font-size:13px;font-weight:600;">${s.ots.toLocaleString('ru-RU')}</span>
                   </div>`
                : ''}
          </div>
        `);

        const marker = new mapboxgl.Marker(el)
          .setLngLat([s.lng, s.lat])
          .setPopup(popup)
          .addTo(m);

        markersRef.current.push(marker);
      }

      // Fit bounds
      if (screensWithCoords.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        screensWithCoords.forEach(s => bounds.extend([s.lng, s.lat]));
        m.fitBounds(bounds, { padding: 50, maxZoom: 14 });
      }

      // Add heatmap source
      m.addSource('screens-heat', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: screensWithCoords.map(s => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
            properties: { ots: s.ots || 1000 },
          })),
        },
      });

      m.addLayer({
        id: 'heatmap-layer',
        type: 'heatmap',
        source: 'screens-heat',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'ots'], 0, 0, 10000, 1],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 15, 14, 30],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, '#ffffb2',
            0.4, '#feb24c',
            0.6, '#fd8d3c',
            0.8, '#f03b20',
            1, '#bd0026',
          ],
          'heatmap-opacity': 0.7,
        },
      });
    });

    map.current = m;

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (map.current) { map.current.remove(); map.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screensWithCoords, resolvedTheme]);


  if (!TOKEN || TOKEN.includes('placeholder')) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight">Расположение экранов</h3>
            <p className="mt-0.5 text-xs text-[var(--text-3)]">{screensWithCoords.length} поверхностей с координатами</p>
          </div>
        </div>
        <div className="flex h-[320px] items-center justify-center rounded-[var(--radius-lg)] bg-[var(--surface-2)]">
          <p className="text-sm text-[var(--text-3)]">
            Добавьте NEXT_PUBLIC_MAPBOX_TOKEN в .env для отображения карты
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">Расположение экранов</h3>
          <p className="mt-0.5 text-xs text-[var(--text-3)]">{screensWithCoords.length} поверхностей с координатами</p>
        </div>
      </div>

      <div ref={mapContainer} className="h-[400px] overflow-hidden rounded-[var(--radius-lg)]" />

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4">
        {Object.entries(TYPE_COLORS).filter(([type]) => screensWithCoords.some(s => s.type === type)).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-[var(--text-3)]">{TYPE_LABELS[type] || type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
