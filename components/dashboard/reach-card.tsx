'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { type ReachRow } from '@/lib/reach';
import { ReachModal } from './reach-modal';

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

interface Props {
  campaignId: string;
  rows: ReachRow[];
  audience: string | null;
}

export function ReachCard({ campaignId, rows, audience }: Props) {
  const td = useTranslations('dashboard');
  const [open, setOpen] = useState(false);

  // Only pinned rows render on the dashboard. If none are pinned the whole
  // card is suppressed — even with an audience set.
  const pinnedRows = rows.filter(r => r.pinned);
  if (pinnedRows.length === 0) return null;

  const tiers = [...pinnedRows]
    .sort((a, b) => a.n - b.n)
    .map(r => ({ frequency: r.n, plan: r.plan ?? 0, fact: r.fact ?? 0 }));

  const max = tiers.length === 0
    ? 1
    : Math.max(...tiers.flatMap(t => [t.plan, t.fact]), 1);

  const titleId = `reach-card-${campaignId}-title`;

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        layoutId={`reach-${campaignId}`}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          layout: morphTransition,
          default: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
        }}
        role="region"
        aria-labelledby={titleId}
        style={{
          visibility: open ? 'hidden' : 'visible',
          background: 'var(--es-card-bg)',
          border: '1px solid var(--es-card-border)',
        }}
        className="block w-full rounded-[14px] p-5 text-left transition-shadow hover:shadow-[var(--shadow-md)] sm:p-6"
      >
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              id={titleId}
              className="m-0 text-[13px] font-normal leading-tight"
              style={{ color: 'var(--es-label)' }}
            >
              {td('reachCardTitle')}
            </h3>
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
          {tiers.length > 0 && (
            <span
              className="whitespace-nowrap text-[9.5px] uppercase tracking-[0.06em]"
              style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}
            >
              {td('reachCompletionMeta')}
            </span>
          )}
        </div>

        {tiers.length === 0 ? (
          <div
            className="grid place-items-center text-[12px]"
            style={{ color: 'var(--text-3)', minHeight: 90 }}
          >
            {td('reachEmpty')}
          </div>
        ) : (
          <ul className="m-0 flex flex-col gap-2.5 p-0" style={{ listStyle: 'none' }}>
            {tiers.map(t => {
              const status = statusFor(t.plan, t.fact);
              const planPct = (t.plan / max) * 100;
              const factPct = (t.fact / max) * 100;
              // % выполнения: how much of plan the fact covers (200% for 20/10, 10% for 1/10).
              const completionPct = t.plan > 0 ? Math.round((t.fact / t.plan) * 100) : 0;
              const srStatus = status === 'over'
                ? td('reachAboveLabel')
                : status === 'under'
                ? td('reachBelowLabel')
                : td('reachOnPlanLabel');

              return (
                <li
                  key={t.frequency}
                  className="grid items-center gap-2.5"
                  style={{ gridTemplateColumns: '32px 1fr auto auto' }}
                >
                  <span
                    className="rounded-[5px] px-1.5 py-1 text-center text-[12px] font-semibold tabular-nums"
                    style={{
                      background: 'var(--surface-2)',
                      color: 'var(--text)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {t.frequency}+
                  </span>

                  <div
                    className="relative h-[26px] overflow-hidden rounded-[6px]"
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
                    className="min-w-[48px] text-right text-[12px] font-semibold tabular-nums"
                    style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
                  >
                    {fmtNumber(t.fact)}
                  </span>

                  <span
                    className="min-w-[48px] rounded-[4px] px-1.5 py-0.5 text-right text-[11px] font-semibold tabular-nums"
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
      </motion.button>

      <AnimatePresence>
        {open && (
          <ReachModal
            key={campaignId}
            campaignId={campaignId}
            rows={rows}
            audience={audience}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
