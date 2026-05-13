'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileDown, Loader2 } from 'lucide-react';

export function ExportToPdfButton({ campaignId }: { campaignId: string }) {
  const t = useTranslations('pdf');
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/pdf`, { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error === 'pdf_render_timeout') alert(t('exportTimeout'));
        else alert(t('exportError'));
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const filename = cd.match(/filename="([^"]+)"/)?.[1] ?? `campaign-${campaignId}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert(t('exportError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-[13px] text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
    >
      {loading
        ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
        : <FileDown size={14} strokeWidth={1.5} />}
      {loading ? t('exporting') : t('exportButton')}
    </button>
  );
}
