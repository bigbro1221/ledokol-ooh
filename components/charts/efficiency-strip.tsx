'use client';

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  if (!Number.isInteger(n)) return n.toFixed(0);
  return n.toLocaleString('ru-RU');
}

interface Props {
  totalBudget: number;
  totalOtsPlan: number;
  totalOtsFact: number;
  totalScreens: number;
  totalCities: number;
  currency?: string;
}

export function EfficiencyStrip({ totalBudget, totalOtsPlan, totalOtsFact, totalScreens, totalCities, currency = 'UZS' }: Props) {
  // CPM (plan): cost per 1000 planned impressions
  const cpmPlan = totalBudget > 0 && totalOtsPlan > 0
    ? totalBudget / (totalOtsPlan / 1000)
    : null;

  // CPM (fact): cost per 1000 delivered impressions
  const cpmFact = totalBudget > 0 && totalOtsFact > 0
    ? totalBudget / (totalOtsFact / 1000)
    : null;

  const avgOtsPerScreen = totalScreens > 0 && totalOtsPlan > 0
    ? totalOtsPlan / totalScreens
    : null;

  const avgBudgetPerScreen = totalScreens > 0 && totalBudget > 0
    ? totalBudget / totalScreens
    : null;

  const cells: { label: string; value: string; sub?: string }[] = [];
  if (cpmPlan !== null) {
    cells.push({
      label: 'CPM план',
      value: fmt(cpmPlan),
      sub: `${currency} / 1000 показов`,
    });
  }
  if (cpmFact !== null) {
    cells.push({
      label: 'CPM факт',
      value: fmt(cpmFact),
      sub: `${currency} / 1000 факт.`,
    });
  }
  if (avgOtsPerScreen !== null) {
    cells.push({
      label: 'Средн. OTS',
      value: fmt(avgOtsPerScreen),
      sub: 'на поверхность',
    });
  }
  if (avgBudgetPerScreen !== null) {
    cells.push({
      label: 'Средн. бюджет',
      value: fmt(avgBudgetPerScreen),
      sub: `${currency} / поверхность`,
    });
  }
  cells.push({
    label: 'География',
    value: String(totalCities),
    sub: totalCities === 1 ? 'город' : 'городов',
  });

  if (cells.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="grid grid-cols-2 divide-x divide-y divide-[var(--border)] sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5">
        {cells.map((c, i) => (
          <div key={i} className="p-4 sm:p-5">
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
    </div>
  );
}
