'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

type Gradient = 'default' | 'warm' | 'cyan' | 'blue' | 'orange' | 'green';

function shortNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  if (!Number.isInteger(n)) return n.toFixed(0);
  return n.toString();
}

function computeAvgImpressionsPerDay(
  totalOtsFact: number,
  totalOtsPlan: number,
  periodStart: string,
  periodEnd: string,
  status: string,
): number | null {
  const totalOts = totalOtsFact > 0 ? totalOtsFact : totalOtsPlan;
  if (totalOts === 0) return null;

  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const today = new Date();
  const MS_PER_DAY = 86_400_000;

  if (status === 'COMPLETED' || today > end) {
    const totalDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
    return Math.round(totalOts / Math.max(1, totalDays));
  }
  // ACTIVE / PAUSED — use elapsed days up to today
  const effectiveEnd = today < end ? today : end;
  const elapsedDays = Math.max(1, Math.round((effectiveEnd.getTime() - start.getTime()) / MS_PER_DAY));
  return Math.round(totalOts / elapsedDays);
}

interface Props {
  totalBudget: number;
  // Same number minus VAT — used by the CPT факт cell only. CPM/avg-budget
  // continue to use totalBudget for backward consistency.
  totalBudgetWithoutVat: number;
  totalOtsPlan: number;
  totalOtsFact: number;
  totalRatingFact: number;
  totalScreens: number;
  periodStart: string;
  periodEnd: string;
  status: string;
  locale?: string;
  currency?: string;
}

function GradientText({ children, gradient }: { children: ReactNode; gradient: Gradient }) {
  return (
    <span
      style={{
        backgroundImage: `var(--es-grad-${gradient})`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
      }}
    >
      {children}
    </span>
  );
}

export function EfficiencyStrip({
  totalBudget, totalBudgetWithoutVat,
  totalOtsPlan, totalOtsFact, totalRatingFact, totalScreens,
  periodStart, periodEnd, status,
  currency = 'UZS',
}: Props) {
  const t = useTranslations('charts');
  const cpmPlan = totalBudget > 0 && totalOtsPlan > 0
    ? totalBudget / (totalOtsPlan / 1000)
    : null;
  const cpmFact = totalBudget > 0 && totalOtsFact > 0
    ? totalBudget / (totalOtsFact / 1000)
    : null;
  const avgOtsPerScreen = totalScreens > 0 && totalOtsPlan > 0
    ? totalOtsPlan / totalScreens
    : null;
  // CPT факт = amount without VAT ÷ Σ ratingFact. Hides when either side is 0.
  const cptFact = totalBudgetWithoutVat > 0 && totalRatingFact > 0
    ? totalBudgetWithoutVat / totalRatingFact
    : null;
  const avgImpressions = computeAvgImpressionsPerDay(
    totalOtsFact, totalOtsPlan, periodStart, periodEnd, status,
  );

  type Cell = { label: string; value: string; gradient: Gradient; sub?: string };
  const cells: Cell[] = [];
  if (cpmPlan !== null) cells.push({
    label: t('cpmPlan'),
    value: shortNumber(cpmPlan),
    gradient: 'default',
    sub: `${currency} ${t('cpmPlanUnit')}`,
  });
  if (cpmFact !== null) cells.push({
    label: t('cpmFact'),
    value: shortNumber(cpmFact),
    gradient: 'default',
    sub: `${currency} ${t('cpmFactUnit')}`,
  });
  if (avgOtsPerScreen !== null) cells.push({
    label: t('avgOts'),
    value: shortNumber(avgOtsPerScreen),
    gradient: 'warm',
    sub: t('avgOtsUnit'),
  });
  if (cptFact !== null) cells.push({
    label: t('cptFact'),
    value: shortNumber(cptFact),
    gradient: 'default',
    sub: `${currency} ${t('cptFactUnit')}`,
  });
  if (avgImpressions !== null) cells.push({
    label: t('avgImpressionsShort'),
    value: avgImpressions.toLocaleString('ru-RU'),
    gradient: 'default',
    sub: t('impressionsPerDayUnit'),
  });

  if (cells.length === 0) return null;

  const colClass = cells.length <= 3
    ? 'grid-cols-2 sm:grid-cols-3'
    : cells.length === 4
    ? 'grid-cols-2 sm:grid-cols-4'
    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5';

  return (
    <div className={`grid gap-2 ${colClass}`}>
      {cells.map((c, i) => (
        // Label and sub render plain white; only the numeric value gets the
        // metric's gradient (warm on the middle Avg OTS card, blue elsewhere).
        <div
          key={i}
          className="rounded-[14px] p-5 sm:p-6"
          style={{
            background: 'var(--es-card-bg)',
            border: '1px solid var(--es-card-border)',
          }}
        >
          <div className="text-[13px] font-normal" style={{ color: 'var(--es-label)' }}>
            {c.label}
          </div>
          <div
            className="mt-3 text-[36px] font-semibold leading-none tracking-tight sm:text-[40px]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <GradientText gradient={c.gradient}>{c.value}</GradientText>
          </div>
          {c.sub && (
            <div className="mt-2 text-[12px]" style={{ color: 'var(--es-sub)' }}>
              {c.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
