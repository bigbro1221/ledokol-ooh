'use client';

import { useState } from 'react';
import { Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PeriodSummariesModal, type PeriodSummary } from './period-summaries-modal';

interface Props {
  periodCount: number;
  periodSummaries: PeriodSummary[];
  label: string;
}

/**
 * Periods KPI card on the campaign detail page. Click → period drill-down
 * modal (same modal the Surfaces card opens). Shown when the campaign is
 * splitByPeriods.
 */
export function PeriodsCard({ periodCount, periodSummaries, label }: Props) {
  const t = useTranslations('admin');
  const [open, setOpen] = useState(false);
  const hasPeriodData = periodSummaries.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => hasPeriodData && setOpen(true)}
        disabled={!hasPeriodData}
        aria-label={hasPeriodData ? t('screensByPeriodOpen') : undefined}
        className={`w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition-colors ${
          hasPeriodData ? 'cursor-pointer hover:border-[var(--brand-primary)] hover:bg-[var(--surface-2)]' : 'cursor-default'
        }`}
      >
        <div className="text-xs text-[var(--text-3)]">{label}</div>
        <div className="mt-1 flex items-center gap-2">
          <Layers size={18} className="text-[var(--brand-primary)]" strokeWidth={1.5} />
          <span className="text-2xl font-semibold">{periodCount}</span>
        </div>
      </button>

      <PeriodSummariesModal
        open={open}
        onClose={() => setOpen(false)}
        periodSummaries={periodSummaries}
      />
    </>
  );
}
