'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Film, ImageIcon } from 'lucide-react';
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
  kind: 'CREATIVE' | 'REPORT';
  durationSec?: number | null;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}

export function CreativesCard({ creatives, embedded = false }: { creatives: CreativeView[]; embedded?: boolean }) {
  const t = useTranslations('creatives');
  const [collapsed, setCollapsed] = useState(false);

  const { creativesOnly, reportsOnly } = useMemo(() => ({
    creativesOnly: creatives.filter(c => c.kind === 'CREATIVE'),
    reportsOnly: creatives.filter(c => c.kind === 'REPORT'),
  }), [creatives]);

  // Default to whichever tab actually has content. If both are empty, fall
  // back to CREATIVE (the empty-creatives message shows).
  const [activeKind, setActiveKind] = useState<'CREATIVE' | 'REPORT'>(
    () => (creativesOnly.length === 0 && reportsOnly.length > 0 ? 'REPORT' : 'CREATIVE'),
  );

  const hasReports = reportsOnly.length > 0;
  const hasCreatives = creativesOnly.length > 0;
  const visibleList = activeKind === 'CREATIVE' ? creativesOnly : reportsOnly;

  const containerClass = embedded
    ? 'overflow-hidden'
    : 'mb-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]';

  return (
    <div className={containerClass}>
      {!embedded && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight">{t('title')}</h3>
            <p className="mt-0.5 text-xs text-[var(--text-3)]">{t('subtitle')}</p>
          </div>
          <span className="text-xs text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
            {visibleList.length}
          </span>
        </div>
      )}

      {/* Always show the tab strip when the card has any content — the labels
          tell the user which kind is currently displayed. Tabs for empty kinds
          are still shown but disabled (greyed-out, no underline on hover). */}
      {(hasCreatives || hasReports) && (
        <div className={`flex border-b border-[var(--border)] ${embedded ? '' : 'px-5'}`}>
          {(['CREATIVE', 'REPORT'] as const).map(k => {
            const count = k === 'CREATIVE' ? creativesOnly.length : reportsOnly.length;
            const isEmpty = count === 0;
            const isActive = activeKind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => !isEmpty && setActiveKind(k)}
                disabled={isEmpty}
                className={`px-3 py-2 text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'border-b-2 border-[var(--brand-primary)] text-[var(--text)]'
                    : isEmpty
                      ? 'text-[var(--text-4)] cursor-not-allowed'
                      : 'text-[var(--text-3)] hover:text-[var(--text)]'
                }`}
              >
                {t(k === 'CREATIVE' ? 'tabCreatives' : 'tabReports')}
                <span className="ml-1.5 text-[11px] text-[var(--text-4)]">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {!collapsed && (
        <Filmstrip
          list={visibleList}
          embedded={embedded}
          emptyLabel={activeKind === 'REPORT' ? t('emptyReports') : t('emptyCreatives')}
        />
      )}

      {!embedded && (
        <button
          type="button"
          onClick={() => setCollapsed(v => !v)}
          className="flex w-full items-center justify-center gap-2 border-t border-dashed border-[var(--border)] py-3 text-[13px] text-[var(--text-3)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          {collapsed
            ? <><ChevronDown size={15} strokeWidth={1.5} /> {t('showAll')}</>
            : <><ChevronUp size={15} strokeWidth={1.5} /> {t('hideAll')}</>}
        </button>
      )}

      <style jsx global>{`
        .cc-filmstrip {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 14px;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x proximity;
          scroll-behavior: smooth;
          overscroll-behavior-x: contain;
        }
        .cc-filmstrip > .cc-tile {
          scroll-snap-align: start;
        }
        .cc-filmstrip-embedded {
          padding: 10px 0 0 0;
          gap: 8px;
          scrollbar-width: none;
        }
        .cc-filmstrip-embedded::-webkit-scrollbar {
          display: none;
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
        .cc-filmstrip-embedded .cc-tile {
          width: 168px;
          padding-top: calc(168px * 9 / 16);
        }
        @media (max-width: 640px) {
          .cc-filmstrip-embedded .cc-tile {
            width: 260px;
            padding-top: calc(260px * 9 / 16);
          }
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

        /* Strip wrapper — clip the chevron extension at the edges. */
        .cc-strip-wrap {
          position: relative;
          overflow: hidden;
        }

        /* Hairline edge nav — 6px idle hint, expands to 32px on parent hover.
           Chevron icon fades in once the parent is hovered/focus-within.
           Native scrolling stays on the strip itself; this is purely a
           click-to-page-scroll affordance. */
        .cc-fade {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
          cursor: pointer;
          border: none;
          padding: 0;
          color: var(--text);
          /* All cc-fade-related transitions share the same duration + easing
             so the slide, the fade, and the column-width change move in
             lockstep — both on enter and on exit. */
          transition: width 240ms cubic-bezier(0.2, 0.8, 0.2, 1),
                      background 240ms cubic-bezier(0.2, 0.8, 0.2, 1),
                      opacity 180ms ease;
        }
        .cc-fade-left {
          left: 0;
          background: linear-gradient(to right, rgba(0, 0, 0, 0.55), transparent);
        }
        .cc-fade-right {
          right: 0;
          background: linear-gradient(to left, rgba(0, 0, 0, 0.55), transparent);
        }
        /* Slide-in reveal — start the arrow off-edge and translate it in
           together with the opacity fade when the wrapper is hovered.
           Same duration + easing on opacity and transform → on hover-out
           the icon slides back out instead of fading in place. */
        .cc-fade svg {
          opacity: 0;
          transition: opacity 240ms cubic-bezier(0.2, 0.8, 0.2, 1),
                      transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .cc-fade-left svg  { transform: translateX(-12px); }
        .cc-fade-right svg { transform: translateX(12px); }
        /* Reveal on parent hover or keyboard focus inside the wrapper. */
        .cc-strip-wrap:hover > .cc-fade,
        .cc-strip-wrap:focus-within > .cc-fade {
          width: 32px;
        }
        .cc-strip-wrap:hover > .cc-fade svg,
        .cc-strip-wrap:focus-within > .cc-fade svg {
          opacity: 1;
          transform: translateX(0);
        }
        /* Stronger contrast on direct chevron hover. */
        .cc-fade:hover {
          background: linear-gradient(to right, rgba(0, 0, 0, 0.8), transparent);
        }
        .cc-fade-right:hover {
          background: linear-gradient(to left, rgba(0, 0, 0, 0.8), transparent);
        }
        /* Hide chevron at the edge it can't scroll toward. */
        .cc-fade[data-disabled="true"] {
          pointer-events: none;
          opacity: 0;
        }
        .cc-fade:focus-visible {
          outline: 2px solid var(--brand-primary);
          outline-offset: -4px;
          border-radius: 6px;
        }

        /* Mouse-only — grab cursor on the strip itself for click-and-drag. */
        @media (pointer: fine) {
          .cc-filmstrip {
            cursor: grab;
          }
          .cc-filmstrip.is-dragging {
            cursor: grabbing;
          }
        }
        /* Touch / coarse pointer — disable hover reveal entirely. */
        @media (hover: none), (pointer: coarse) {
          .cc-strip-wrap:hover > .cc-fade {
            width: 6px;
          }
          .cc-strip-wrap:hover > .cc-fade svg {
            opacity: 0;
          }
          .cc-strip-wrap:hover > .cc-fade-left svg  { transform: translateX(-12px); }
          .cc-strip-wrap:hover > .cc-fade-right svg { transform: translateX(12px); }
        }
        /* Reduced motion — drop transitions. */
        @media (prefers-reduced-motion: reduce) {
          .cc-filmstrip {
            scroll-behavior: auto;
          }
          .cc-fade,
          .cc-fade svg {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}

function Filmstrip({
  list,
  embedded,
  emptyLabel,
}: {
  list: CreativeView[];
  embedded: boolean;
  emptyLabel: string;
}) {
  const t = useTranslations('creatives');
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [activeDot, setActiveDot] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
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

  // Update the active dot + edge-fade visibility when the strip is scrolled.
  // Fade visibility is also recomputed on mount and on resize so the right
  // fade appears on initial render whenever the content overflows.
  const updateScrollState = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const tileStride = el.clientWidth - 32 + 10;
    const idx = tileStride > 0 ? Math.round(el.scrollLeft / tileStride) : 0;
    setActiveDot(Math.max(0, Math.min(idx, Math.max(list.length - 1, 0))));
    // 1px tolerance — sub-pixel scroll positions on retina screens
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, [list.length]);

  useEffect(() => {
    updateScrollState();
    const onResize = () => updateScrollState();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateScrollState]);

  // Click an edge chevron → smooth-scroll ~one viewport-width in that direction.
  const scrollByDirection = useCallback((dir: 1 | -1) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  }, []);

  // Vertical wheel → horizontal scroll (Windows mice without Shift). Lets
  // diagonal/horizontal trackpad input pass through, and yields to the page
  // scroller at the edges so the user can keep scrolling vertically.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = el.scrollLeft >= max && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Click-and-drag (mouse only) — touch/pen go through the native scroller.
  // After a real drag, suppress the synthetic click so the lightbox doesn't
  // open at release.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    let isDown = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      if ((e.target as HTMLElement).closest('button, a, [role="button"]')) return;
      isDown = true;
      moved = false;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
      el.style.scrollBehavior = 'auto';
    };
    const onMove = (e: PointerEvent) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      el.scrollLeft = startScroll - dx;
    };
    const onUp = (e: PointerEvent) => {
      if (!isDown) return;
      isDown = false;
      el.releasePointerCapture(e.pointerId);
      el.classList.remove('is-dragging');
      el.style.scrollBehavior = '';
      if (moved) {
        const stop = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
        window.addEventListener('click', stop, { once: true, capture: true });
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, []);

  if (list.length === 0) {
    return (
      <div className={embedded ? 'py-6 text-center' : 'px-5 py-10 text-center'}>
        <p className="text-sm italic text-[var(--text-3)]">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <>
      <div className="cc-strip-wrap">
        <div ref={stripRef} onScroll={updateScrollState} className={embedded ? 'cc-filmstrip cc-filmstrip-embedded' : 'cc-filmstrip'}>
        {list.map((c, i) => {
          const img = isImage(c.mimeType);
          const tileSrc = c.thumbnailUrl ?? (img ? c.url : null);
          return (
            <button
              key={c.id}
              ref={el => { tileRefs.current[i] = el; }}
              type="button"
              onClick={() => open(i)}
              aria-label={t('openCreative', { i: i + 1, total: list.length })}
              className="cc-tile group relative bg-[var(--surface-2)] transition-all duration-[180ms] hover:scale-[1.015] hover:shadow-[var(--shadow-md)]"
            >
              {tileSrc ? (
                <Image
                  src={tileSrc}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 280px"
                  className="object-cover"
                  unoptimized
                />
              ) : img ? (
                <ImageIcon
                  className="absolute inset-0 m-auto text-[var(--text-4)]"
                  size={28}
                  strokeWidth={1.25}
                  aria-hidden="true"
                />
              ) : (
                <Film
                  className="absolute inset-0 m-auto text-[var(--text-4)]"
                  size={28}
                  strokeWidth={1.25}
                  aria-hidden="true"
                />
              )}
              {/* Play affordance — videos only */}
              {!img && (
                <span className="play-wrap pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="cc-play-pill flex items-center justify-center rounded-full border border-white/20 backdrop-blur-md transition-colors group-hover:bg-black/70">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                      <polygon points="6 4 20 12 6 20" />
                    </svg>
                  </span>
                </span>
              )}
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
          );
        })}
        </div>

        {/* Hairline edge nav — invisible idle, expands to 32px and reveals the
            chevron when the wrapper is hovered or contains focus. data-disabled
            removes the chevron at the corresponding edge of the scroll range. */}
        <button
          type="button"
          aria-label={t('scrollLeft')}
          aria-hidden={!canScrollLeft}
          onClick={() => scrollByDirection(-1)}
          className="cc-fade cc-fade-left"
          data-disabled={!canScrollLeft}
          tabIndex={canScrollLeft ? 0 : -1}
        >
          <ChevronLeft size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label={t('scrollRight')}
          aria-hidden={!canScrollRight}
          onClick={() => scrollByDirection(1)}
          className="cc-fade cc-fade-right"
          data-disabled={!canScrollRight}
          tabIndex={canScrollRight ? 0 : -1}
        >
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      </div>

      {list.length > 1 && (
        <div className="cc-dots" aria-hidden="true">
          {list.map((_, i) => (
            <span key={i} className={i === activeDot ? 'cc-dot cc-dot-active' : 'cc-dot'} />
          ))}
        </div>
      )}

      {playingIdx != null && (
        <Lightbox
          creatives={list}
          index={playingIdx}
          onIndexChange={setPlayingIdx}
          onClose={close}
        />
      )}
    </>
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
  const img = isImage(current.mimeType);

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
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={current.id}
          src={current.url}
          alt={current.name}
          onClick={e => e.stopPropagation()}
          className="lightbox-video bg-black"
        />
      ) : (
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
      )}
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
