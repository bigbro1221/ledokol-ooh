'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReachRow } from '@/lib/reach';

interface Props {
  campaignId: string;
  rows: ReachRow[];
  onClose: () => void;
}

const morphTransition = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };

function fmt(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

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
        className="relative max-h-[85vh] w-[min(90vw,520px)] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.12, duration: 0.22 } }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          className="max-h-[85vh] overflow-y-auto p-6"
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
          <h2 className="text-[22px] font-medium tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {td('reachCardTitle')}
          </h2>
          <div className="mt-5 space-y-1.5">
            {sorted.map(r => (
              <div
                key={r.id}
                className="grid grid-cols-[60px_1fr_1fr] items-baseline gap-3 rounded-[var(--radius-sm)] py-2"
              >
                <div className="text-[14px] font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                  {r.n}+
                </div>
                <div className="text-[13px]">
                  <span className="mr-1.5 text-[10px] uppercase tracking-[0.06em] text-[var(--text-3)]">
                    {td('reachPlanLabel')}
                  </span>
                  <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{fmt(r.plan)}</span>
                </div>
                <div className="text-[13px]">
                  <span className="mr-1.5 text-[10px] uppercase tracking-[0.06em] text-[var(--text-3)]">
                    {td('reachFactLabel')}
                  </span>
                  <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{fmt(r.fact)}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
