'use client';

import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReachRow } from '@/lib/reach';

interface Props {
  campaignId: string;
  rows: ReachRow[];
  audience: string | null;
  onClose: () => void;
}

const morphTransition = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };

type Status = 'over' | 'under' | 'on';

const FACT_BG: Record<Status, string> = {
  on:    'linear-gradient(90deg, #2D7FE8 0%, #4FA3FF 100%)',
  over:  'linear-gradient(90deg, #2D9F75 0%, #34D399 100%)',
  under: 'linear-gradient(90deg, #C77F00 0%, #F59E0B 100%)',
};

const PILL_STYLE: Record<Status, CSSProperties> = {
  on:    { background: 'rgba(79, 163, 255, 0.13)', color: '#4FA3FF' },
  over:  { background: 'rgba(52, 211, 153, 0.13)', color: '#34D399' },
  under: { background: 'rgba(245, 158, 11, 0.13)', color: '#F59E0B' },
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

export function ReachModal({ campaignId, rows, audience, onClose }: Props) {
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
        }}
        className="relative flex max-h-[85vh] w-[min(95vw,860px)] flex-col overflow-hidden rounded-[14px] shadow-2xl"
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
                  <span style={{ color: 'var(--text-3)', letterSpacing: '0.02em' }}>
                    {td('reachAudienceLabel')}
                  </span>
                  <span
                    className="font-medium tabular-nums"
                    style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
                  >
                    {audience}
                  </span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 pt-0.5">
              {tiers.length > 0 && (
                <span
                  className="whitespace-nowrap text-[9.5px] uppercase tracking-[0.06em]"
                  style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}
                >
                  {td('reachCompletionMeta')}
                </span>
              )}
              <button
                type="button"
                data-close
                aria-label={td('reachModalClose')}
                onClick={onClose}
                className="rounded-full p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
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
                style={{ color: 'var(--text-3)' }}
              >
                {td('reachEmpty')}
              </div>
            ) : (
              <ul className="m-0 flex flex-col gap-3 p-0" style={{ listStyle: 'none' }}>
                {tiers.map(t => {
                  const status = statusFor(t.plan, t.fact);
                  const planPct = (t.plan / max) * 100;
                  const factPct = (t.fact / max) * 100;
                  // % выполнения: fact / plan as a percentage (200% for 20/10, 10% for 1/10).
                  const completionPct = t.plan > 0 ? Math.round((t.fact / t.plan) * 100) : 0;
                  const srStatus = status === 'over'
                    ? td('reachAboveLabel')
                    : status === 'under'
                    ? td('reachBelowLabel')
                    : td('reachOnPlanLabel');

                  return (
                    <li
                      key={t.frequency}
                      className="grid items-center gap-3 sm:gap-4"
                      style={{ gridTemplateColumns: '40px 1fr auto auto' }}
                    >
                      <span
                        className="rounded-[5px] px-1.5 py-1.5 text-center text-[14px] font-semibold tabular-nums"
                        style={{
                          background: 'var(--surface-2)',
                          color: 'var(--text)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {t.frequency}+
                      </span>

                      <div
                        className="relative h-[32px] overflow-hidden rounded-[6px]"
                        style={{ background: 'var(--surface-2)' }}
                        role="img"
                        aria-label={`${t.frequency}+ план ${fmtNumber(t.plan)}, факт ${fmtNumber(t.fact)}`}
                      >
                        <div
                          className="absolute inset-y-0 left-0"
                          style={{
                            width: `${planPct}%`,
                            background:
                              'repeating-linear-gradient(45deg, var(--surface-3) 0 5px, var(--border) 5px 6px)',
                            borderRight: '1px dashed var(--text-3)',
                          }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 rounded-[6px]"
                          style={{
                            width: `${factPct}%`,
                            background: FACT_BG[status],
                          }}
                        />
                      </div>

                      <span
                        className="min-w-[64px] text-right text-[14px] font-semibold tabular-nums"
                        style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
                      >
                        {fmtNumber(t.fact)}
                      </span>

                      <span
                        className="min-w-[56px] rounded-[4px] px-2 py-1 text-right text-[12px] font-semibold tabular-nums"
                        style={{ ...PILL_STYLE[status], fontFamily: 'var(--font-mono)' }}
                      >
                        <span className="sr-only">{srStatus} </span>
                        {completionPct}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
