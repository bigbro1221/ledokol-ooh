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
  screens: number;
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

const MONTH_BY_INDEX = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

const MONTH_FULL_BY_INDEX = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  январь: 0, февраль: 1, март: 2, апрель: 3, май: 4, июнь: 5,
  июль: 6, август: 7, сентябрь: 8, октябрь: 9, ноябрь: 10, декабрь: 11,
};

function labelMonthKey(label: string): string | null {
  const trimmed = label.trim();
  const monthNameMatch = trimmed.toLowerCase().match(/^(\S+)\s+(\d{4})/);
  if (monthNameMatch && MONTH_NAME_TO_INDEX[monthNameMatch[1]] !== undefined) {
    return `${monthNameMatch[2]}-${MONTH_NAME_TO_INDEX[monthNameMatch[1]]}`;
  }
  const dateMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dateMatch) {
    return `${dateMatch[3]}-${Number(dateMatch[2]) - 1}`;
  }
  return null;
}

function formatDateRange(name: string): string {
  const m = name.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[-–—]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return name;
  const [, sd, sm, , ed, em] = m;
  const startDay = Number(sd);
  const startMonth = Number(sm);
  const endDay = Number(ed);
  const endMonth = Number(em);
  const startMonthName = MONTH_BY_INDEX[startMonth - 1] ?? sm;
  const endMonthName = MONTH_BY_INDEX[endMonth - 1] ?? em;
  if (startMonth === endMonth) {
    return `${startDay}–${endDay} ${startMonthName}`;
  }
  return `${startDay} ${startMonthName} – ${endDay} ${endMonthName}`;
}

/**
 * Build a "this month appears in multiple years" lookup. Used to decide
 * whether the X-axis tick can collapse to just "Май" or needs the year
 * suffix ("Май '25" / "Май '26") to keep ticks unique — otherwise recharts'
 * label-based tooltip lookup grabs the first matching bar.
 */
function buildYearSuffixSet(allLabels: string[]): Set<number> {
  const monthYears = new Map<number, Set<number>>();
  for (const label of allLabels) {
    const key = labelMonthKey(label);
    if (!key) continue;
    const [yearStr, monthIdxStr] = key.split('-');
    const monthIdx = Number(monthIdxStr);
    const year = Number(yearStr);
    if (!monthYears.has(monthIdx)) monthYears.set(monthIdx, new Set());
    monthYears.get(monthIdx)!.add(year);
  }
  const needsYear = new Set<number>();
  monthYears.forEach((years, monthIdx) => {
    if (years.size > 1) needsYear.add(monthIdx);
  });
  return needsYear;
}

function shortLabel(name: string, monthCounts: Map<string, number>, monthsNeedingYear: Set<number>): string {
  const trimmed = name.trim();
  const fullMatch = trimmed.toLowerCase().match(/^(\S+)\s+(\d{4})/);
  if (fullMatch && MONTH_NAME_TO_INDEX[fullMatch[1]] !== undefined) {
    const monthIdx = MONTH_NAME_TO_INDEX[fullMatch[1]];
    const short = MONTH_BY_INDEX[monthIdx];
    if (monthsNeedingYear.has(monthIdx)) {
      return `${short} '${fullMatch[2].slice(2)}`;
    }
    return short;
  }
  const key = labelMonthKey(name);
  if (key && monthCounts.get(key) === 1) {
    const [yearStr, monthIdxStr] = key.split('-');
    const monthIdx = Number(monthIdxStr);
    const short = MONTH_BY_INDEX[monthIdx] ?? name.slice(0, 3);
    if (monthsNeedingYear.has(monthIdx)) {
      return `${short} '${yearStr.slice(2)}`;
    }
    return short;
  }
  return formatDateRange(name);
}

function fullLabelFor(name: string, monthCounts: Map<string, number>): string {
  const first = name.trim().toLowerCase().split(' ')[0];
  if (MONTH_NAME_TO_INDEX[first] !== undefined) return name;
  const key = labelMonthKey(name);
  if (key && monthCounts.get(key) === 1) {
    const [year, monthIdx] = key.split('-');
    const monthName = MONTH_FULL_BY_INDEX[Number(monthIdx)];
    if (monthName) return `${monthName} ${year}`;
  }
  return name;
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

  const monthCounts = new Map<string, number>();
  for (const label of allLabels) {
    const key = labelMonthKey(label);
    if (key) monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const monthsNeedingYear = buildYearSuffixSet(allLabels);

  // Chart data: aggregate all cities or just selected. For screens we count
  // distinct surface IDs across the source rows — but the upstream `months`
  // shape already pre-deduplicates per city, so summing across cities
  // double-counts only when the same surface lives in two cities (unusual).
  const chartData = allLabels.map(label => {
    const sources = selectedCity
      ? data.filter(d => d.city === selectedCity)
      : data;
    let plan = 0;
    let fact = 0;
    let screens = 0;
    for (const d of sources) {
      const m = d.months.find(m => m.label === label);
      if (!m) continue;
      plan += m.plan;
      fact += m.fact;
      screens += m.screens;
    }
    return {
      label: shortLabel(label, monthCounts, monthsNeedingYear),
      fullLabel: fullLabelFor(label, monthCounts),
      plan,
      fact,
      screens,
    };
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
        {entry && entry.screens > 0 && (
          <div className="mt-1 flex items-center gap-2 border-t border-[var(--border)] pt-1.5">
            <span className="h-2 w-2 rounded-full bg-transparent" />
            <span className="text-[var(--text-2)]">{tc('surfaces')}:</span>
            <span className="font-medium text-[var(--text)]" style={{ fontFamily: 'var(--font-mono)' }}>{entry.screens}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
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
