'use client';

import { useEffect, useState } from 'react';
import { Layers, X } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

export interface PeriodSummary {
  id: string;
  name: string;
  periodStart: string;   // ISO
  periodEnd: string;     // ISO
  otsPlan: number;
  otsFact: number;
  screensCount: number;
}

interface Props {
  totalScreens: number;
  periodSummaries: PeriodSummary[];
  label: string;
}

/**
 * Surfaces KPI card on the campaign detail page. Click → modal listing per-period
 * aggregates so admins can audit how impressions were distributed across the
 * campaign without navigating into the screen table.
 */
export function ScreensCard({ totalScreens, periodSummaries, label }: Props) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const fmtLocale = locale === 'en' ? 'en-US' : locale === 'uz' ? 'uz-UZ' : 'ru-RU';
  const [open, setOpen] = useState(false);

  const fmtNum = (n: number) => n.toLocaleString(fmtLocale);
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(fmtLocale);

  // Esc to close + body scroll lock while modal is open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

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
        <div className="mt-1 text-2xl font-semibold">{totalScreens}</div>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-3xl overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center gap-2">
                <Layers size={16} strokeWidth={1.5} className="text-[var(--brand-primary)]" />
                <h3 className="text-[15px] font-semibold tracking-tight">{t('screensByPeriodTitle')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('close')}
                className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-[var(--surface-2)]">
                  <tr>
                    <th className="border-b border-[var(--border)] px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                      {t('screensByPeriodPeriod')}
                    </th>
                    <th className="border-b border-[var(--border)] px-4 py-2.5 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                      {t('screensByPeriodScreens')}
                    </th>
                    <th className="border-b border-[var(--border)] px-4 py-2.5 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                      {t('screensByPeriodOtsPlan')}
                    </th>
                    <th className="border-b border-[var(--border)] px-4 py-2.5 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">
                      {t('screensByPeriodOtsFact')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {periodSummaries.map(p => (
                    <tr key={p.id} className="hover:bg-[var(--surface-2)]">
                      <td className="border-b border-[var(--border)] px-4 py-2.5">
                        <div className="font-medium text-[var(--text)]">{p.name}</div>
                        <div className="text-[11px] text-[var(--text-3)]">
                          {fmtDate(p.periodStart)} — {fmtDate(p.periodEnd)}
                        </div>
                      </td>
                      <td className="border-b border-[var(--border)] px-4 py-2.5 text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                        {p.screensCount}
                      </td>
                      <td className="border-b border-[var(--border)] px-4 py-2.5 text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                        {p.otsPlan > 0 ? fmtNum(p.otsPlan) : '—'}
                      </td>
                      <td className="border-b border-[var(--border)] px-4 py-2.5 text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                        {p.otsFact > 0 ? fmtNum(p.otsFact) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
