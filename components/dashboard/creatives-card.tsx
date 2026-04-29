'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronUp, ChevronDown, Film } from 'lucide-react';
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
  durationSec?: number | null;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function CreativesCard({ creatives }: { creatives: CreativeView[] }) {
  const t = useTranslations('creatives');
  const [collapsed, setCollapsed] = useState(false);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [activeDot, setActiveDot] = useState(0);
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const stripRef = useRef<HTMLDivElement | null>(null);

  const open = useCallback((i: number) => setPlayingIdx(i), []);
  const close = useCallback(() => {
    setPlayingIdx(prev => {
      if (prev != null) {
        queueMicrotask(() => tileRefs.current[prev]?.focus());
      }
      return null;
    });
  }, []);

  function onStripScroll() {
    const el = stripRef.current;
    if (!el || creatives.length === 0) return;
    // Mobile: tile width = clientWidth - 32, gap = 10. Index = round(scrollLeft / (tileWidth + gap)).
    const tileStride = el.clientWidth - 32 + 10;
    const idx = tileStride > 0 ? Math.round(el.scrollLeft / tileStride) : 0;
    setActiveDot(Math.max(0, Math.min(idx, creatives.length - 1)));
  }

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

      {!collapsed && (
        creatives.length === 0
          ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm italic text-[var(--text-3)]">{t('empty')}</p>
            </div>
          )
          : (
            <>
              <div ref={stripRef} onScroll={onStripScroll} className="cc-filmstrip">
                {creatives.map((c, i) => (
                  <button
                    key={c.id}
                    ref={el => { tileRefs.current[i] = el; }}
                    type="button"
                    onClick={() => open(i)}
                    aria-label={t('openCreative', { i: i + 1, total: creatives.length })}
                    className="cc-tile group relative bg-[var(--surface-2)] transition-all duration-[180ms] hover:scale-[1.015] hover:shadow-[var(--shadow-md)]"
                  >
                    {c.thumbnailUrl ? (
                      <Image
                        src={c.thumbnailUrl}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, 280px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <Film
                        className="absolute inset-0 m-auto text-[var(--text-4)]"
                        size={28}
                        strokeWidth={1.25}
                        aria-hidden="true"
                      />
                    )}
                    {/* Play affordance */}
                    <span className="play-wrap pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="cc-play-pill flex items-center justify-center rounded-full border border-white/20 backdrop-blur-md transition-colors group-hover:bg-black/70">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                          <polygon points="6 4 20 12 6 20" />
                        </svg>
                      </span>
                    </span>
                    {/* Duration chip */}
                    {c.durationSec != null && c.durationSec > 0 && (
                      <span
                        className="absolute bottom-2 right-2 rounded-[3px] px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm"
                        style={{ background: 'rgba(0,0,0,0.55)', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {formatDuration(c.durationSec)}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {creatives.length > 1 && (
                <div className="cc-dots" aria-hidden="true">
                  {creatives.map((_, i) => (
                    <span key={i} className={i === activeDot ? 'cc-dot cc-dot-active' : 'cc-dot'} />
                  ))}
                </div>
              )}
            </>
          )
      )}

      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="flex w-full items-center justify-center gap-2 border-t border-dashed border-[var(--border)] py-3 text-[13px] text-[var(--text-3)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
      >
        {collapsed
          ? <><ChevronDown size={15} strokeWidth={1.5} /> {t('showAll')}</>
          : <><ChevronUp size={15} strokeWidth={1.5} /> {t('hideAll')}</>}
      </button>

      {playingIdx != null && (
        <Lightbox
          creatives={creatives}
          index={playingIdx}
          onIndexChange={setPlayingIdx}
          onClose={close}
        />
      )}

      <style jsx global>{`
        .cc-filmstrip {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 14px;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .cc-filmstrip::-webkit-scrollbar {
          display: none;
        }
        /* padding-top hack reserves 16:9 height before Image/Video paint —
           more reliable than aspect-ratio on a <button> in a flex row. */
        .cc-tile {
          flex-shrink: 0;
          width: 280px;
          height: 0 !important;
          padding: 0;
          padding-top: calc(280px * 9 / 16);
          border: none;
          border-radius: 6px;
          overflow: hidden;
          cursor: pointer;
          position: relative;
          box-sizing: border-box;
          display: block;
        }
        .cc-tile:focus-visible {
          outline: none;
          box-shadow: var(--shadow-glow);
        }
        .cc-play-pill {
          width: 40px;
          height: 40px;
          background: rgba(0, 0, 0, 0.55);
        }
        .cc-dots {
          display: none;
        }

        @media (max-width: 640px) {
          .cc-filmstrip {
            padding: 14px 16px;
            gap: 10px;
            scroll-snap-type: x mandatory;
            scroll-padding-left: 16px;
          }
          .cc-tile {
            width: calc(100% - 32px);
            padding-top: calc((100vw - 32px - 32px) * 9 / 16);
            scroll-snap-align: start;
            border-radius: 8px;
          }
          .cc-play-pill {
            width: 44px;
            height: 44px;
          }
          .cc-dots {
            display: flex;
            justify-content: center;
            gap: 5px;
            padding: 4px 0 12px;
          }
        }

        .cc-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: var(--surface-3);
          transition: all 200ms ease;
        }
        .cc-dot-active {
          background: var(--brand-primary);
          width: 18px;
        }
      `}</style>
    </div>
  );
}

function Lightbox({
  creatives,
  index,
  onIndexChange,
  onClose,
}: {
  creatives: CreativeView[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations('creatives');
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const current = creatives[index];

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const videoEl = videoRef.current;
    closeBtnRef.current?.focus();
    return () => {
      if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute('src');
        videoEl.load();
      }
      if (prev && document.contains(prev) && document.activeElement === document.body) {
        prev.focus();
      }
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' && index > 0) {
        onIndexChange(index - 1);
      } else if (e.key === 'ArrowRight' && index < creatives.length - 1) {
        onIndexChange(index + 1);
      } else if (e.key === 'Tab') {
        const focusables = document.querySelectorAll<HTMLElement>(
          '#creatives-lightbox button, #creatives-lightbox video',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, creatives.length, onClose, onIndexChange]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  return (
    <div
      id="creatives-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={t('lightboxLabel')}
      onClick={onClose}
      className="lightbox"
    >
      <video
        ref={videoRef}
        key={current.id}
        src={current.url}
        poster={current.thumbnailUrl ?? undefined}
        preload="metadata"
        controls
        autoPlay
        playsInline
        onClick={e => e.stopPropagation()}
        className="lightbox-video bg-black"
      />
      <button
        ref={closeBtnRef}
        type="button"
        onClick={onClose}
        aria-label={t('lightboxClose')}
        className="lightbox-close flex items-center justify-center rounded-full text-white transition-colors hover:bg-white/20"
      >
        ✕
      </button>
      <style jsx>{`
        .lightbox {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.92);
          backdrop-filter: blur(8px);
        }
        .lightbox-video {
          max-width: 80vw;
          max-height: 80vh;
          border-radius: 8px;
        }
        .lightbox-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 36px;
          height: 36px;
          background: rgba(255, 255, 255, 0.1);
        }
        @media (max-width: 640px) {
          .lightbox-video {
            max-width: 100vw;
            max-height: 100vh;
            border-radius: 0;
          }
          .lightbox-close {
            top: max(24px, env(safe-area-inset-top));
            right: max(24px, env(safe-area-inset-right));
          }
        }
      `}</style>
    </div>
  );
}
