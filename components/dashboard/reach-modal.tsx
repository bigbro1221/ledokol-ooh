'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReachRow } from '@/lib/reach';
import { ReachRowDisplay } from './reach-row-display';

interface Props {
  campaignId: string;
  rows: ReachRow[];
  onClose: () => void;
}

const morphTransition = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };

export function ReachModal({ campaignId, rows, onClose }: Props) {
  const td = useTranslations('dashboard');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLButtonElement>('[data-close]')?.focus();
  }, []);

  const sorted = [...rows].sort((a, b) => a.n - b.n);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={td('reachCardTitle')}
        layoutId={`reach-${campaignId}`}
        transition={morphTransition}
        style={{
          background: 'var(--es-card-bg)',
          border: '1px solid var(--es-card-border)',
        }}
        className="relative max-h-[85vh] w-[min(90vw,640px)] overflow-hidden rounded-[14px] shadow-2xl"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.12, duration: 0.22 } }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          className="max-h-[85vh] overflow-y-auto p-6 sm:p-7"
        >
          <button
            type="button"
            data-close
            aria-label={td('reachModalClose')}
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
          <div className="text-[13px] font-normal" style={{ color: 'var(--es-label)' }}>
            {td('reachCardTitle')}
          </div>
          <div className="mt-3">
            {sorted.map((r, i) => (
              <ReachRowDisplay
                key={r.id}
                row={r}
                planLabel={td('reachPlanLabel')}
                factLabel={td('reachFactLabel')}
                withTopBorder={i > 0}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
