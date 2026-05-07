'use client';

import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface DraftRow {
  key: string;       // local React key (uuid-like)
  n: string;         // input value, validated to int
  plan: string;      // input value (optional float)
  fact: string;      // input value (optional float)
}

interface ServerRow {
  id: string;
  n: number;
  plan: number | null;
  fact: number | null;
}

interface Props {
  campaignId: string;
  open: boolean;
  onClose: () => void;
}

const MAX_ROWS = 30;

function newKey(): string {
  return `r${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function rowFromServer(s: ServerRow): DraftRow {
  return {
    key: s.id,
    n: String(s.n),
    plan: s.plan != null ? String(s.plan) : '',
    fact: s.fact != null ? String(s.fact) : '',
  };
}

export function ReachDataModal({ campaignId, open, onClose }: Props) {
  const t = useTranslations('admin');
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esc dismiss + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Fetch on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/campaigns/${campaignId}/reach`)
      .then(r => (r.ok ? r.json() : Promise.reject(`Error ${r.status}`)))
      .then((data: ServerRow[]) => setRows(data.map(rowFromServer)))
      .catch(err => setError(typeof err === 'string' ? err : 'Network error'))
      .finally(() => setLoading(false));
  }, [open, campaignId]);

  if (!open) return null;

  // Duplicate-n detection (parsed integers only)
  const ns = rows
    .map(r => Number.parseInt(r.n, 10))
    .filter(v => Number.isInteger(v) && v >= 1);
  const dupN = new Set<number>();
  const seen = new Set<number>();
  for (const v of ns) {
    if (seen.has(v)) dupN.add(v);
    seen.add(v);
  }

  const isRowValid = (r: DraftRow) => {
    const n = Number.parseInt(r.n, 10);
    if (!Number.isInteger(n) || n < 1 || n > 99) return false;
    if (dupN.has(n)) return false;
    if (r.plan && Number.isNaN(Number(r.plan))) return false;
    if (r.fact && Number.isNaN(Number(r.fact))) return false;
    return true;
  };
  const allValid = rows.every(isRowValid);
  const canAdd = rows.length < MAX_ROWS;
  const canSave = !saving && !loading && allValid;

  function addRow() {
    const maxN = rows.reduce((max, r) => {
      const v = Number.parseInt(r.n, 10);
      return Number.isInteger(v) && v > max ? v : max;
    }, 0);
    const nextN = Math.min(99, maxN + 1);
    setRows(prev => [...prev, { key: newKey(), n: String(nextN), plan: '', fact: '' }]);
  }

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  }

  function deleteRow(key: string) {
    setRows(prev => prev.filter(r => r.key !== key));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        entries: rows.map(r => ({
          n: Number.parseInt(r.n, 10),
          plan: r.plan ? Number(r.plan) : null,
          fact: r.fact ? Number(r.fact) : null,
        })),
      };
      const res = await fetch(`/api/campaigns/${campaignId}/reach`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `Error ${res.status}`);
        return;
      }
      onClose();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-[15px] font-semibold tracking-tight">{t('reachModalTitle')}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5">
          {loading ? (
            <p className="py-6 text-center text-sm text-[var(--text-3)]">…</p>
          ) : (
            <>
              {/* Header */}
              <div className="mb-2 grid grid-cols-[64px_1fr_1fr_36px] gap-2 px-1 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]">
                <div>{t('reachColumnReach')}</div>
                <div>{t('reachColumnPlan')}</div>
                <div>{t('reachColumnFact')}</div>
                <div />
              </div>
              <div className="space-y-2">
                {rows.map(r => {
                  const nVal = Number.parseInt(r.n, 10);
                  const isDup = Number.isInteger(nVal) && dupN.has(nVal);
                  return (
                    <div key={r.key} className="grid grid-cols-[64px_1fr_1fr_36px] items-center gap-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          step={1}
                          value={r.n}
                          onChange={e => updateRow(r.key, { n: e.target.value })}
                          className={`w-12 rounded-[var(--radius-sm)] border bg-[var(--surface-2)] px-2 py-1.5 text-sm tabular-nums ${isDup ? 'border-[var(--danger)]' : 'border-[var(--border)]'}`}
                        />
                        <span className="text-[var(--text-3)]">+</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={r.plan}
                        onChange={e => updateRow(r.key, { plan: e.target.value })}
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm tabular-nums"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={r.fact}
                        onChange={e => updateRow(r.key, { fact: e.target.value })}
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm tabular-nums"
                      />
                      <button
                        type="button"
                        aria-label={t('reachDeleteRow')}
                        onClick={() => deleteRow(r.key)}
                        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  );
                })}
              </div>
              {dupN.size > 0 && (
                <p className="mt-3 text-[12px] text-[var(--danger)]">{t('reachDuplicateN')}</p>
              )}
              <button
                type="button"
                disabled={!canAdd}
                onClick={addRow}
                className="mt-4 w-full rounded-[var(--radius-md)] border border-dashed border-[var(--border)] py-2 text-[12px] text-[var(--text-3)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {canAdd ? t('reachAddRow') : t('reachMaxRows')}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          {error && <span className="mr-auto text-[12px] text-[var(--danger)]">{error}</span>}
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-[13px] hover:bg-[var(--surface-2)]"
          >
            {t('reachCancel')}
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-1.5 text-[13px] font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('reachSave')}
          </button>
        </div>
      </div>
    </div>
  );
}
