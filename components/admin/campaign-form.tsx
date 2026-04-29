'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface CampaignFormProps {
  locale: string;
  clients: { id: string; name: string }[];
  initial?: {
    id: string;
    name: string;
    clientId: string;
    periodStart: string;
    periodEnd: string;
    splitByPeriods: boolean;
    heatmapUrl?: string | null;
    yandexMapUrl?: string | null;
    reportsUrl?: string | null;
    acRate?: string | null;
  };
}

interface DraftState {
  name: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  splitByPeriods: boolean;
  heatmapUrl: string;
  yandexMapUrl: string;
  reportsUrl: string;
  acRate: string;
}

const DRAFT_KEY = 'ledokol_campaign_draft';

function loadDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as DraftState) : null;
  } catch {
    return null;
  }
}

function saveDraft(state: DraftState) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch {}
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

export function CampaignForm({ locale, clients, initial }: CampaignFormProps) {
  const router = useRouter();
  const tc = useTranslations('common');
  const tf = useTranslations('forms');
  const isEdit = !!initial;

  // All controlled state — seeded from initial (edit) or draft (new)
  const [name, setName] = useState(initial?.name ?? '');
  const [clientId, setClientId] = useState(initial?.clientId ?? '');
  const [periodStart, setPeriodStart] = useState(initial?.periodStart ?? '');
  const [periodEnd, setPeriodEnd] = useState(initial?.periodEnd ?? '');
  const [splitByPeriods, setSplitByPeriods] = useState(initial?.splitByPeriods ?? false);
  const [heatmapUrl, setHeatmapUrl] = useState(initial?.heatmapUrl ?? '');
  const [yandexMapUrl, setYandexMapUrl] = useState(initial?.yandexMapUrl ?? '');
  const [reportsUrl, setReportsUrl] = useState(initial?.reportsUrl ?? '');
  const [acRate, setAcRate] = useState(initial?.acRate ?? '');

  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = useCallback((value: string, field: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  }, []);
  const [error, setError] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);

  // Load draft on mount (new campaigns only)
  useEffect(() => {
    if (isEdit) return;
    const draft = loadDraft();
    if (draft) {
      setName(draft.name);
      setClientId(draft.clientId);
      setPeriodStart(draft.periodStart);
      setPeriodEnd(draft.periodEnd);
      setSplitByPeriods(draft.splitByPeriods);
      setHeatmapUrl(draft.heatmapUrl);
      setYandexMapUrl(draft.yandexMapUrl);
      setReportsUrl(draft.reportsUrl ?? '');
      setAcRate(draft.acRate ?? '');
      if (draft.name || draft.clientId) setDraftRestored(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft on every change (new campaigns only).
  // Skip the very first run: on initial render both effects fire in order,
  // and this effect would capture the pre-restore empty closure and overwrite the draft.
  const skipFirstSave = useRef(true);
  useEffect(() => {
    if (isEdit) return;
    if (skipFirstSave.current) { skipFirstSave.current = false; return; }
    saveDraft({ name, clientId, periodStart, periodEnd, splitByPeriods, heatmapUrl, yandexMapUrl, reportsUrl, acRate });
  }, [isEdit, name, clientId, periodStart, periodEnd, splitByPeriods, heatmapUrl, yandexMapUrl, reportsUrl, acRate]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const acRatePct = parseFloat(acRate);
    const data = {
      name,
      clientId,
      periodStart,
      periodEnd,
      splitByPeriods,
      heatmapUrl: heatmapUrl.trim() || null,
      yandexMapUrl: yandexMapUrl.trim() || null,
      reportsUrl: reportsUrl.trim() || null,
      acRate: !isNaN(acRatePct) && acRatePct > 0 ? acRatePct / 100 : 0,
    };

    const url = isEdit ? `/api/campaigns/${initial.id}` : '/api/campaigns';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || err.errors?.fieldErrors?.name?.[0] || tc('error'));
        setLoading(false);
        return;
      }
      clearDraft();
      router.push(`/${locale}/admin/campaigns`);
      router.refresh();
    } catch {
      setError(tc('error'));
      setLoading(false);
    }
  }

  const inputCls = 'w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--border-em)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary-subtle)]';

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">

      {/* Draft restored notice */}
      {draftRestored && (
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--warning)] bg-[rgba(234,179,8,0.08)] px-3 py-2">
          <p className="text-xs text-[var(--warning)]">{tf('draftRestored')}</p>
          <button
            type="button"
            onClick={() => {
              clearDraft();
              setName(''); setClientId(''); setPeriodStart(''); setPeriodEnd('');
              setSplitByPeriods(false); setHeatmapUrl(''); setYandexMapUrl(''); setAcRate('');
              setDraftRestored(false);
            }}
            className="ml-4 text-[11px] text-[var(--text-3)] underline hover:text-[var(--text)]"
          >
            {tc('clear')}
          </button>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          {tf('campaignName')}
        </label>
        <input
          required
          value={name}
          onChange={e => setName(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          {tf('company')}
        </label>
        <select
          required
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          className={inputCls}
        >
          <option value="">{tf('selectClient')}</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
            {tf('periodStart')}
          </label>
          <input
            type="date"
            required
            value={periodStart}
            onChange={e => setPeriodStart(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
            {tf('periodEnd')}
          </label>
          <input
            type="date"
            required
            value={periodEnd}
            onChange={e => setPeriodEnd(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Agency commission */}
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          {tf('agencyCommissionPct')}
        </label>
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          placeholder="0"
          value={acRate}
          onChange={e => setAcRate(e.target.value)}
          className={inputCls}
        />
        <p className="mt-1 text-[11px] text-[var(--text-4)]">{tf('agencyCommissionHelp')}</p>
      </div>

      {/* Heatmap URL */}
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          {tf('heatmapUrl')}
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://studio.foursquare.com/map/public/..."
            value={heatmapUrl}
            onChange={e => setHeatmapUrl(e.target.value)}
            className={inputCls + ' flex-1'}
          />
          <button
            type="button"
            onClick={() => copyToClipboard(heatmapUrl, 'heatmap')}
            disabled={!heatmapUrl}
            title={tc('copy')}
            className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--border)] px-2.5 text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {copiedField === 'heatmap' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            )}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-[var(--text-4)]">{tf('heatmapHelp')}</p>
      </div>

      {/* Yandex Maps URL */}
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          {tf('yandexUrl')}
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://yandex.uz/maps/..."
            value={yandexMapUrl}
            onChange={e => setYandexMapUrl(e.target.value)}
            className={inputCls + ' flex-1'}
          />
          <button
            type="button"
            onClick={() => copyToClipboard(yandexMapUrl, 'yandex')}
            disabled={!yandexMapUrl}
            title={tc('copy')}
            className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--border)] px-2.5 text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {copiedField === 'yandex' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            )}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-[var(--text-4)]">{tf('yandexHelp')}</p>
      </div>

      {/* Reports URL */}
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          {tf('reportsUrl')}
        </label>
        <input
          type="url"
          placeholder="https://drive.google.com/drive/u/0/folders/…"
          value={reportsUrl}
          onChange={e => setReportsUrl(e.target.value)}
          className={inputCls}
        />
        <p className="mt-1 text-[11px] text-[var(--text-4)]">{tf('reportsHelp')}</p>
      </div>

      {/* Split by periods toggle */}
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <div className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              className="sr-only"
              checked={splitByPeriods}
              onChange={e => setSplitByPeriods(e.target.checked)}
            />
            <div className={`h-5 w-9 rounded-full transition-colors ${splitByPeriods ? 'bg-[var(--brand-primary)]' : 'bg-[var(--surface-3)]'}`} />
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${splitByPeriods ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <div>
            <div className="text-sm font-medium">{tf('splitByPeriodsLabel')}</div>
            <div className="mt-0.5 text-xs text-[var(--text-3)]">
              {tf('splitByPeriodsHelp')}
            </div>
          </div>
        </label>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
        >
          {loading ? '...' : isEdit ? tc('save') : tc('create')}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]"
        >
          {tc('cancel')}
        </button>
      </div>
    </form>
  );
}
