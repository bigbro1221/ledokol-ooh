'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useTranslations } from 'next-intl';

interface DayEntry {
  date: string;
  impressions: number;
}

export function ImpressionsArea({ data }: { data: DayEntry[] }) {
  const t = useTranslations('charts');
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-6">
        <h3 className="text-[15px] font-semibold tracking-tight">{t('impressionsDailyTitle')}</h3>
        <p className="mt-0.5 text-xs text-[var(--text-3)]">{t('impressionsDailySubtitle')}</p>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="impressionsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="0" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              width={40}
            />
            <Tooltip
              formatter={(value) => [Number(value).toLocaleString('ru-RU'), t('impressions')]}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                fontSize: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="impressions"
              stroke="var(--brand-primary)"
              strokeWidth={2}
              fill="url(#impressionsGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
