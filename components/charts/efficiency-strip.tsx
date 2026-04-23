'use client';

import { useTranslations } from 'next-intl';

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  if (!Number.isInteger(n)) return n.toFixed(0);
  return n.toLocaleString('ru-RU');
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
  totalOtsPlan: number;
  totalOtsFact: number;
  totalScreens: number;
  periodStart: string;
  periodEnd: string;
  status: string;
  locale?: string;
  currency?: string;
}

export function EfficiencyStrip({
  totalBudget, totalOtsPlan, totalOtsFact, totalScreens,
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
  const avgBudgetPerScreen = totalScreens > 0 && totalBudget > 0
    ? totalBudget / totalScreens
    : null;
  const avgImpressions = computeAvgImpressionsPerDay(
    totalOtsFact, totalOtsPlan, periodStart, periodEnd, status,
  );

  const cells: { label: string; value: string; sub?: string }[] = [];
  if (cpmPlan !== null) cells.push({ label: t('cpmPlan'), value: fmt(cpmPlan), sub: `${currency} ${t('cpmPlanUnit')}` });
  if (cpmFact !== null) cells.push({ label: t('cpmFact'), value: fmt(cpmFact), sub: `${currency} ${t('cpmFactUnit')}` });
  if (avgOtsPerScreen !== null) cells.push({ label: t('avgOts'), value: fmt(avgOtsPerScreen), sub: t('avgOtsUnit') });
  if (avgBudgetPerScreen !== null) cells.push({ label: t('avgBudget'), value: fmt(avgBudgetPerScreen), sub: `${currency} ${t('avgBudgetUnit')}` });
  if (avgImpressions !== null) cells.push({
    label: t('avgImpressionsShort'),
    value: avgImpressions.toLocaleString('ru-RU'),
    sub: t('impressionsPerDayUnit'),
  });

  if (cells.length === 0) return null;

  const colClass = cells.length <= 3
    ? 'grid-cols-2 sm:grid-cols-3'
    : cells.length === 4
    ? 'grid-cols-2 sm:grid-cols-4'
    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5';

  return (
    <div className={`grid gap-px overflow-hidden rounded-[var(--radius-lg)] bg-[var(--border)] outline outline-1 outline-[var(--border)] ${colClass}`}>
      {cells.map((c, i) => (
          <div key={i} className="bg-[var(--surface)] p-4 sm:p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]">
              {c.label}
            </div>
            <div
              className="mt-1 text-[20px] font-semibold leading-tight tracking-tight sm:text-[22px]"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {c.value}
            </div>
            {c.sub && (
              <div className="mt-0.5 text-[10px] text-[var(--text-4)]" style={{ fontFamily: 'var(--font-mono)' }}>
                {c.sub}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
