'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function DeleteCampaignButton({ campaignId, locale }: { campaignId: string; locale: string }) {
  const router = useRouter();
  const tc = useTranslations('common');
  const td = useTranslations('delete');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
    if (res.ok) {
      router.push(`/${locale}/admin/campaigns`);
      router.refresh();
    } else {
      setDeleting(false);
      setConfirming(false);
      alert(td('errorTitle'));
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-3)]">{td('confirmCampaign')}</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-[var(--radius-sm)] bg-[var(--danger)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {deleting ? tc('deleting') : tc('confirmDelete')}
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
      className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-3)] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)]"
    >
      <Trash2 size={13} strokeWidth={1.5} />
      {tc('delete')}
    </button>
  );
}
