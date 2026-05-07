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
  // Used by the CPT факт cell.
  totalBudgetWithoutVat: number;
  totalOtsPlan: number;
  totalRatingFact: number;
  // Average daily plays per screen — (Σ Screen.impressionsPerDay) divided
  // by the count of filtered screens with a non-zero value. Null for
  // OTHER_CARRIERS (no per-screen impressions data); the cell hides.
  avgImpressionsPerDay: number | null;
  totalScreens: number;
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
  totalBudgetWithoutVat,
  totalOtsPlan, totalRatingFact, avgImpressionsPerDay, totalScreens,
  currency = 'UZS',
}: Props) {
  const t = useTranslations('charts');
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

  // Match column count to actual cell count so cards fill the row regardless
  // of campaign type (OTHER_CARRIERS hides avg impressions → 2 cells; SCREENS
  // typically has 3).
  const colClass = (() => {
    switch (cells.length) {
      case 1: return 'grid-cols-1';
      case 2: return 'grid-cols-1 sm:grid-cols-2';
      case 3: return 'grid-cols-2 sm:grid-cols-3';
      case 4: return 'grid-cols-2 sm:grid-cols-4';
      default: return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5';
    }
  })();

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
          <div className="text-[18px] font-semibold tracking-tight" style={{ color: 'var(--es-label)' }}>
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
