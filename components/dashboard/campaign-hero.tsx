'use client';

import { CreativesCard, type CreativeView } from '@/components/dashboard/creatives-card';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-[rgba(16,185,129,0.12)] text-[var(--success)]',
  PAUSED: 'bg-[rgba(234,179,8,0.12)] text-[var(--warning)]',
  COMPLETED: 'bg-[var(--surface-3)] text-[var(--text-3)]',
  DRAFT: 'bg-[var(--surface-3)] text-[var(--text-3)]',
};

interface StatTile {
  value: string;
  label: string;
  unit?: string;
}

interface Props {
  eyebrow: string;
  title: string;
  status: string;
  statusLabel: string;
  stats: StatTile[];
  creatives: CreativeView[];
  creativesTitle: string;
  creativesSubtitle: string;
}

export function CampaignHero({
  eyebrow, title, status, statusLabel, stats, creatives,
  creativesTitle, creativesSubtitle,
}: Props) {
  const showCreatives = creatives.length > 0;

  return (
    <div className="mb-6">
      <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
        <div className={`relative grid grid-cols-1 ${showCreatives ? 'lg:grid-cols-2' : ''}`}>
          {showCreatives && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-[15%] bottom-[15%] hidden w-px bg-[var(--border)] lg:block"
            />
          )}
          <div className="flex min-w-0 flex-col p-5 sm:p-7 lg:pr-14">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]">
                {eyebrow}
              </p>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] ${STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT}`}
              >
                {status === 'ACTIVE' && <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />}
                {statusLabel}
              </span>
            </div>

            <h1
              className="mt-2.5 mb-4 text-[20px] font-medium leading-[1.15] tracking-tight sm:text-[24px] lg:mb-0 lg:text-[30px]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {title}
            </h1>

            <div className="mt-auto inline-flex w-full self-center overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] sm:w-auto lg:self-start">
              {stats.map((s, i) => (
                <div
                  key={i}
                  className={`relative flex flex-1 flex-col items-center justify-center px-3 py-4 sm:min-w-[150px] sm:flex-none sm:px-5 sm:py-3 ${
                    i > 0
                      ? "before:absolute before:left-0 before:top-[10%] before:bottom-[10%] before:w-px before:bg-[var(--border)] before:content-['']"
                      : ''
                  }`}
                >
                  <div
                    className="text-[22px] font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-[22px]"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {s.value}
                    {s.unit && (
                      <span className="ml-1 text-[12px] font-normal text-[var(--text-3)]">
                        {s.unit}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-center text-[12px] text-[var(--text-3)] sm:mt-0.5 sm:text-[11px]">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {showCreatives && (
            <div className="flex min-w-0 flex-col p-5 sm:p-7 lg:pl-14">
              <p className="text-[14px] font-semibold tracking-tight">{creativesTitle}</p>
              <p className="mt-0.5 text-xs text-[var(--text-3)]">{creativesSubtitle}</p>
              <div className="mt-auto min-w-0 pt-3">
                <CreativesCard creatives={creatives} embedded />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
