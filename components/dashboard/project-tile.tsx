'use client';

import { Folder } from 'lucide-react';

interface Props {
  name: string;
  childCount: number;
  childCountLabel: string;
  onOpen: () => void;
}

export function ProjectTile({ name, childCount, childCountLabel, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition-all hover:border-[var(--border-hi)] hover:shadow-[var(--shadow-md)]"
    >
      <div className="flex items-center gap-2">
        <Folder size={16} strokeWidth={1.75} className="text-[var(--text-3)]" />
        <h3 className="text-[16px] font-semibold tracking-tight text-[var(--text)] group-hover:text-[var(--brand-primary)]">
          {name}
        </h3>
      </div>
      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]">
          {childCountLabel}
        </p>
        <p className="mt-0.5 text-[15px] font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
          {childCount.toLocaleString('ru-RU')}
        </p>
      </div>
    </button>
  );
}
