'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface CampaignFormProps {
  locale: string;
  clients: { id: string; name: string }[];
  currencies: { id: string; code: string; nameRu: string; nameEn: string; nameUz: string }[];
  // VAT rate active at the campaign's periodStart (or today's rate for new
  // campaigns). Used purely for the read-only totalFinal preview; the
  // server is the source of truth on save.
  vatRate: number;
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
    mediaType?: 'SCREENS' | 'OTHER_CARRIERS';
    additionalCurrencyId?: string | null;
    additionalAmount?: number | string | null;
    totalBudgetUzs?: number | string | null;
    productionCost?: number | string | null;
    totalFinal?: number | string | null;
    canChangeMediaType?: boolean;
    groupId?: string | null;
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
  mediaType: 'SCREENS' | 'OTHER_CARRIERS';
  belongsToProject: boolean;
  groupId: string;
  totalBudgetUzs: string;
  productionCost: string;
  totalFinal: string;
  additionalCurrencyId: string;
  additionalAmount: string;
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

export function CampaignForm({ locale, clients, currencies, vatRate, initial }: CampaignFormProps) {
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
  const [mediaType, setMediaType] = useState<'SCREENS' | 'OTHER_CARRIERS'>(initial?.mediaType ?? 'SCREENS');
  const [totalBudgetUzs, setTotalBudgetUzs] = useState(
    initial?.totalBudgetUzs != null ? String(initial.totalBudgetUzs) : ''
  );
  const [productionCost, setProductionCost] = useState(
    initial?.productionCost != null ? String(initial.productionCost) : ''
  );
  const [totalFinal, setTotalFinal] = useState(
    initial?.totalFinal != null ? String(initial.totalFinal) : ''
  );
  const [additionalCurrencyId, setAdditionalCurrencyId] = useState(initial?.additionalCurrencyId ?? '');
  const [additionalAmount, setAdditionalAmount] = useState(
    initial?.additionalAmount != null ? String(initial.additionalAmount) : ''
  );

  const [belongsToProject, setBelongsToProject] = useState<boolean>(
    !!initial?.groupId,
  );
  const [groupId, setGroupId] = useState<string>(initial?.groupId ?? '');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectSaveError, setProjectSaveError] = useState<string | null>(null);
  const [projectSaving, setProjectSaving] = useState(false);

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
      setMediaType(draft.mediaType ?? 'SCREENS');
      setTotalBudgetUzs(draft.totalBudgetUzs ?? '');
      setProductionCost(draft.productionCost ?? '');
      setTotalFinal(draft.totalFinal ?? '');
      setAdditionalCurrencyId(draft.additionalCurrencyId ?? '');
      setAdditionalAmount(draft.additionalAmount ?? '');
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
    saveDraft({
      name, clientId, periodStart, periodEnd, splitByPeriods,
      heatmapUrl, yandexMapUrl, reportsUrl, acRate,
      mediaType, belongsToProject, groupId,
      totalBudgetUzs, productionCost, totalFinal,
      additionalCurrencyId, additionalAmount,
    });
  }, [
    isEdit, name, clientId, periodStart, periodEnd, splitByPeriods,
    heatmapUrl, yandexMapUrl, reportsUrl, acRate,
    mediaType, belongsToProject, groupId,
    totalBudgetUzs, productionCost, totalFinal,
    additionalCurrencyId, additionalAmount,
  ]);

  useEffect(() => {
    if (!clientId) {
      setProjects([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/clients/${clientId}/projects`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { id: string; name: string }[]) => {
        if (!cancelled) setProjects(data);
      })
      .catch(() => { if (!cancelled) setProjects([]); });
    return () => { cancelled = true; };
  }, [clientId]);

  // For NEW campaigns only: switching client invalidates a stale project
  // selection. For edits, the FK was already validated by the API; we leave
  // it alone (the project list re-fetches above and the dropdown will show
  // the FK selected if it matches an entry in the new list).
  useEffect(() => {
    if (!initial && clientId) {
      setBelongsToProject(false);
      setGroupId('');
      setCreatingProject(false);
      setNewProjectName('');
    }
  }, [clientId, initial]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const acRatePct = parseFloat(acRate);
    const num = (s: string) => {
      const n = parseFloat(s);
      return !isNaN(n) ? n : null;
    };

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
      mediaType,
      groupId: belongsToProject && groupId ? groupId : null,
      ...(mediaType === 'OTHER_CARRIERS' && {
        totalBudgetUzs: num(totalBudgetUzs),
        productionCost: num(productionCost),
        // totalFinal is computed server-side from totalBudgetUzs × (1 + VAT@periodStart);
        // not sent from the client.
        additionalCurrencyId: additionalCurrencyId || null,
        additionalAmount: num(additionalAmount),
      }),
    };

    const url = isEdit ? `/api/campaigns/${initial.id}` : '/api/campaigns';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === 'mediaType_locked') {
          setError(tf('mediaTypeLocked'));
        } else {
          setError(err.message || err.error || err.errors?.fieldErrors?.name?.[0] || tc('error'));
        }
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
              setMediaType('SCREENS'); setTotalBudgetUzs(''); setProductionCost('');
              setTotalFinal(''); setAdditionalCurrencyId(''); setAdditionalAmount('');
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

      {/* Project (CampaignGroup) */}
      <div>
        <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          <input
            type="checkbox"
            disabled={!clientId}
            checked={belongsToProject}
            onChange={e => {
              const on = e.target.checked;
              setBelongsToProject(on);
              if (!on) {
                setGroupId('');
                setCreatingProject(false);
                setNewProjectName('');
                setProjectSaveError(null);
              }
            }}
          />
          {tf('belongsToProject')}
        </label>

        {belongsToProject && !creatingProject && (
          <div className="mt-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
              {tf('projectLabel')}
            </label>
            <select
              required
              value={groupId}
              onChange={e => {
                if (e.target.value === '__create__') {
                  setCreatingProject(true);
                  setProjectSaveError(null);
                } else {
                  setGroupId(e.target.value);
                }
              }}
              className={inputCls}
            >
              <option value="">{tf('projectPlaceholder')}</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="__create__">{tf('projectCreateNew')}</option>
            </select>
          </div>
        )}

        {belongsToProject && creatingProject && (
          <div className="mt-2 space-y-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
              {tf('projectNewName')}
            </label>
            <input
              autoFocus
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              className={inputCls}
              placeholder={tf('projectNewName')}
            />
            {projectSaveError && (
              <p className="text-[11px] text-[var(--danger)]">{projectSaveError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={projectSaving || newProjectName.trim().length === 0}
                onClick={async () => {
                  setProjectSaving(true);
                  setProjectSaveError(null);
                  try {
                    const res = await fetch('/api/projects', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ clientId, name: newProjectName.trim() }),
                    });
                    if (res.status === 409) {
                      setProjectSaveError(tf('projectExists'));
                      return;
                    }
                    if (!res.ok) {
                      setProjectSaveError(`Error ${res.status}`);
                      return;
                    }
                    const created = await res.json() as { id: string; name: string };
                    setProjects(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
                    setGroupId(created.id);
                    setCreatingProject(false);
                    setNewProjectName('');
                  } catch {
                    setProjectSaveError('Network error');
                  } finally {
                    setProjectSaving(false);
                  }
                }}
                className="rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
              >
                {tf('projectSaveNew')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatingProject(false);
                  setNewProjectName('');
                  setProjectSaveError(null);
                }}
                className="rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-[12px]"
              >
                {tf('projectCancelNew')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Media type */}
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
          {tf('mediaType')}
        </label>
        <select
          value={mediaType}
          disabled={isEdit && initial?.canChangeMediaType === false}
          onChange={e => setMediaType(e.target.value as 'SCREENS' | 'OTHER_CARRIERS')}
          className={inputCls}
        >
          <option value="SCREENS">{tf('mediaTypeScreens')}</option>
          <option value="OTHER_CARRIERS">{tf('mediaTypeOtherCarriers')}</option>
        </select>
        {isEdit && initial?.canChangeMediaType === false && (
          <p className="mt-1 text-[11px] text-[var(--text-4)]">{tf('mediaTypeLockedHint')}</p>
        )}
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

      {/* Financials sub-form (only for OTHER_CARRIERS) */}
      {mediaType === 'OTHER_CARRIERS' && (
        <fieldset className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border)] p-4">
          <legend className="px-1 text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]">
            {tf('financialsHeader')}
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
                {tf('totalBudgetUzs')}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={totalBudgetUzs}
                onChange={e => setTotalBudgetUzs(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
                {tf('productionCost')}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={productionCost}
                onChange={e => setProductionCost(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
                {tf('totalFinal')}
              </label>
              {/* Computed live as totalBudgetUzs × (1 + VAT). Server recomputes
                  authoritatively on save using the VatRate active at periodStart. */}
              <div
                aria-readonly="true"
                className={`${inputCls} flex items-center justify-between bg-[var(--surface-2)] text-[var(--text-2)]`}
              >
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {(() => {
                    const base = parseFloat(totalBudgetUzs);
                    if (!isFinite(base)) return '—';
                    return Math.round(base * (1 + vatRate)).toLocaleString('ru-RU');
                  })()}
                </span>
                <span className="text-[11px] text-[var(--text-4)]">
                  {tf('vatPreview', { pct: (vatRate * 100).toFixed(0) })}
                </span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
                {tf('additionalCurrency')}
              </label>
              <select
                value={additionalCurrencyId}
                onChange={e => setAdditionalCurrencyId(e.target.value)}
                className={inputCls}
              >
                <option value="">—</option>
                {currencies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {locale === 'ru' ? c.nameRu : locale === 'uz' ? c.nameUz : c.nameEn}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
                {tf('additionalAmount')}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={additionalAmount}
                onChange={e => setAdditionalAmount(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </fieldset>
      )}

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
