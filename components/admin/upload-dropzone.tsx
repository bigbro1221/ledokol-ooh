'use client';

import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Check, AlertTriangle, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

interface PinSuggestion {
  lat: number;
  lng: number;
  label: string;
  score: number;
}

interface ScreenGeoInfo {
  matched: boolean;
  suggestions: PinSuggestion[];
}

interface ScreenRow {
  type: string;
  city: string;
  address: string;
  size?: string | null;
  resolution?: string | null;
  impressionsPerDay?: number | null;
  productionCost?: number | null;
  priceTotal?: number | null;
  commissionPct?: number | null;
  agencyFeeAmt?: number | null;
  priceDiscounted?: number | null;
  priceUnit?: number | null;
  otsPlan?: number | null;
  ratingPlan?: number | null;
  universe?: number | null;
  otsFact?: number | null;
  ratingFact?: number | null;
  lat?: number | null;
  lng?: number | null;
  [key: string]: unknown;
}

interface ParsePreview {
  campaignId: string;
  periodId: string | null;
  minioKey: string;
  campaign: { clientName: string; yandexMapUrl: string | null; totalBudgetUzs: number | null; totalBudgetRub: number | null };
  screens: ScreenRow[];
  screenGeo: ScreenGeoInfo[];
  errors: { sheet: string; row: number; field: string; message: string }[];
  warnings: { sheet: string; message: string }[];
  geocoding: { matchedCount: number; unmatchedPins: unknown[]; totalPins: number };
  summary: { totalScreens: number; byType: Record<string, number> };
}

const TYPE_COLORS: Record<string, string> = {
  LED: 'bg-blue-500/20 text-blue-400',
  STATIC: 'bg-purple-500/20 text-purple-400',
  STOP: 'bg-emerald-500/20 text-emerald-400',
  AIRPORT: 'bg-sky-500/20 text-sky-400',
  BUS: 'bg-orange-500/20 text-orange-400',
};

const pct = (v: number | null | undefined) =>
  v == null ? '—' : (v * 100).toFixed(1) + '%';

const dec = (v: number | null | undefined) =>
  v == null ? '—' : v.toFixed(2);

