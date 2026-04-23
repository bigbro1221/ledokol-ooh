'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useTranslations } from 'next-intl';

const CHART_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)',
  'var(--chart-7)', 'var(--chart-8)',
];

function fmtBudget(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString('ru-RU');
}

interface Entry {
  name: string;
  value: number;
  count?: number;
}

export function BudgetByType({ data, total, currency = 'UZS' }: { data: Entry[]; total: number; currency?: string }) {
  const t = useTranslations('charts');
  if (data.length === 0 || total === 0) return null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-6">
        <h3 className="text-[15px] font-semibold tracking-tight">{t('budgetByTypeTitle')}</h3>
        <p className="mt-0.5 text-xs text-[var(--text-3)]">{t('budgetByTypeSubtitle')}</p>
      </div>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
        <div className="relative h-[180px] w-[180px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={80}
                paddingAngle={2} dataKey="value" strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `${fmtBudget(Number(value))} ${currency}`}
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  fontSize: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">{t('total')}</span>
            <span className="text-lg font-semibold">{fmtBudget(total)}</span>
            <span className="text-[10px] text-[var(--text-3)]">{currency}</span>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2.5 sm:flex-1">
          {data.map((entry, i) => {
            const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
            return (
              <div key={entry.name} className="flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 transition-colors hover:bg-[var(--surface-2)]">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="flex-1 text-xs text-[var(--text-2)]">
                  {entry.name}{entry.count != null ? ` (${entry.count})` : ''}
                </span>
                <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtBudget(entry.value)}
                </span>
                <span className="w-[42px] text-right text-[11px] text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
