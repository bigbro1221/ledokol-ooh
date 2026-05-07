'use client';

import type { CSSProperties } from 'react';
import type { ReachRow } from '@/lib/reach';

const gradientStyle: CSSProperties = {
  backgroundImage: 'var(--es-grad-default)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
};

function fmt(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

interface Props {
  row: ReachRow;
  planLabel: string;
  factLabel: string;
  withTopBorder: boolean;
}

export function ReachRowDisplay({ row, planLabel, factLabel, withTopBorder }: Props) {
  return (
    <div
      className="grid grid-cols-[64px_1fr_1px_1fr] items-center gap-4 py-4 sm:gap-6"
      style={withTopBorder ? { borderTop: '1px solid var(--es-card-border)' } : undefined}
    >
      <div
        className="text-[26px] font-semibold leading-none tracking-tight tabular-nums sm:text-[30px]"
        style={gradientStyle}
      >
        {row.n}+
      </div>
      <div className="text-center">
        <div
          className="text-[10px] font-medium uppercase tracking-[0.08em]"
          style={{ color: 'var(--es-label)', opacity: 0.6 }}
        >
          {planLabel}
        </div>
        <div
          className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight tabular-nums sm:text-[34px]"
          style={gradientStyle}
        >
          {fmt(row.plan)}
        </div>
      </div>
      <div className="h-12 w-px self-center" style={{ background: 'var(--es-card-border)' }} />
      <div className="text-center">
        <div
          className="text-[10px] font-medium uppercase tracking-[0.08em]"
          style={{ color: 'var(--es-label)', opacity: 0.6 }}
        >
          {factLabel}
        </div>
        <div
          className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight tabular-nums sm:text-[34px]"
          style={gradientStyle}
        >
          {fmt(row.fact)}
        </div>
      </div>
    </div>
  );
}
