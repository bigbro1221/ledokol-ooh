'use client';

import { useState } from 'react';
import { Film, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface CreativeView {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  mimeType: string;
}

function formatSize(bytes: number, tMb: string, tKb: string): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} ${tMb}`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} ${tKb}`;
  return `${bytes} B`;
}

export function CreativesCard({ creatives }: { creatives: CreativeView[] }) {
  const t = useTranslations('creatives');
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState<CreativeView | null>(null);

  if (creatives.length === 0) return null;

  const visible = expanded ? creatives : creatives.slice(0, 1);
  const hidden = creatives.length - 1;

  return (
    <div className="mb-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">{t('title')}</h3>
          <p className="mt-0.5 text-xs text-[var(--text-3)]">{t('subtitle')}</p>
        </div>
        <span className="text-xs text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
          {creatives.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--surface-2)]">
              <th className="w-[120px] border-b border-[var(--border)] px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                {t('tableCreative')}
              </th>
              <th className="border-b border-[var(--border)] px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                {t('tableName')}
              </th>
              <th className="border-b border-[var(--border)] px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                {t('tableType')}
              </th>
              <th className="border-b border-[var(--border)] px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                {t('tableSize')}
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map(c => (
              <tr
                key={c.id}
                onClick={() => setPlaying(c)}
                className="cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
              >
                <td className="border-b border-[var(--border)] px-4 py-2">
                  <div className="group relative h-[60px] w-[100px] overflow-hidden rounded-[var(--radius-sm)] bg-black">
                    {c.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Film size={20} className="absolute inset-0 m-auto text-[var(--text-4)]" strokeWidth={1.5} />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                        <polygon points="6,4 20,12 6,20" />
                      </svg>
                    </span>
                  </div>
                </td>
                <td className="border-b border-[var(--border)] px-4 py-3 text-sm font-medium">
                  {c.name}
                </td>
                <td className="border-b border-[var(--border)] px-4 py-3 text-sm text-[var(--text-2)]">
                  {t('typeVideo')}
                </td>
                <td className="border-b border-[var(--border)] px-4 py-3 text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatSize(c.sizeBytes, t('mb'), t('kb'))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex w-full items-center justify-center gap-2 border-t border-dashed border-[var(--border)] py-3 text-[13px] text-[var(--text-3)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          {expanded
            ? <><ChevronUp size={15} strokeWidth={1.5} /> {t('hideAll')}</>
            : <><ChevronDown size={15} strokeWidth={1.5} /> {t('showAll')} ({hidden})</>}
        </button>
      )}

      {playing && <VideoModal creative={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function VideoModal({ creative, onClose }: { creative: CreativeView; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-4xl overflow-hidden rounded-[var(--radius-lg)] bg-black"
      >
        <video
          src={creative.url}
          controls
          autoPlay
          playsInline
          className="block w-full"
          style={{ aspectRatio: creative.width && creative.height ? `${creative.width} / ${creative.height}` : '16 / 9' }}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