function SuggestionPicker({
  suggestions,
  onPick,
}: {
  suggestions: PinSuggestion[];
  onPick: (s: PinSuggestion) => void;
}) {
  const tu = useTranslations('uploadAdmin');
  const [open, setOpen] = useState(false);

  if (suggestions.length === 0) {
    return <span className="text-[10px] text-[var(--text-4)]">{tu('noPins')}</span>;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-amber-600 hover:bg-amber-50"
      >
        <span>{tu('pickPin')}</span>
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-[var(--radius-md)] border border-[var(--border)] bg-white shadow-lg">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => { onPick(s); setOpen(false); }}
              className="flex w-full items-start gap-2 border-b border-[var(--border)] px-3 py-2 text-left last:border-0 hover:bg-[var(--surface-2)]"
            >
              <MapPin size={11} className="mt-0.5 shrink-0 text-[var(--brand-primary)]" strokeWidth={1.5} />
              <div className="min-w-0">
                <p className="truncate text-xs">{s.label}</p>
                <p className="text-[10px] text-[var(--text-3)]">
                  {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                  {' · '}
                  <span className={s.score >= 50 ? 'text-green-600' : s.score >= 25 ? 'text-amber-500' : 'text-[var(--text-4)]'}>
                    {s.score}%
                  </span>
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function UploadDropzone({ campaignId, locale, periodId }: { campaignId: string; locale: string; periodId?: string | null }) {
  const tu = useTranslations('uploadAdmin');
  const tTypes = useTranslations('screenTypes');
  const i18nLocale = useLocale();
  const fmtLocale = i18nLocale === 'en' ? 'en-US' : i18nLocale === 'uz' ? 'uz-UZ' : 'ru-RU';
  const num = (v: number | null | undefined) => v == null ? '—' : v.toLocaleString(fmtLocale);
  const typeLabel = (type: string) => tTypes.has(type) ? tTypes(type) : type;
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [screenGeo, setScreenGeo] = useState<ScreenGeoInfo[]>([]);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [showTable, setShowTable] = useState(true);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError(tu('errorOnlyXlsx'));
      return;
    }
    setUploading(true);
    setError('');
    setPreview(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('campaignId', campaignId);
    if (periodId) fd.append('periodId', periodId);

    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    setUploading(false);

    if (!res.ok) {
      setError(tu('errorUpload'));
      return;
    }

    const data: ParsePreview = await res.json();
    setPreview(data);
    setScreenGeo(data.screenGeo || data.screens.map(() => ({ matched: false, suggestions: [] })));
  }, [campaignId, periodId, tu]);

  // Allow user to manually assign coordinates from a suggestion
  function pickCoords(screenIdx: number, suggestion: PinSuggestion) {
    if (!preview) return;
    const updatedScreens = [...preview.screens];
    updatedScreens[screenIdx] = { ...updatedScreens[screenIdx], lat: suggestion.lat, lng: suggestion.lng };
    const updatedGeo = [...screenGeo];
    updatedGeo[screenIdx] = { matched: true, suggestions: [] };
    setPreview({ ...preview, screens: updatedScreens });
    setScreenGeo(updatedGeo);
  }

  const handleConfirm = async () => {
    if (!preview) return;
    setConfirming(true);

    const res = await fetch(`/api/upload/${campaignId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screens: preview.screens,
        periodId: preview.periodId || null,
        minioKey: preview.minioKey,
        yandexMapUrl: preview.campaign.yandexMapUrl,
        totalBudgetUzs: preview.campaign.totalBudgetUzs,
        totalBudgetRub: preview.campaign.totalBudgetRub,
      }),
    });

    setConfirming(false);
    if (res.ok) {
      setDone(true);
    } else {
      setError(tu('errorSave'));
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--success)] bg-[rgba(16,185,129,0.06)] p-12 text-center">
        <Check size={48} className="text-[var(--success)]" strokeWidth={1.5} />
        <h3 className="text-lg font-semibold">{tu('dataUploaded')}</h3>
        <p className="text-sm text-[var(--text-3)]">
          {preview?.summary.totalScreens} {tu('uploadedSuffix')}
        </p>
        <a
          href={`/${locale}/admin/campaigns/${campaignId}`}
          className="mt-2 rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white"
        >
          {tu('goToCampaign')}
        </a>
      </div>
    );
  }

  const unmatchedCount = screenGeo.filter(g => !g.matched).length;

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        className={`flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border-2 border-dashed p-12 text-center transition-colors ${
          dragOver ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-subtle)]' : 'border-[var(--border)] hover:border-[var(--border-hi)]'
        }`}
      >
        {uploading ? (
          <>
            <FileSpreadsheet size={40} className="animate-pulse text-[var(--brand-primary)]" strokeWidth={1.5} />
            <p className="text-sm text-[var(--text-2)]">{tu('parsing')}</p>
          </>
        ) : (
          <>
            <Upload size={40} className="text-[var(--text-4)]" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-medium">{tu('dropHere')}</p>
              <p className="mt-1 text-xs text-[var(--text-3)]">{tu('or')}</p>
            </div>
            <label className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--surface-2)]">
              {tu('pickFile')}
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }} />
            </label>
          </>
        )}
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="text-2xl font-semibold">{preview.summary.totalScreens}</div>
              <div className="text-xs text-[var(--text-3)]">{tu('statScreens')}</div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className={`text-2xl font-semibold ${preview.errors.length > 0 ? 'text-[var(--warning)]' : ''}`}>
                {preview.errors.length}
              </div>
              <div className="text-xs text-[var(--text-3)]">{tu('statErrors')}</div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className={`text-2xl font-semibold ${unmatchedCount > 0 ? 'text-amber-500' : 'text-[var(--success)]'}`}>
                {preview.geocoding.matchedCount}/{preview.geocoding.totalPins}
              </div>
              <div className="text-xs text-[var(--text-3)]">{tu('statPinsMatched')}</div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className={`text-2xl font-semibold ${unmatchedCount > 0 ? 'text-amber-500' : 'text-[var(--success)]'}`}>
                {unmatchedCount}
              </div>
              <div className="text-xs text-[var(--text-3)]">{tu('statNoCoords')}</div>
            </div>
          </div>

          {/* Type breakdown */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(preview.summary.byType).map(([type, count]) => (
              <span key={type} className={`rounded-full px-3 py-1 text-xs font-medium ${TYPE_COLORS[type] || 'bg-gray-100 text-gray-600'}`}>
                {typeLabel(type)}: {count}
              </span>
            ))}
          </div>

          {/* Errors */}
          {preview.errors.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 p-4">
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-400">
                <AlertTriangle size={13} /> {tu('validationErrors')} ({preview.errors.length})
              </h4>
              <div className="max-h-32 overflow-y-auto text-xs text-amber-300/80">
                {preview.errors.slice(0, 15).map((err, i) => (
                  <div key={i}>{tu('errorRow', { sheet: err.sheet, row: err.row, field: err.field, message: err.message })}</div>
                ))}
                {preview.errors.length > 15 && <div className="mt-1 opacity-60">{tu('errorMore', { count: preview.errors.length - 15 })}</div>}
              </div>
            </div>
          )}

          {/* Screen table */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h3 className="text-sm font-semibold">
                {tu('tableTitle')}
                {unmatchedCount > 0 && (
                  <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                    {tu('noCoordsBadge', { count: unmatchedCount })}
                  </span>
                )}
              </h3>
              <button
                onClick={() => setShowTable(v => !v)}
                className="flex items-center gap-1 text-xs text-[var(--text-3)] hover:text-[var(--text)]"
              >
                {showTable ? <><ChevronUp size={14} /> {tu('collapse')}</> : <><ChevronDown size={14} /> {tu('expand')}</>}
              </button>
            </div>

            {showTable && (
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full text-xs" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <tr>
                      {[
                        { label: tu('colNumber'), align: 'left' },
                        { label: tu('colType'), align: 'left' },
                        { label: tu('colCity'), align: 'left' },
                        { label: tu('colAddress'), align: 'left' },
                        { label: tu('colSize'), align: 'left' },
                        { label: tu('colProduction'), align: 'right' },
                        { label: tu('colNoVat'), align: 'right' },
                        { label: tu('colCommissionPct'), align: 'right' },
                        { label: tu('colCommission'), align: 'right' },
                        { label: tu('colWithVat'), align: 'right' },
                        { label: tu('colOtsPlan'), align: 'right' },
                        { label: tu('colRatingPlan'), align: 'right' },
                        { label: tu('colUniverse'), align: 'right' },
                        { label: tu('colOtsFact'), align: 'right' },
                        { label: tu('colRatingFact'), align: 'right' },
                        { label: tu('colGeo'), align: 'center' },
                      ].map(col => (
                        <th
                          key={col.label}
                          className={`whitespace-nowrap px-3 py-2 text-${col.align} text-[10px] font-medium uppercase tracking-[0.04em] text-[var(--text-3)]`}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.screens.map((screen, i) => {
                      const geo = screenGeo[i] ?? { matched: false, suggestions: [] };
                      const isUnmatched = !geo.matched;
                      return (
                        <tr
                          key={i}
                          className={`border-b border-[var(--border)] last:border-0 ${
                            isUnmatched ? 'bg-amber-500/10' : 'hover:bg-[var(--surface-2)]'
                          }`}
                        >
                          <td className="px-3 py-1.5 text-[var(--text-3)]">{i + 1}</td>
                          <td className="px-3 py-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[screen.type] || 'bg-gray-500/20 text-gray-400'}`}>
                              {typeLabel(screen.type)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-[var(--text-2)]">{screen.city}</td>
                          <td className="max-w-[200px] px-3 py-1.5">
                            <span className="line-clamp-1" style={{ fontFamily: 'var(--font-sans)' }}>{screen.address}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-[var(--text-2)]">{screen.size ?? '—'}</td>
                          <td className="px-3 py-1.5 text-right">{num(screen.productionCost)}</td>
                          <td className="px-3 py-1.5 text-right">{num(screen.priceTotal)}</td>
                          <td className="px-3 py-1.5 text-right">{pct(screen.commissionPct)}</td>
                          <td className="px-3 py-1.5 text-right">{num(screen.agencyFeeAmt)}</td>
                          <td className="px-3 py-1.5 text-right font-medium">{num(screen.priceDiscounted ?? screen.priceUnit)}</td>
                          <td className="px-3 py-1.5 text-right">{num(screen.otsPlan)}</td>
                          <td className="px-3 py-1.5 text-right">{dec(screen.ratingPlan)}</td>
                          <td className="px-3 py-1.5 text-right">{num(screen.universe)}</td>
                          <td className="px-3 py-1.5 text-right">{num(screen.otsFact)}</td>
                          <td className="px-3 py-1.5 text-right">{dec(screen.ratingFact)}</td>
                          <td className="px-3 py-1.5 text-center">
                            {geo.matched ? (
                              <MapPin size={12} className="mx-auto text-[var(--brand-primary)]" strokeWidth={1.5} />
                            ) : (
                              <SuggestionPicker
                                suggestions={geo.suggestions}
                                onPick={(s) => pickCoords(i, s)}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {unmatchedCount > 0 && (
            <p className="text-[11px] text-amber-600">
              {tu('unmatchedHint')}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="rounded-[var(--radius-md)] bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
            >
              {confirming ? tu('confirming') : tu('confirmBtn', { count: preview.summary.totalScreens })}
            </button>
            <button
              onClick={() => { setPreview(null); setScreenGeo([]); }}
              className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2.5 text-sm transition-colors hover:bg-[var(--surface-2)]"
            >
              {tu('cancelBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
