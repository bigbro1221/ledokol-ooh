'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { pickRepresentative, type ReachRow } from '@/lib/reach';
import { ReachModal } from './reach-modal';

interface Props {
  campaignId: string;
  rows: ReachRow[];
}

const morphTransition = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };

function fmt(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

export function ReachCard({ campaignId, rows }: Props) {
  const td = useTranslations('dashboard');
  const [open, setOpen] = useState(false);

  if (rows.length === 0) return null;
  const peek = pickRepresentative(rows);

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        layoutId={`reach-${campaignId}`}
        transition={morphTransition}
        style={{ visibility: open ? 'hidden' : 'visible' }}
        className="mb-6 block w-full rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition-all hover:border-[var(--border-hi)] hover:shadow-[var(--shadow-md)]"
      >
        <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]">
          {td('reachCardTitle')}
        </div>
        <div className="space-y-1.5">
          {peek.map(r => (
            <div
              key={r.id}
              className="grid grid-cols-[60px_1fr_1fr] items-baseline gap-3"
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
      </motion.button>

      <AnimatePresence>
        {open && (
          <ReachModal
            key={campaignId}
            campaignId={campaignId}
            rows={rows}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
