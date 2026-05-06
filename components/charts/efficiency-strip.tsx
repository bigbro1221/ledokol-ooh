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

interface Props {
  totalBudget: number;
  // Same number minus VAT — used by the CPT факт cell only. CPM/avg-budget
  // continue to use totalBudget for backward consistency.
  totalBudgetWithoutVat: number;
  totalOtsPlan: number;
  totalOtsFact: number;
  totalRatingFact: number;
  // Average daily plays per screen — (Σ Screen.impressionsPerDay) divided
  // by the count of filtered screens with a non-zero value. Null for
  // OTHER_CARRIERS (no per-screen impressions data); the cell hides.
  avgImpressionsPerDay: number | null;
  totalScreens: number;
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
  totalOtsPlan, totalOtsFact, totalRatingFact, avgImpressionsPerDay, totalScreens,
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
  // Average "Прогнозное кол-во выходов в сутки" per screen. OTHER_CARRIERS
  // sends null → cell hidden.
  const avgImpressions = avgImpressionsPerDay && avgImpressionsPerDay > 0
    ? avgImpressionsPerDay
    : null;

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
