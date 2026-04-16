'use client';

import type { ReactNode } from 'react';

interface KPICardProps {
  label: string;
  value: string;
  unit?: string;
  trend?: { label: string; direction: 'up' | 'down' | 'neutral' };
  icon: ReactNode;
  delay?: number;
}

export function KPICard({ label, value, unit, trend, icon, delay = 0 }: KPICardProps) {
  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 transition-all duration-200 hover:border-[var(--border-hi)] hover:shadow-[var(--shadow-sm)]"
      style={{
        animation: `fadeInUp 500ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms both`,
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]">
          {label}
        </span>
        <span className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[var(--text-3)]">
          {icon}
        </span>
      </div>
      <div className="mb-1.5 text-[32px] font-semibold leading-tight tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-[var(--text-3)]">{unit}</span>}
      </div>
      {trend && (
        <div
          className="flex items-center gap-1 text-xs"
          style={{
            fontFamily: 'var(--font-mono)',
            color: trend.direction === 'up' ? 'var(--success)' : trend.direction === 'down' ? 'var(--danger)' : 'var(--text-3)',
          }}
        >
          {trend.direction === 'up' && '↑ '}
          {trend.direction === 'down' && '↓ '}
          {trend.label}
        </div>
      )}
    </div>
  );
}
