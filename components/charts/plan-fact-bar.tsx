'use client';

import { useTranslations } from 'next-intl';

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('ru-RU');
}

interface PlanFactBarProps {
  plan: number;
  fact: number;
}

export function PlanFactBar({ plan, fact }: PlanFactBarProps) {
  const t = useTranslations('charts');
  const hasFact = fact > 0;
  const pct = plan > 0 && hasFact ? (fact / plan) * 100 : null;
  const fillPct = pct !== null ? Math.min(pct, 100) : 0;

  // Color based on completion
  const color =
    pct === null ? 'var(--text-4)'
    : pct >= 100 ? 'var(--success)'
    : pct >= 80  ? 'var(--warning)'
    :              'var(--danger)';

  const trendLabel =
    pct === null         ? t('planCompletionNoFact')
    : pct >= 100         ? t('planCompletionAbove')
    : pct >= 80          ? t('planCompletionInProgress')
    :                      t('planCompletionBelow');

  const delta = fact - plan;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold tracking-tight">{t('planCompletionTitle')}</h3>
        {pct !== null && (
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em]"
            style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
          >
            {trendLabel}
          </span>
        )}
      </div>

      {/* Big number */}
      <div className="mb-3 flex items-end gap-2">
        <span
          className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]"
          style={{ fontVariantNumeric: 'tabular-nums', color: pct !== null ? color : 'var(--text-3)' }}
        >
          {pct !== null ? `${pct.toFixed(0)}%` : '—'}
        </span>
        <span className="mb-1 text-sm text-[var(--text-3)]">OTS</span>
      </div>

      {/* Track */}
      <div className="mb-4 h-3 overflow-hidden rounded-full bg-[var(--surface-3)]">
        {hasFact ? (
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${fillPct}%`, background: color }}
          />
        ) : (
          /* Stripped / empty state */
          <div className="h-full w-full rounded-full opacity-30"
            style={{ background: 'repeating-linear-gradient(90deg, var(--border) 0px, var(--border) 6px, transparent 6px, transparent 12px)' }}
          />
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center" style={{ fontFamily: 'var(--font-mono)' }}>
        <div>
          <div className="text-[11px] text-[var(--text-4)] uppercase tracking-[0.06em]">{t('plan')}</div>
          <div className="text-[13px] font-medium text-[var(--text)]">
            {plan > 0 ? fmt(plan) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[var(--text-4)] uppercase tracking-[0.06em]">{t('fact')}</div>
          <div className="text-[13px] font-medium" style={{ color: hasFact ? color : 'var(--text-3)' }}>
            {hasFact ? fmt(fact) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[var(--text-4)] uppercase tracking-[0.06em]">{t('delta')}</div>
          <div
            className="text-[13px] font-medium"
            style={{
              color: !hasFact ? 'var(--text-3)'
                : delta >= 0 ? 'var(--success)'
                : 'var(--danger)',
            }}
          >
            {hasFact ? `${delta >= 0 ? '+' : ''}${fmt(delta)}` : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}
