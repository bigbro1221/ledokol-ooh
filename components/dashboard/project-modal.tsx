'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CampaignTile, type CampaignTileData } from './campaign-tile';
import { type DateFormat } from '@/lib/format-period';

interface Props {
  projectName: string;
  children: CampaignTileData[];
  locale: string;
  dateFormat: DateFormat;
  statusLabelFor: (status: string) => string;
  screensLabel: string;
  onClose: () => void;
}

export function ProjectModal({
  projectName, children, locale, dateFormat,
  statusLabelFor, screensLabel, onClose,
}: Props) {
  const tc = useTranslations('campaignsPage');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Esc dismiss
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus trap — confine Tab/Shift+Tab to dialog
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Focus trap entry — focus the close button on mount
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLButtonElement>('[data-close]')?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={projectName}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      style={{ animation: 'projectModalBackdrop 220ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      <style>{`
        @keyframes projectModalBackdrop { from { opacity: 0 } to { opacity: 1 } }
        @keyframes projectModalPanel {
          from { opacity: 0; transform: scale(0.92) }
          to   { opacity: 1; transform: scale(1) }
        }
      `}</style>
      <div
        ref={dialogRef}
        className="relative max-h-[85vh] w-[min(90vw,720px)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
        style={{ animation: 'projectModalPanel 220ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
      >
        <button
          type="button"
          data-close
          aria-label={tc('projectModalClose')}
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
        <h2 className="text-[22px] font-medium tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {projectName}
        </h2>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          {tc('projectChildCount', { count: children.length })}
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {children.length === 0 ? (
            <p className="col-span-full py-8 text-center text-sm text-[var(--text-3)]">
              {tc('projectEmpty')}
            </p>
          ) : (
            children.map(c => (
              <CampaignTile
                key={c.id}
                campaign={c}
                href={`/${locale}/dashboard?campaign=${c.id}`}
                locale={locale}
                dateFormat={dateFormat}
                statusLabel={statusLabelFor(c.status)}
                screensLabel={screensLabel}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
