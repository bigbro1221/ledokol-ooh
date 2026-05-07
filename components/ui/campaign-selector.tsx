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
  groupId: string | null;
  groupName: string | null;
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

  // Partition projects vs ungrouped, then build a single date-sorted list
  // where each item is either a top-level <option> or an <optgroup> with its
  // own children. Project anchor = max(child.periodStart). Children inside
  // each project also sort by periodStart desc.
  const byGroup = new Map<string, { name: string; items: Campaign[] }>();
  const ungrouped: Campaign[] = [];
  for (const c of campaigns) {
    if (c.groupId && c.groupName) {
      const slot = byGroup.get(c.groupId);
      if (slot) slot.items.push(c);
      else byGroup.set(c.groupId, { name: c.groupName, items: [c] });
    } else {
      ungrouped.push(c);
    }
  }

  type Item =
    | { kind: 'project'; id: string; name: string; items: Campaign[]; anchor: number }
    | { kind: 'campaign'; c: Campaign; anchor: number };

  const items: Item[] = [
    ...Array.from(byGroup.entries()).map(([id, { name, items: children }]) => {
      const sorted = [...children].sort((a, b) => startMs(b) - startMs(a));
      const anchor = sorted.reduce((max, c) => Math.max(max, startMs(c)), 0);
      return { kind: 'project' as const, id, name, items: sorted, anchor };
    }),
    ...ungrouped.map(c => ({ kind: 'campaign' as const, c, anchor: startMs(c) })),
  ].sort((a, b) => b.anchor - a.anchor);

  return (
    <div className="relative w-full sm:w-auto">
      <select
        value={currentId}
        onChange={handleChange}
        className="w-full min-h-[44px] appearance-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] py-2 pl-3 pr-8 text-[13px] transition-colors hover:border-[var(--border-hi)] focus:border-[var(--border-em)] focus:outline-none sm:w-auto sm:min-h-0 sm:py-1.5"
      >
        {items.map(item => item.kind === 'project' ? (
          <optgroup key={item.id} label={item.name}>
            {item.items.map(c => (
              <option key={c.id} value={c.id}>{campaignLabel(c, dateFormat, locale)}</option>
            ))}
          </optgroup>
        ) : (
          <option key={item.c.id} value={item.c.id}>{campaignLabel(item.c, dateFormat, locale)}</option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
    </div>
  );
}
