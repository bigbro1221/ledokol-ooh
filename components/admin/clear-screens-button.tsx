'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eraser } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function ClearScreensButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const tc = useTranslations('common');
  const td = useTranslations('delete');
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function handleClear() {
    setClearing(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/screens`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
        setConfirming(false);
      } else {
        alert(td('errorClearing'));
      }
    } finally {
      setClearing(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-3)]">{td('confirmScreens')}</span>
        <button
          onClick={handleClear}
          disabled={clearing}
          className="rounded-[var(--radius-sm)] bg-[var(--danger)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {clearing ? tc('deleting') : td('confirmOk')}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-2)]"
        >
          {tc('cancel')}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-3)] transition-colors hover:border-[var(--warning)] hover:text-[var(--warning)]"
    >
      <Eraser size={13} strokeWidth={1.5} />
      {td('clearData')}
    </button>
  );
}
