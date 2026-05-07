'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { type DateFormat, formatCampaignPeriod } from '@/lib/format-period';

interface Campaign {
  id: string;
  name: string;
  status: string;
  periodStart: string;
  periodEnd: string;
}

function campaignLabel(c: Campaign, dateFormat: DateFormat, locale: string): string {
  if (c.periodStart && c.periodEnd) {
    const start = new Date(c.periodStart);
    const end = new Date(c.periodEnd);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return `${c.name}. ${formatCampaignPeriod(start, end, locale, dateFormat)}`;
    }
  }
  return c.name;
}

function startMs(c: Campaign): number {
  const t = new Date(c.periodStart).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function CampaignSelector({
  campaigns,
  currentId,
  locale,
  dateFormat = 'smart_hybrid',
}: {
  campaigns: Campaign[];
  currentId: string;
  locale: string;
  dateFormat?: DateFormat;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('campaign', e.target.value);
    router.push(`/${locale}/dashboard?${params.toString()}`);
    router.refresh();
  }

  // Flat list, sorted by periodStart desc. The caller supplies whatever
  // subset is appropriate (e.g. siblings within the current project).
  const sorted = [...campaigns].sort((a, b) => startMs(b) - startMs(a));

  return (
    <div className="relative w-full sm:w-auto">
      <select
        value={currentId}
        onChange={handleChange}
        className="w-full min-h-[44px] appearance-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] py-2 pl-3 pr-8 text-[13px] transition-colors hover:border-[var(--border-hi)] focus:border-[var(--border-em)] focus:outline-none sm:w-auto sm:min-h-0 sm:py-1.5"
      >
        {sorted.map(c => (
          <option key={c.id} value={c.id}>{campaignLabel(c, dateFormat, locale)}</option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
    </div>
  );
}
