'use client';

import { useTranslations } from 'next-intl';

export function BudgetBar({ total, spent, currency = 'UZS' }: { total: number; spent: number; currency?: string }) {
  const t = useTranslations('charts');
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;

  return (
    /* mobile: <640px — 16px padding, desktop 24px */
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold tracking-tight">{t('campaignBudgetTitle')}</h3>
      </div>
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-[24px] font-semibold tracking-tight sm:text-[28px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {pct.toFixed(0)}%
          </span>
          <span className="ml-1 text-sm text-[var(--text-3)]">{t('campaignBudgetUsed')}</span>
        </div>
        <div className="text-[11px] text-[var(--text-3)] sm:text-right sm:text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
          {formatBudget(spent)} / {formatBudget(total)} {currency}
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct > 90 ? 'var(--danger)' : pct > 70 ? 'var(--warning)' : 'var(--brand-primary)',
          }}
        />
      </div>
    </div>
  );
}

function formatBudget(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  return n.toLocaleString('ru-RU');
}
