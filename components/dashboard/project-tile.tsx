'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Folder, Expand } from 'lucide-react';

interface ChildItem {
  id: string;
  name: string;
  href: string;
}

interface Props {
  id: string;
  name: string;
  childCount: number;
  childCountLabel: string;
  childItems: ChildItem[];
  expandLabel: string;
  isExpanded: boolean;
  onOpen: () => void;
}

const morphTransition = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };

export function ProjectTile({
  id, name, childCount, childCountLabel, childItems, expandLabel, isExpanded, onOpen,
}: Props) {
  return (
    <motion.div
      layoutId={`project-${id}`}
      transition={morphTransition}
      // Hide the source tile while its modal is open so framer-motion's morph
      // doesn't double-render it. Visibility (not display) keeps the layout
      // measurement intact for the return animation.
      style={{ visibility: isExpanded ? 'hidden' : 'visible' }}
      className="group relative rounded-[var(--radius-lg)] border border-[var(--border)] border-l-2 border-l-[var(--brand-primary)] bg-[var(--surface)] transition-all hover:border-[var(--border-hi)] hover:border-l-[var(--brand-primary)] hover:shadow-[var(--shadow-md)]"
    >
      {/* Layer A — at-rest content. Click anywhere on the tile body opens the modal. */}
      <button
        type="button"
        onClick={onOpen}
        className="block w-full origin-top-left p-5 text-left transition-all duration-200 ease-out group-hover:pointer-events-none group-hover:scale-95 group-hover:opacity-0"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--brand-primary-subtle)]">
            <Folder size={14} strokeWidth={2} className="text-[var(--brand-primary)]" />
          </span>
          <h3 className="text-[18px] font-semibold tracking-tight text-[var(--text)]">
            {name}
          </h3>
        </div>
        {/* Spacer matching the period subtitle line in CampaignTile so the divider aligns across tiles. */}
        <p aria-hidden="true" className="mt-1 text-[13px] invisible" style={{ fontFamily: 'var(--font-mono)' }}>
          &nbsp;
        </p>
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]">
            {childCountLabel}
          </p>
          <p className="mt-1 text-[18px] font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
            {childCount.toLocaleString('ru-RU')}
          </p>
        </div>
      </button>

      {/* Layer B — clickable campaign list + corner Expand button. Same scale+fade animation as Layer A. */}
      <div
        onClick={onOpen}
        className="absolute inset-0 origin-top-left scale-105 opacity-0 pointer-events-none cursor-pointer transition-all duration-200 ease-out group-hover:scale-100 group-hover:opacity-100 group-hover:pointer-events-auto"
      >
        <button
          type="button"
          aria-label={expandLabel}
          onClick={e => { e.stopPropagation(); onOpen(); }}
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
        >
          <Expand size={13} strokeWidth={2} />
        </button>
        <ul
          className="h-full space-y-1.5 overflow-y-auto py-5 pl-5 pr-12 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {childItems.map(c => (
            <li key={c.id} className="truncate text-[14px]">
              <Link
                href={c.href}
                onClick={e => e.stopPropagation()}
                className="text-[var(--text-2)] transition-colors hover:text-[var(--brand-primary)]"
              >
                <span className="mr-1.5 text-[var(--brand-primary)]">·</span>
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
