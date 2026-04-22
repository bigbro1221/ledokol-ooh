'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';

interface ScreenEntry {
  address: string;
  ots: number;
}

const LABEL_WIDTH = 260;
const MAX_CHARS = 30;

function YTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const raw = payload?.value ?? '';
  const label = raw.length > MAX_CHARS ? raw.slice(0, MAX_CHARS) + '…' : raw;
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fill="var(--text-2)"
      fontSize={11}
    >
      {label}
    </text>
  );
}

export function TopScreensBar({ data }: { data: ScreenEntry[] }) {
  const t = useTranslations('charts');
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-6">
        <h3 className="text-[15px] font-semibold tracking-tight">{t('topScreensTitle')}</h3>
        <p className="mt-0.5 text-xs text-[var(--text-3)]">{t('topScreensSubtitle')}</p>
      </div>
      <div style={{ height: Math.max(300, data.length * 28) }}>
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
              tick={<YTick />}
              axisLine={false}
              tickLine={false}
              width={LABEL_WIDTH}
              interval={0}
            />
            <Tooltip
              formatter={(value) => [Number(value).toLocaleString('ru-RU'), t('ots')]}
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
