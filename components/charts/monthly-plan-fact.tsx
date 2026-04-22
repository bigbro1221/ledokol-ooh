'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { useTranslations } from 'next-intl';

export interface MonthData {
  label: string;
  plan: number;
  fact: number;
}

export interface CityMonthlyData {
  city: string;
  months: MonthData[];
}

const MONTH_SHORT: Record<string, string> = {
  январь: 'Янв', февраль: 'Фев', март: 'Мар', апрель: 'Апр',
  май: 'Май', июнь: 'Июн', июль: 'Июл', август: 'Авг',
  сентябрь: 'Сен', октябрь: 'Окт', ноябрь: 'Ноя', декабрь: 'Дек',
};

function shortLabel(name: string): string {
  const first = name.trim().toLowerCase().split(' ')[0];
  return MONTH_SHORT[first] ?? name.slice(0, 3);
}

function fmtTick(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

function fmtFull(v: number): string {
  return v.toLocaleString('ru-RU');
}

interface Props {
  data: CityMonthlyData[];
}

export function MonthlyPlanFact({ data }: Props) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const tc = useTranslations('charts');
  const tf = useTranslations('filters');

  // All unique period labels in their original order (first city's order is canonical)
  const allLabels = data[0]?.months.map(m => m.label) ?? [];

  // Chart data: aggregate all cities or just selected
  const chartData = allLabels.map(label => {
    const sources = selectedCity
      ? data.filter(d => d.city === selectedCity)
      : data;
    const plan = sources.reduce((s, d) => s + (d.months.find(m => m.label === label)?.plan ?? 0), 0);
    const fact = sources.reduce((s, d) => s + (d.months.find(m => m.label === label)?.fact ?? 0), 0);
    return { label: shortLabel(label), fullLabel: label, plan, fact };
  });

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    const entry = chartData.find(d => d.label === label);
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg text-xs">
        <p className="mb-2 font-medium text-[var(--text)]">{entry?.fullLabel ?? label}</p>
        {payload.map(p => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-[var(--text-2)]">{p.name}:</span>
            <span className="font-medium text-[var(--text)]" style={{ fontFamily: 'var(--font-mono)' }}>{fmtFull(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5">
      {/* City filter pills */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedCity(null)}
          className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
            selectedCity === null
              ? 'bg-[var(--brand-primary)] text-white'
              : 'border border-[var(--border)] text-[var(--text-2)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'
          }`}
        >
          {tf('allCities')}
        </button>
        {data.map(d => (
          <button
            key={d.city}
            onClick={() => setSelectedCity(prev => prev === d.city ? null : d.city)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
              selectedCity === d.city
                ? 'bg-[var(--brand-primary)] text-white'
                : 'border border-[var(--border)] text-[var(--text-2)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'
            }`}
          >
            {d.city}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} barGap={3} barCategoryGap="35%" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--text-3)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-3)' }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={fmtTick}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-2)', radius: 4 }} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'var(--text-3)', paddingTop: 12 }}
            formatter={(value) => <span style={{ color: 'var(--text-2)' }}>{value}</span>}
          />
          <Bar dataKey="fact" name={tc('fact')} fill="#3B82F6" radius={[3, 3, 0, 0]} maxBarSize={40} />
          <Bar dataKey="plan" name={tc('plan')} fill="#94A3B8" radius={[3, 3, 0, 0]} maxBarSize={40} fillOpacity={0.7} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
