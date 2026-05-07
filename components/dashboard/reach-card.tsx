'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Expand } from 'lucide-react';
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

interface Props {
  campaignId: string;
  rows: ReachRow[];
  audience: string | null;
}

export function ReachCard({ campaignId, rows, audience }: Props) {
  const td = useTranslations('dashboard');
  const [open, setOpen] = useState(false);
  const [cardWidth, setCardWidth] = useState<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Only pinned rows render on the dashboard. If none are pinned the whole
  // card is suppressed — even with an audience set.
  const pinnedRows = rows.filter(r => r.pinned);
  if (pinnedRows.length === 0) return null;

  // The modal shows ALL rows. If every row is already pinned the modal would
  // mirror the card 1:1 — skip the click + hide the affordances.
  const canExpand = rows.length > pinnedRows.length;

  function handleOpen() {
    if (!canExpand) return;
    const w = buttonRef.current?.getBoundingClientRect().width;
    if (w && w > 0) setCardWidth(Math.round(w));
    setOpen(true);
  }

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
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
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
        }}
        className={`block w-full rounded-[14px] border border-[var(--es-card-border)] p-5 text-left transition-colors duration-200 sm:p-6 ${canExpand ? 'cursor-pointer hover:border-[var(--border-hi)]' : 'cursor-default'}`}
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
          {/* Click affordance — only when the modal would actually show extra rows. */}
          {canExpand && (
            <Expand
              size={13}
              strokeWidth={2}
              style={{ color: 'var(--es-label)' }}
              aria-hidden="true"
            />
          )}
        </div>

        {tiers.length === 0 ? (
          <div
            className="grid place-items-center text-[12px]"
            style={{ color: 'var(--es-text-3)', minHeight: 90 }}
          >
            {td('reachEmpty')}
          </div>
        ) : (
          <>
            <ul className="m-0 flex flex-col gap-2.5 p-0" style={{ listStyle: 'none' }}>
              {tiers.map(t => {
                const status = statusFor(t.plan, t.fact);
                const planPct = (t.plan / max) * 100;
                const factPct = (t.fact / max) * 100;
                const completionPct = t.plan > 0 ? Math.round((t.fact / t.plan) * 100) : null;

                return (
                  <li
                    key={t.frequency}
                    className="grid items-center gap-2.5"
                    style={{ gridTemplateColumns: '32px 1fr auto' }}
                  >
                    <span
                      className="rounded-[5px] px-1.5 py-1 text-center text-[12px] font-semibold tabular-nums"
                      style={{
                        background: 'var(--es-card-trough)',
                        color: 'var(--es-text)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {t.frequency}+
                    </span>

                    <div
                      className="relative h-[26px] overflow-hidden rounded-[6px]"
                      style={{ background: 'var(--es-card-trough)' }}
                      role="img"
                      aria-label={`${t.frequency}+ план ${fmtNumber(t.plan)}, факт ${fmtNumber(t.fact)}`}
                    >
                      {/* Plan track — solid neutral, width relative to max */}
                      <div
                        className="absolute inset-y-0 left-0 rounded-[6px]"
                        style={{
                          width: `${planPct}%`,
                          background: 'var(--es-card-edge)',
                        }}
                      />
                      {/* Fact overlay — status-coloured, width relative to max
                          (so over-delivery extends past the plan track edge) */}
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
                      className="flex shrink-0 items-center gap-3 text-[12px]"
                      style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
                    >
                      <span
                        className="w-12 text-right font-semibold"
                        style={{ color: 'var(--es-text-3)' }}
                      >
                        {fmtNumber(t.plan)}
                      </span>
                      <span
                        className="w-12 text-right font-semibold"
                        style={{ color: STATUS_TEXT[status] }}
                      >
                        {fmtNumber(t.fact)}
                      </span>
                      <span
                        className="w-12 text-right font-semibold"
                        style={{ color: STATUS_TEXT[status] }}
                      >
                        {completionPct !== null ? `${completionPct}%` : '—'}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Column headers — sit under the rows so the user can map values back to plan vs fact at a glance. */}
            <div
              className="mt-3 flex justify-end gap-3 text-[10px] uppercase tracking-[0.06em]"
              style={{ color: 'var(--es-text-3)', fontFamily: 'var(--font-mono)' }}
            >
              <span className="w-12 text-right">{td('reachPlanLabel')}</span>
              <span className="w-12 text-right">{td('reachFactLabel')}</span>
              <span className="w-12 text-right">%</span>
            </div>
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <ReachModal
            key={campaignId}
            campaignId={campaignId}
            rows={rows}
            audience={audience}
            cardWidth={cardWidth}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
