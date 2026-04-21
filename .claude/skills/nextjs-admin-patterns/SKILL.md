# Skill: Next.js Admin Panel Patterns

## Trigger
Use this skill when building admin pages, API routes, or admin-facing components for the Ledokol dashboard.

## API Route Auth Pattern

Every API route must call `requireAdmin()` or `requireAuth()` from `lib/api-auth.ts`.

```ts
import { requireAdmin } from '@/lib/api-auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  // ...
}
```

CLIENT users can only access their own campaigns. Admin can see all. Check `session.user.role` and `session.user.clientId`.

## Campaign Budget Resolution

Budget has 3-tier fallback priority:

1. **Manual entry wins** — `campaign.totalFinal` (Итоговая сумма, entered via CampaignFinancials form)
2. **XLSX-derived** — `campaign.totalBudgetUzs` (from Total sheet upload)
3. **Screen pricing sum** — fallback from `SUM(screen.pricing.priceDiscounted OR priceTotal OR priceUnit)`

For split-by-period campaigns: sum `period.totalFinal ?? period.totalBudgetUzs` across all periods.

```ts
const periodsBudgetSum = campaign.splitByPeriods
  ? campaign.periods.reduce((s, p) => {
      const v = p.totalFinal ?? p.totalBudgetUzs;
      return s + (v ? Number(v) : 0);
    }, 0)
  : 0;
const campaignBudget = campaign.totalFinal
  ? Number(campaign.totalFinal)
  : campaign.totalBudgetUzs ? Number(campaign.totalBudgetUzs) : 0;
const manualBudget = campaign.splitByPeriods ? periodsBudgetSum : campaignBudget;
const totalBudget = manualBudget > 0 ? manualBudget : totalBudgetFromScreens;
```

## Screen Price Priority

```ts
const screenPrice = (s): number => {
  if (!s.pricing) return 0;
  if (s.pricing.priceDiscounted) return Number(s.pricing.priceDiscounted);  // с АК и НДС — final
  if (s.pricing.priceTotal)      return Number(s.pricing.priceTotal);       // без АК
  if (s.pricing.priceUnit)       return Number(s.pricing.priceUnit);        // unit price
  return 0;
};
```

## Admin Page Layout Pattern

```tsx
// Header with back button + title
<div className="mb-6 flex items-start justify-between gap-4">
  <div className="flex items-center gap-3">
    <Link href={`/${locale}/admin/campaigns/${id}`}
      className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-3)] hover:bg-[var(--surface-2)]">
      <ArrowLeft size={14} strokeWidth={1.5} />
    </Link>
    <div>
      <p className="text-xs text-[var(--text-3)]">Client / Campaign</p>
      <h1 className="text-xl font-semibold">Page Title</h1>
    </div>
  </div>
  <div className="text-sm text-[var(--text-3)]">{count} записей</div>
</div>
```

## Mutation with Save Feedback

```tsx
const [saving, setSaving] = useState(false);
const [saved, setSaved] = useState(false);

async function handleSave() {
  setSaving(true);
  await fetch(`/api/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  setSaving(false);
  setSaved(true);
  setTimeout(() => setSaved(false), 2000);
}

// In JSX:
<button onClick={handleSave} disabled={saving}>
  {saved ? '✓ Сохранено' : saving ? 'Сохранение...' : 'Сохранить'}
</button>
```

## Campaign Form Fields (Mono Campaign Financials)

4 inputs managed by `components/admin/campaign-financials.tsx`:
- Без АК и НДС → `totalBudgetUzs`
- Производство → `productionCost`
- АК% → `acRate` (stored as decimal 0–1, displayed as 0–100)
- Итоговая сумма → `totalFinal`

## Period Manager Pattern

`components/admin/period-manager.tsx` — manages `CampaignPeriod[]` for split campaigns.
Each period has:
- XLSX upload button → triggers upload flow
- Eraser button (when screens > 0) → calls `DELETE /api/campaigns/${id}/periods/${periodId}/screens`
- Financial inputs: same 4 fields as mono campaign

## Filter Bar (URL Search Params)

Filters are always URL search params for SSR compatibility + shareability.

```tsx
// components/ui/filter-bar.tsx
const params = new URLSearchParams(searchParams);
params.set('city', value);
router.push(`?${params.toString()}`);
```

Server page reads them:
```ts
const { city: cityFilter, type: typeFilter } = await searchParams;
```

## i18n Locale Handling

Locale comes from `params.locale`. Valid dashboard locales: `ru`, `en`, `uz`, `tr`.
For ScreensTable: only `en` and `uz` are typed as `locale` prop; default to `ru`.

```ts
const localeVal = (locale === 'en' || locale === 'uz') ? locale : 'ru';
```

## Dynamic Import for Heavy Components

Map and charts are SSR-incompatible or heavy — always dynamic import:

```tsx
const ScreenMap = dynamic(
  () => import('@/components/map/screen-map').then(m => ({ default: m.ScreenMap })),
  { ssr: false, loading: () => <div className="h-[400px] animate-pulse rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]" /> }
);
```
