'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReachRow } from '@/lib/reach';

interface Props {
  campaignId: string;
  rows: ReachRow[];
  audience: string | null;
  // Width of the source card at click-time, captured via getBoundingClientRect.
  // Used so the morph only expands vertically — no horizontal box growth.
  // Falls back to a sensible max-width on mobile / when not provided.
  cardWidth: number | null;
  onClose: () => void;
}

const morphTransition = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };

type Status = 'over' | 'under' | 'on';

const FACT_BG: Record<Status, string> = {
  on:    'linear-gradient(90deg, #2D7FE8 0%, #4FA3FF 100%)',
  over:  'linear-gradient(90deg, #2D9F75 0%, #34D399 100%)',
  under: 'linear-gradient(90deg, #C77F00 0%, #F59E0B 100%)',
};

const STATUS_TEXT: Record<Status, string> = {
  on:    '#4FA3FF',
  over:  '#34D399',
  under: '#F59E0B',
};

function statusFor(plan: number, fact: number): Status {
  if (plan <= 0) return 'on';
  const r = fact / plan;
  if (r >= 1.02) return 'over';
  if (r <= 0.98) return 'under';
  return 'on';
}

function fmtNumber(v: number): string {
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}

export function ReachModal({ campaignId, rows, audience, cardWidth, onClose }: Props) {
  const td = useTranslations('dashboard');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLButtonElement>('[data-close]')?.focus();
  }, []);

  // Modal shows ALL rows, sorted asc — not just pinned ones.
  const tiers = [...rows]
    .sort((a, b) => a.n - b.n)
    .map(r => ({ frequency: r.n, plan: r.plan ?? 0, fact: r.fact ?? 0 }));

  const max = tiers.length === 0
    ? 1
    : Math.max(...tiers.flatMap(t => [t.plan, t.fact]), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={td('reachCardTitle')}
        layoutId={`reach-${campaignId}`}
        transition={morphTransition}
        style={{
          background: 'var(--es-card-bg)',
          border: '1px solid var(--es-card-border)',
          // Match the source card width exactly so the layout morph only
          // expands vertically. `min(95vw, ...)` clamps for mobile.
          width: cardWidth
            ? `min(95vw, ${cardWidth}px)`
            : 'min(95vw, 860px)',
        }}
        className="relative flex max-h-[85vh] flex-col overflow-hidden rounded-[14px] shadow-2xl"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.12, duration: 0.22 } }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          className="flex flex-col overflow-hidden"
        >
          {/* Header — sticky chrome inside the morphing panel */}
          <div className="relative flex items-start justify-between gap-3 px-6 pt-5 pb-3 sm:px-7 sm:pt-6">
            <div className="min-w-0">
              <h2
                className="m-0 text-[13px] font-normal leading-tight"
                style={{ color: 'var(--es-label)' }}
              >
                {td('reachCardTitle')}
              </h2>
              {audience && (
                <p className="m-0 mt-1 flex items-baseline gap-1.5 text-[11px]">
                  <span style={{ color: 'var(--es-text-3)', letterSpacing: '0.02em' }}>
                    {td('reachAudienceLabel')}
                  </span>
                  <span
                    className="font-medium tabular-nums"
                    style={{ color: 'var(--es-text)', fontFamily: 'var(--font-mono)' }}
                  >
                    {audience}
                  </span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 pt-0.5">
              <button
                type="button"
                data-close
                aria-label={td('reachModalClose')}
                onClick={onClose}
                className="rounded-full p-1.5 text-[var(--es-text-3)] hover:bg-[var(--es-card-trough)] hover:text-[var(--es-text)]"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {/* Scrollable funnel rows */}
          <div className="flex-1 overflow-y-auto px-6 pb-6 sm:px-7 sm:pb-7">
            {tiers.length === 0 ? (
              <div
                className="grid place-items-center py-12 text-[12px]"
                style={{ color: 'var(--es-text-3)' }}
              >
                {td('reachEmpty')}
              </div>
            ) : (
              <>
                <ul className="m-0 flex flex-col gap-3 p-0" style={{ listStyle: 'none' }}>
                  {tiers.map(t => {
                    const status = statusFor(t.plan, t.fact);
                    const planPct = (t.plan / max) * 100;
                    const factPct = (t.fact / max) * 100;
                    const completionPct = t.plan > 0 ? Math.round((t.fact / t.plan) * 100) : null;

                    return (
                      <li
                        key={t.frequency}
                        className="grid items-center gap-3 sm:gap-4"
                        style={{ gridTemplateColumns: '40px 1fr auto' }}
                      >
                        <span
                          className="rounded-[5px] px-1.5 py-1.5 text-center text-[14px] font-semibold tabular-nums"
                          style={{
                            background: 'var(--es-card-trough)',
                            color: 'var(--es-text)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {t.frequency}+
                        </span>

                        <div
                          className="relative h-[32px] overflow-hidden rounded-[6px]"
                          style={{ background: 'var(--es-card-trough)' }}
                          role="img"
                          aria-label={`${t.frequency}+ план ${fmtNumber(t.plan)}, факт ${fmtNumber(t.fact)}`}
                        >
                          {/* Plan track — solid neutral */}
                          <div
                            className="absolute inset-y-0 left-0 rounded-[6px]"
                            style={{
                              width: `${planPct}%`,
                              background: 'var(--es-card-edge)',
                            }}
                          />
                          {/* Fact overlay — status-coloured, can extend past the plan edge for over-delivery */}
                          {factPct > 0 && (
                            <div
                              className="absolute inset-y-0 left-0 rounded-[6px]"
                              style={{
                                width: `${factPct}%`,
                                background: FACT_BG[status],
                              }}
                            />
                          )}
                        </div>

                        <div
                          className="flex shrink-0 items-center gap-3 text-[14px]"
                          style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
                        >
                          <span
                            className="w-16 text-right font-semibold"
                            style={{ color: 'var(--es-text-3)' }}
                          >
                            {fmtNumber(t.plan)}
                          </span>
                          <span
                            className="w-16 text-right font-semibold"
                            style={{ color: STATUS_TEXT[status] }}
                          >
                            {fmtNumber(t.fact)}
                          </span>
                          <span
                            className="w-16 text-right font-semibold"
                            style={{ color: STATUS_TEXT[status] }}
                          >
                            {completionPct !== null ? `${completionPct}%` : '—'}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* Column headers — under the rows for at-a-glance plan/fact mapping. */}
                <div
                  className="mt-3 flex justify-end gap-3 text-[10px] uppercase tracking-[0.06em]"
                  style={{ color: 'var(--es-text-3)', fontFamily: 'var(--font-mono)' }}
                >
                  <span className="w-16 text-right">{td('reachPlanLabel')}</span>
                  <span className="w-16 text-right">{td('reachFactLabel')}</span>
                  <span className="w-16 text-right">%</span>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
