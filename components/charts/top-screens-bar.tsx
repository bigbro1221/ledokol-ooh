'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ScreenEntry {
  address: string;
  ots: number;
}

export function TopScreensBar({ data }: { data: ScreenEntry[] }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-6">
        <h3 className="text-[15px] font-semibold tracking-tight">Показы по поверхностям</h3>
        <p className="mt-0.5 text-xs text-[var(--text-3)]">Топ-20 поверхностей по OTS</p>
      </div>
      <div className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
            />
            <YAxis
              dataKey="address"
              type="category"
              tick={{ fontSize: 11, fill: 'var(--text-2)' }}
              axisLine={false}
              tickLine={false}
              width={220}
              tickFormatter={(v: string) => v.length > 34 ? v.slice(0, 34) + '…' : v}
            />
            <Tooltip
              formatter={(value) => [Number(value).toLocaleString('ru-RU'), 'OTS']}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="ots" fill="var(--chart-2)" radius={[0, 3, 3, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
