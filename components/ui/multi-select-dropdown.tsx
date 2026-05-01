'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  allLabel: string;
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  width?: number;
}

export function MultiSelectDropdown({
  label, allLabel, options, selected, onChange, width = 240,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function toggle(val: string) {
    if (selected.includes(val)) onChange(selected.filter(v => v !== val));
    else onChange([...selected, val]);
  }

  function summary(): string {
    if (selected.length === 0) return allLabel;
    const labels = selected
      .map(v => options.find(o => o.value === v)?.label)
      .filter((x): x is string => !!x);
    if (labels.length <= 2) return labels.join(', ');
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
  }

  return (
    <div
      ref={ref}
      className="relative inline-block w-full xs:w-[var(--ms-width)]"
      style={{ ['--ms-width' as string]: `${width}px` } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={`${label}: ${summary()}`}
        className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[13px] text-[var(--text-2)] transition-colors hover:border-[var(--border-hi)] focus:border-[var(--border-em)] focus:outline-none"
      >
        <span className="min-w-0 flex-1 truncate text-left">
          <span className="text-[var(--text-3)]">{label}: </span>
          <span className="text-[var(--text)]">{summary()}</span>
        </span>
        <ChevronDown size={14} strokeWidth={1.5} className="flex-shrink-0 text-[var(--text-3)]" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
          <ul className="max-h-[280px] min-w-[200px] overflow-y-auto py-1">
            <li>
              <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-[var(--text)] hover:bg-[var(--surface-2)]">
                <input
                  type="checkbox"
                  checked={selected.length === 0}
                  onChange={() => onChange([])}
                  className="h-3.5 w-3.5 cursor-pointer accent-[var(--brand-primary)]"
                />
                <span className="truncate">{allLabel}</span>
              </label>
            </li>
            {options.map(opt => {
              const isOn = selected.includes(opt.value);
              return (
                <li key={opt.value}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-[var(--text)] hover:bg-[var(--surface-2)]">
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => toggle(opt.value)}
                      className="h-3.5 w-3.5 cursor-pointer accent-[var(--brand-primary)]"
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
