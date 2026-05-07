'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('dashboard');

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('campaign', e.target.value);
    router.push(`/${locale}/dashboard?${params.toString()}`);
    router.refresh();
  }

  // Partition: grouped campaigns by group, ungrouped flat
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
  const groupArr = Array.from(byGroup.entries())
    .map(([id, { name, items }]) => ({ id, name, items }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const hasGroups = groupArr.length > 0;

  return (
    <div className="relative w-full sm:w-auto">
      <select
        value={currentId}
        onChange={handleChange}
        className="w-full min-h-[44px] appearance-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] py-2 pl-3 pr-8 text-[13px] transition-colors hover:border-[var(--border-hi)] focus:border-[var(--border-em)] focus:outline-none sm:w-auto sm:min-h-0 sm:py-1.5"
      >
        {hasGroups ? (
          <>
            {groupArr.map(g => (
              <optgroup key={g.id} label={g.name}>
                {g.items.map(c => (
                  <option key={c.id} value={c.id}>{campaignLabel(c, dateFormat, locale)}</option>
                ))}
              </optgroup>
            ))}
            {ungrouped.length > 0 && (
              <optgroup label={t('selectorUngrouped')}>
                {ungrouped.map(c => (
                  <option key={c.id} value={c.id}>{campaignLabel(c, dateFormat, locale)}</option>
                ))}
              </optgroup>
            )}
          </>
        ) : (
          campaigns.map(c => (
            <option key={c.id} value={c.id}>{campaignLabel(c, dateFormat, locale)}</option>
          ))
        )}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
    </div>
  );
}
