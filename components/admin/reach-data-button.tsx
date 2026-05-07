'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Target } from 'lucide-react';
import { ReachDataModal } from './reach-data-modal';

interface Props {
  campaignId: string;
}

export function ReachDataButton({ campaignId }: Props) {
  const t = useTranslations('admin');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)]"
      >
        <Target size={13} strokeWidth={1.5} /> {t('reachButton')}
      </button>
      <ReachDataModal campaignId={campaignId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
