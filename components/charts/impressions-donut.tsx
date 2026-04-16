'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const CHART_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)',
  'var(--chart-7)', 'var(--chart-8)',
];

interface DonutEntry {
  name: string;
  value: number;
}

export function ImpressionsDonut({ data, total }: { data: DonutEntry[]; total: number }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-6">
        <h3 className="text-[15px] font-semibold tracking-tight">Показы по типам</h3>
        <p className="mt-0.5 text-xs text-[var(--text-3)]">Распределение OTS по типу поверхности</p>
      </div>
      <div className="flex items-center gap-8">
        <div className="relative h-[180px] w-[180px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => Number(value).toLocaleString('ru-RU')}
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
            <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">Всего</span>
            <span className="text-lg font-semibold">{total.toLocaleString('ru-RU')}</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2.5">
          {data.map((entry, i) => {
            const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
            return (
              <div key={entry.name} className="flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 transition-colors hover:bg-[var(--surface-2)]">
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px]"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="flex-1 text-xs text-[var(--text-2)]">{entry.name}</span>
                <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  {entry.value.toLocaleString('ru-RU')}
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
