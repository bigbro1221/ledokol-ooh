'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { pickRepresentative, type ReachRow } from '@/lib/reach';
import { ReachModal } from './reach-modal';

const morphTransition = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };

const gradientStyle: React.CSSProperties = {
  backgroundImage: 'var(--es-grad-default)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
};

function fmt(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

interface Props {
  campaignId: string;
  rows: ReachRow[];
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
        style={{
          visibility: open ? 'hidden' : 'visible',
          background: 'var(--es-card-bg)',
          border: '1px solid var(--es-card-border)',
        }}
        className="block w-full rounded-[14px] p-5 text-left transition-shadow hover:shadow-[var(--shadow-md)] sm:p-6"
      >
        <div className="text-[13px] font-normal" style={{ color: 'var(--es-label)' }}>
          {td('reachCardTitle')}
        </div>
        <div className="mt-2.5 grid grid-cols-[auto_1fr_1fr] items-baseline gap-x-3 gap-y-1.5">
          <div />
          <div
            className="text-center text-[10px] font-medium uppercase tracking-[0.08em]"
            style={{ color: 'var(--es-label)', opacity: 0.6 }}
          >
            {td('reachPlanLabel')}
          </div>
          <div
            className="text-center text-[10px] font-medium uppercase tracking-[0.08em]"
            style={{ color: 'var(--es-label)', opacity: 0.6 }}
          >
            {td('reachFactLabel')}
          </div>

          {peek.map(r => (
            <div key={r.id} className="contents">
              <div
                className="text-[18px] font-semibold tracking-tight tabular-nums sm:text-[20px]"
                style={gradientStyle}
              >
                {r.n}+
              </div>
              <div
                className="text-center text-[20px] font-semibold leading-none tracking-tight tabular-nums sm:text-[24px]"
                style={gradientStyle}
              >
                {fmt(r.plan)}
              </div>
              <div
                className="text-center text-[20px] font-semibold leading-none tracking-tight tabular-nums sm:text-[24px]"
                style={gradientStyle}
              >
                {fmt(r.fact)}
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
