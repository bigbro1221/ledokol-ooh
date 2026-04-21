'use client';

import { useState, useTransition } from 'react';
import { type DateFormat, DATE_FORMAT_OPTIONS, formatCampaignPeriod } from '@/lib/format-period';

interface Props {
  initialFormat: DateFormat;
  locale: string;
}

// Fixed example dates for preview (July 2025 — same-month, clearly illustrates single-month formats)
const EXAMPLE_START = new Date(2025, 6, 1);
const EXAMPLE_END = new Date(2025, 6, 31);

export function DateFormatPicker({ initialFormat, locale }: Props) {
  const [selected, setSelected] = useState<DateFormat>(initialFormat);
  const [, startTransition] = useTransition();

  function handleSelect(fmt: DateFormat) {
    setSelected(fmt);
    startTransition(async () => {
      await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateFormat: fmt.toUpperCase().replace(/-/g, '_') }),
      });
    });
  }

  function getLabel(opt: (typeof DATE_FORMAT_OPTIONS)[0]): string {
    if (locale === 'en') return opt.labelEn;
    if (locale === 'uz') return opt.labelUz;
    return opt.labelRu;
  }

  return (
    <div className="flex flex-col gap-2">
      {DATE_FORMAT_OPTIONS.map((opt) => {
        const isSelected = selected === opt.value;
        const preview = formatCampaignPeriod(EXAMPLE_START, EXAMPLE_END, locale, opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className={`flex items-center justify-between rounded-[var(--radius-md)] border px-4 py-3 text-left transition-colors ${
              isSelected
                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-subtle)]'
                : 'border-[var(--border)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <div>
              <div className="text-[14px] font-medium">{getLabel(opt)}</div>
              <div
                className="mt-0.5 text-[12px] text-[var(--text-3)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {preview}
              </div>
            </div>
            {isSelected && (
              <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--brand-primary)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
