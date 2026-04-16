'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
}

export function CampaignSelector({
  campaigns,
  currentId,
  locale,
}: {
  campaigns: Campaign[];
  currentId: string;
  locale: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = campaigns.find(c => c.id === currentId);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('campaign', e.target.value);
    router.push(`/${locale}/dashboard?${params.toString()}`);
    router.refresh();
  }

  return (
    <div className="relative">
      <select
        value={currentId}
        onChange={handleChange}
        className="appearance-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] py-1.5 pl-3 pr-8 text-[13px] transition-colors hover:border-[var(--border-hi)] focus:border-[var(--border-em)] focus:outline-none"
      >
        {campaigns.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
    </div>
  );
}
