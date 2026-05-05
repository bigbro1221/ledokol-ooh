# Other Carriers Template — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support a second campaign-upload format ("Другие носители") where one XLSX represents many periods for the same set of screens, with financial data entered manually in the campaign form instead of from the file.

**Architecture:**
- Replace the `ScreenType` enum with a reference table (`ScreenType` model) so we can extend types without DDL.
- Add `mediaType` to `Campaign` (enum: `SCREENS | OTHER_CARRIERS`, extensible). The form selects this; upload + parse + UI behavior branch on it.
- Replace `totalBudgetRub` with a generic `additionalCurrency` / `additionalAmount` pair on `Campaign` (and the same pair on `CampaignPeriod`).
- New parser branch: rows in the new template are `(screen × period)` tuples. Period auto-created from col F. No `ScreenPricing` rows are written by this branch — pricing comes from the form.

**Tech Stack:** Next.js 14 (App Router), Prisma, PostgreSQL, SheetJS (`xlsx`), Zod, TypeScript, next-intl. Tests are tsx scripts using `node:assert/strict` (no test runner setup; the project already depends on `tsx`).

---

## Post-Task-1 amendment

Prisma rejects a model and an enum sharing a name within the same schema, so the reference model is named **`ScreenTypeRef`** (not `ScreenType`). The Prisma client property is **`prisma.screenTypeRef`** (camelCase from PascalCase). Any later task that says `ScreenType`/`prisma.screenType` in its snippets refers to this model. The Postgres relation is also `"ScreenTypeRef"` until Task 13 renames the model after the legacy enum is dropped.

---

## Pre-flight context

- Schema: [prisma/schema.prisma](../../../prisma/schema.prisma)
- Parser: [lib/parser/index.ts](../../../lib/parser/index.ts), [lib/parser/columns.ts](../../../lib/parser/columns.ts), [lib/parser/sheets.ts](../../../lib/parser/sheets.ts), [lib/parser/schemas.ts](../../../lib/parser/schemas.ts)
- Confirm route: [app/api/upload/[id]/confirm/route.ts](../../../app/api/upload/[id]/confirm/route.ts)
- Upload route: [app/api/upload/route.ts](../../../app/api/upload/route.ts)
- Campaign form: [components/admin/campaign-form.tsx](../../../components/admin/campaign-form.tsx)
- Upload UI: [components/admin/upload-dropzone.tsx](../../../components/admin/upload-dropzone.tsx)
- Dashboard KPI strip (reads totalBudget): [components/charts/efficiency-strip.tsx](../../../components/charts/efficiency-strip.tsx)
- Dashboard page (totalBudgetRub usage): [app/[locale]/dashboard/page.tsx](../../../app/[locale]/dashboard/page.tsx)
- Sample file: [docs/samples/other_types.xlsx](../../../docs/samples/other_types.xlsx)

**Mandatory Prisma workflow** (per repo CLAUDE.md): stop dev server → `prisma db push` → `prisma generate` → `tsc --noEmit` → restart dev. **`--accept-data-loss` requires explicit user approval** — this plan flags every step that needs it.

---

## File Structure

**New files:**
- `prisma/migrations/manual/2026-05-05-screentype-table.sql` — manual SQL for steps Prisma can't express
- `prisma/seed-screen-types.ts` — idempotent seed for the new `ScreenType` table
- `lib/parser/period.ts` — col F period-string parser + period naming
- `lib/parser/multi-period.ts` — parser branch for the new template
- `lib/parser/__tests__/period.test.ts` — tests for the period parser
- `lib/parser/__tests__/multi-period.test.ts` — tests for the new parser branch
- `lib/parser/__tests__/run.ts` — tsx runner that imports + executes each test file
- `public/templates/other-carriers-template.xlsx` — downloadable template (generated)
- `scripts/build-other-carriers-template.ts` — script that emits the template above
- `components/admin/campaign-financials-form.tsx` — sub-form rendered when `mediaType === OTHER_CARRIERS`

**Modified files:**
- `prisma/schema.prisma` — `ScreenType` table, `MediaType` enum, `Campaign.mediaType`, currency-pair fields
- `prisma/seed.ts` — call seed-screen-types
- `lib/parser/index.ts` — dispatch to multi-period branch when caller flags it
- `lib/parser/schemas.ts` — `ScreenRow.typeCode` (string FK) replaces `type` enum
- `lib/parser/sheets.ts` — `typeFromColumnValue` returns `code: string` keyed by `ScreenType.code`
- `app/api/upload/route.ts` — accept `mediaType` form field; pass to parser
- `app/api/upload/[id]/confirm/route.ts` — multi-period write path; type FK lookups; new currency fields
- `app/[locale]/admin/campaigns/new/page.tsx` and `edit/page.tsx` — pass `mediaType` initial value, screen types list, lock state
- `components/admin/campaign-form.tsx` — `mediaType` select, lock check, embed financials sub-form, swap rub field
- `components/admin/upload-dropzone.tsx` — pass `mediaType` to upload, render preview without pricing columns when `OTHER_CARRIERS`
- `app/[locale]/dashboard/page.tsx` — read `additionalCurrency` / `additionalAmount` instead of `totalBudgetRub`
- `messages/{ru,en,uz}.json` — labels for new fields, types, errors
- `docs/ARCHITECTURE.md` — section 6 update

**Removed (after migration):**
- `Campaign.totalBudgetRub` (column dropped)
- `ScreenType` Prisma enum (replaced by table)

---

## Phase 1 — Schema groundwork

### Task 1: Introduce `ScreenType` reference table alongside the existing enum

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/seed-screen-types.ts`
- Modify: `prisma/seed.ts`

Why parallel-rather-than-replace? The enum is referenced by `Screen.type`. We add the table + `Screen.typeId` first, backfill, then drop the enum column in a later task. This avoids one big destructive migration.

- [ ] **Step 1: Add the `ScreenType` model and `Screen.typeId` FK**

In `prisma/schema.prisma`, add (above the `Screen` model):

```prisma
model ScreenType {
  id           String   @id @default(uuid())
  code         String   @unique           // e.g. "LED", "ROOF", "BRANDMAUER"
  nameRu       String
  nameEn       String
  nameUz       String
  category     String                     // "SCREENS" or "OTHER_CARRIERS" — informational only
  sortOrder    Int      @default(0)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  screens      Screen[]
}
```

In the existing `Screen` model add (do not yet remove the `type` enum field):

```prisma
  typeId       String?
  screenType   ScreenType? @relation(fields: [typeId], references: [id])
```

Run:

```powershell
npx kill-port 3000
npx prisma db push
npx prisma generate
npx tsc --noEmit
```

Expected: schema applied, no TS errors.

- [ ] **Step 2: Write the screen-type seed**

Create `prisma/seed-screen-types.ts`:

```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TYPES = [
  // existing — keep codes stable, they match the legacy enum values
  { code: 'LED',        nameRu: 'Лед экраны',              nameEn: 'LED screens',      nameUz: 'LED ekranlar',         category: 'SCREENS',         sortOrder: 10 },
  { code: 'STATIC',     nameRu: 'Статические щиты',        nameEn: 'Static boards',    nameUz: 'Statik bannerlar',     category: 'SCREENS',         sortOrder: 20 },
  { code: 'STOP',       nameRu: 'Диджитальные остановки',  nameEn: 'Digital stops',    nameUz: 'Raqamli bekatlar',     category: 'SCREENS',         sortOrder: 30 },
  { code: 'AIRPORT',    nameRu: 'Аэропорт',                nameEn: 'Airport',          nameUz: 'Aeroport',             category: 'SCREENS',         sortOrder: 40 },
  { code: 'BUS',        nameRu: 'Автобусы',                nameEn: 'Buses',            nameUz: 'Avtobuslar',           category: 'OTHER_CARRIERS',  sortOrder: 50 },
  // new — Другие носители
  { code: 'ROOF',       nameRu: 'Крышные конструкции',     nameEn: 'Rooftop structures', nameUz: 'Tom konstruksiyalari', category: 'OTHER_CARRIERS', sortOrder: 60 },
  { code: 'BRANDMAUER', nameRu: 'Брендмауры',              nameEn: 'Brandmauers',      nameUz: 'Brendmauerlar',        category: 'OTHER_CARRIERS',  sortOrder: 70 },
  { code: 'CINEMA',     nameRu: 'Кинотеатры',              nameEn: 'Cinemas',          nameUz: 'Kinoteatrlar',         category: 'OTHER_CARRIERS',  sortOrder: 80 },
  { code: 'METRO',      nameRu: 'Метро',                   nameEn: 'Metro',            nameUz: 'Metro',                category: 'OTHER_CARRIERS',  sortOrder: 90 },
];

export async function seedScreenTypes() {
  for (const t of TYPES) {
    await prisma.screenType.upsert({
      where: { code: t.code },
      create: t,
      update: { nameRu: t.nameRu, nameEn: t.nameEn, nameUz: t.nameUz, category: t.category, sortOrder: t.sortOrder },
    });
  }
}

if (require.main === module) {
  seedScreenTypes().then(() => prisma.$disconnect());
}
```

In `prisma/seed.ts`, add a call to `seedScreenTypes()` near the start of the main function (look for the existing `main()`/`run()` pattern in that file and chain the call).

- [ ] **Step 3: Run the seed**

```powershell
npx tsx prisma/seed-screen-types.ts
```

Expected: process exits cleanly, no errors.

- [ ] **Step 4: Backfill `Screen.typeId` from the legacy enum**

Create `prisma/migrations/manual/2026-05-05-screentype-table.sql` with:

```sql
UPDATE "Screen" s
SET "typeId" = st."id"
FROM "ScreenType" st
WHERE st."code" = s."type"::text
  AND s."typeId" IS NULL;
```

Run it via `psql` (Docker compose runs Postgres on port 5432 by default):

```powershell
$env:PGPASSWORD = 'postgres'
psql -h localhost -p 5432 -U postgres -d ooh -f prisma\migrations\manual\2026-05-05-screentype-table.sql
```

Expected: `UPDATE N` rows. Verify in Studio: `npx prisma studio` → Screen → all rows have `typeId`.

- [ ] **Step 5: Commit**

```powershell
git add prisma/schema.prisma prisma/seed-screen-types.ts prisma/seed.ts prisma/migrations/manual/2026-05-05-screentype-table.sql
git commit -m "feat(schema): add ScreenType reference table + backfill from enum"
```

---

### Task 2: Add `Campaign.mediaType` and currency fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the `MediaType` enum and `mediaType` field**

Edit `prisma/schema.prisma`. Add the enum near the other enums:

```prisma
enum MediaType {
  SCREENS
  OTHER_CARRIERS
}
```

In the `Campaign` model, add:

```prisma
  mediaType      MediaType @default(SCREENS)
  additionalCurrency String?
  additionalAmount   BigInt?
```

In the `CampaignPeriod` model, add the same two fields (so a per-period currency override is possible later):

```prisma
  additionalCurrency String?
  additionalAmount   BigInt?
```

- [ ] **Step 2: Push schema and regenerate**

These are nullable / defaulted columns → safe (no `--accept-data-loss`):

```powershell
npx kill-port 3000
npx prisma db push
npx prisma generate
npx tsc --noEmit
```

Expected: clean, no errors.

- [ ] **Step 3: Backfill `additionalCurrency` / `additionalAmount` from `totalBudgetRub`**

Create a one-off tsx script in `prisma/migrations/manual/2026-05-05-currency-backfill.ts`:

```ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const campaigns = await prisma.campaign.findMany({
    where: { totalBudgetRub: { not: null } },
    select: { id: true, totalBudgetRub: true },
  });
  for (const c of campaigns) {
    if (c.totalBudgetRub == null) continue;
    await prisma.campaign.update({
      where: { id: c.id },
      data: {
        additionalCurrency: 'RUB',
        additionalAmount: c.totalBudgetRub,
      },
    });
  }
  console.log(`Backfilled ${campaigns.length} campaigns`);
}

main().finally(() => prisma.$disconnect());
```

Run:

```powershell
npx tsx prisma\migrations\manual\2026-05-05-currency-backfill.ts
```

Expected: `Backfilled N campaigns`.

- [ ] **Step 4: Commit (do NOT yet drop `totalBudgetRub`)**

```powershell
git add prisma/schema.prisma prisma/migrations/manual/2026-05-05-currency-backfill.ts
git commit -m "feat(schema): add mediaType + additionalCurrency/Amount, backfill from totalBudgetRub"
```

---

## Phase 2 — Parser groundwork

### Task 3: Set up tsx-based test runner for the parser

**Files:**
- Create: `lib/parser/__tests__/run.ts`

There's no test runner today. We use plain `node:assert/strict` and a manual runner script — no new dev deps.

- [ ] **Step 1: Write the runner**

Create `lib/parser/__tests__/run.ts`:

```ts
import { pathToFileURL } from 'node:url';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(__dirname).filter(f => f.endsWith('.test.ts'));

let failed = 0;
for (const f of files) {
  console.log(`\n=== ${f} ===`);
  try {
    await import(pathToFileURL(join(__dirname, f)).href);
    console.log(`  OK`);
  } catch (err) {
    failed++;
    console.error(`  FAIL: ${(err as Error).message}`);
    console.error((err as Error).stack);
  }
}

if (failed > 0) {
  console.error(`\n${failed} file(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${files.length} files passed`);
```

- [ ] **Step 2: Add an npm script**

In `package.json`, under `"scripts"`, add:

```json
"test:parser": "tsx lib/parser/__tests__/run.ts"
```

- [ ] **Step 3: Verify the runner reports zero files cleanly**

```powershell
npm run test:parser
```

Expected output: `All 0 files passed` (no test files yet).

- [ ] **Step 4: Commit**

```powershell
git add lib/parser/__tests__/run.ts package.json
git commit -m "chore(parser): add tsx test runner"
```

---

### Task 4: Period-string parser

**Files:**
- Create: `lib/parser/period.ts`
- Create: `lib/parser/__tests__/period.test.ts`

The new template's col F looks like `05.05.2025 - 31.05.2025`. We need to convert that to `{periodStart: Date, periodEnd: Date, name: string}`.

- [ ] **Step 1: Write the failing test**

Create `lib/parser/__tests__/period.test.ts`:

```ts
import assert from 'node:assert/strict';
import { parsePeriodString, periodName } from '../period';

// Single-month range → "Май 2025"
{
  const r = parsePeriodString('05.05.2025 - 31.05.2025');
  assert(r);
  assert.equal(r.periodStart.toISOString().slice(0, 10), '2025-05-05');
  assert.equal(r.periodEnd.toISOString().slice(0, 10), '2025-05-31');
  assert.equal(periodName(r.periodStart, r.periodEnd), 'Май 2025');
}

// Cross-month range → raw range string
{
  const r = parsePeriodString('15.01.2025 - 14.02.2025');
  assert(r);
  assert.equal(periodName(r.periodStart, r.periodEnd), '15.01.2025 – 14.02.2025');
}

// Single calendar month with full coverage → "Июнь 2025"
{
  const r = parsePeriodString('01.06.2025 - 30.06.2025');
  assert(r);
  assert.equal(periodName(r.periodStart, r.periodEnd), 'Июнь 2025');
}

// Whitespace + en-dash variants
assert(parsePeriodString('05.05.2025–31.05.2025'));
assert(parsePeriodString('  05.05.2025  -  31.05.2025  '));

// Bad input
assert.equal(parsePeriodString(''), null);
assert.equal(parsePeriodString('not a date'), null);
assert.equal(parsePeriodString('05.05.2025'), null); // single date — not a range
```

- [ ] **Step 2: Run to confirm it fails**

```powershell
npm run test:parser
```

Expected: FAIL with `Cannot find module '../period'`.

- [ ] **Step 3: Implement `lib/parser/period.ts`**

```ts
const RU_MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const DATE_RE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

function parseSingleDate(s: string): Date | null {
  const m = s.trim().match(DATE_RE);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (isNaN(d.getTime())) return null;
  return d;
}

export interface ParsedPeriod {
  periodStart: Date;
  periodEnd: Date;
}

export function parsePeriodString(raw: string): ParsedPeriod | null {
  if (!raw) return null;
  // Split on hyphen-minus, en-dash, em-dash, surrounded by optional whitespace
  const parts = raw.split(/\s*[-–—]\s*/);
  if (parts.length !== 2) return null;
  const start = parseSingleDate(parts[0]);
  const end = parseSingleDate(parts[1]);
  if (!start || !end) return null;
  if (end < start) return null;
  return { periodStart: start, periodEnd: end };
}

function isLastDayOfMonth(d: Date): boolean {
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  return next.getUTCMonth() !== d.getUTCMonth();
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function periodName(start: Date, end: Date): string {
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  // "Full month": starts on day 1 OR before, ends on last day of that month
  if (sameMonth && start.getUTCDate() <= 5 && isLastDayOfMonth(end)) {
    return `${RU_MONTHS_NOM[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  }
  const fmt = (d: Date) =>
    `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
  return `${fmt(start)} – ${fmt(end)}`;
}
```

The `start.getUTCDate() <= 5` check covers the sample's "05.05.2025 - 31.05.2025" (begins on day 5 because that's the campaign start day).

- [ ] **Step 4: Run to confirm pass**

```powershell
npm run test:parser
```

Expected: `All 1 files passed`.

- [ ] **Step 5: Commit**

```powershell
git add lib/parser/period.ts lib/parser/__tests__/period.test.ts
git commit -m "feat(parser): period-string parser + Russian month naming"
```

---

### Task 5: Multi-period parser branch

**Files:**
- Modify: `lib/parser/schemas.ts`
- Modify: `lib/parser/sheets.ts`
- Create: `lib/parser/multi-period.ts`
- Create: `lib/parser/__tests__/multi-period.test.ts`
- Modify: `lib/parser/index.ts`

The new branch consumes the same workbook the existing parser does, but emits a different `ParseResult` shape: each entry is `(screen, period, metrics)` rather than `(screen)`.

- [ ] **Step 1: Extend types in `lib/parser/schemas.ts`**

Replace the `type` enum in `ScreenRowSchema` with a string `typeCode`:

```ts
// Old:
//   type: z.enum(['LED', 'STATIC', 'STOP', 'AIRPORT', 'BUS']),
// New:
  typeCode: z.string().min(1, 'typeCode required'),
```

Add new types after `ScreenRow`:

```ts
export const MultiPeriodRowSchema = z.object({
  screen: ScreenRowSchema,
  periodStart: z.date(),
  periodEnd: z.date(),
  periodLabel: z.string(),
});

export type MultiPeriodRow = z.infer<typeof MultiPeriodRowSchema>;

export interface MultiPeriodParseResult {
  campaign: CampaignData;
  rows: MultiPeriodRow[];
  errors: ParseError[];
  warnings: ParseWarning[];
}
```

- [ ] **Step 2: Update `lib/parser/sheets.ts:typeFromColumnValue` to return code**

Find the existing `typeFromColumnValue` (returns `ScreenType` enum). Change to return `string` (the `code` from the `ScreenType` table). Add mappings for the new types:

```ts
export function typeFromColumnValue(s: string): string | null {
  const v = s.trim().toLowerCase();
  if (!v) return null;
  if (/лед|led/.test(v)) return 'LED';
  if (/остановк/.test(v)) return 'STOP';
  if (/статик/.test(v)) return 'STATIC';
  if (/аэропорт/.test(v)) return 'AIRPORT';
  if (/автобус/.test(v)) return 'BUS';
  if (/крыш/.test(v)) return 'ROOF';
  if (/брендмауэр|брендмаур|brandmauer/.test(v)) return 'BRANDMAUER';
  if (/кинотеатр|cinema/.test(v)) return 'CINEMA';
  if (/метро|metro/.test(v)) return 'METRO';
  return null;
}
```

Update all callers in `lib/parser/index.ts` to use the new signature and to write `typeCode` instead of `type` when assembling the row.

- [ ] **Step 3: Write the failing test**

Create `lib/parser/__tests__/multi-period.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMultiPeriod } from '../multi-period';

const sample = readFileSync(join(process.cwd(), 'docs/samples/other_types.xlsx'));
const result = parseMultiPeriod(sample);

assert.equal(result.errors.length, 0, `errors: ${JSON.stringify(result.errors)}`);

// Sample contains 13 monthly rows for one screen
assert.equal(result.rows.length, 13, `expected 13 rows, got ${result.rows.length}`);

// All rows are the same physical screen
const addresses = new Set(result.rows.map(r => r.screen.address.trim()));
assert.equal(addresses.size, 1, `expected 1 unique address, got ${addresses.size}`);

// All rows are typed ROOF
assert(result.rows.every(r => r.screen.typeCode === 'ROOF'));

// Periods are unique per row
const periods = new Set(result.rows.map(r => `${r.periodStart.toISOString()}_${r.periodEnd.toISOString()}`));
assert.equal(periods.size, 13);

// Plan OTS values vary
const otsValues = new Set(result.rows.map(r => r.screen.otsPlan));
assert(otsValues.size >= 10, 'expected diverse OTS values across periods');

// Period naming
const labels = result.rows.map(r => r.periodLabel);
assert(labels.includes('Май 2025'));
assert(labels.includes('Июнь 2025'));
```

- [ ] **Step 4: Run to confirm it fails**

```powershell
npm run test:parser
```

Expected: FAIL with `Cannot find module '../multi-period'`.

- [ ] **Step 5: Implement `lib/parser/multi-period.ts`**

```ts
import * as XLSX from 'xlsx';
import { findHeaderRow, buildColumnMap, buildPlanFactMap } from './columns';
import { parsePeriodString, periodName } from './period';
import { ScreenRowSchema, type MultiPeriodParseResult, type CampaignData, type ParseError, type ParseWarning } from './schemas';
import { typeFromColumnValue } from './sheets';

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function getHyperlink(sheet: XLSX.WorkSheet, row: number, col: number): string | null {
  const ref = XLSX.utils.encode_cell({ r: row, c: col });
  return sheet[ref]?.l?.Target || null;
}

export function parseMultiPeriod(buffer: Buffer): MultiPeriodParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const rows: MultiPeriodParseResult['rows'] = [];

  // Multi-period workbooks are single-sheet by convention
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { campaign: blankCampaign(), rows: [], errors: [{ sheet: '', row: 0, field: 'workbook', message: 'No sheets found' }], warnings: [] };
  }
  const sheet = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  const headerIdx = findHeaderRow(data);
  const headerRow = (data[headerIdx] || []) as string[];
  const colMap = buildColumnMap(headerRow);
  const pfMap = buildPlanFactMap(data, headerIdx, headerRow);

  // Locate the period column ("Период размещения")
  const periodCol = headerRow.findIndex(c =>
    typeof c === 'string' && /период\s+размещени/i.test(c.trim()),
  );
  if (periodCol < 0) {
    errors.push({ sheet: sheetName, row: headerIdx + 1, field: 'period', message: 'Column "Период размещения" not found' });
  }

  for (let r = headerIdx + 1; r < data.length; r++) {
    const row = data[r] as unknown[];
    if (!row) continue;

    const city = colMap.city !== undefined ? String(row[colMap.city] || '').trim() : '';
    const address = colMap.address !== undefined ? String(row[colMap.address] || '').trim() : '';
    if (!city && !address) continue;

    const typeStr = colMap.type !== undefined ? String(row[colMap.type] || '') : '';
    const typeCode = typeFromColumnValue(typeStr);
    if (!typeCode) {
      errors.push({ sheet: sheetName, row: r + 1, field: 'type', message: `Unknown type "${typeStr}"` });
      continue;
    }

    const periodRaw = periodCol >= 0 ? String(row[periodCol] || '').trim() : '';
    const period = parsePeriodString(periodRaw);
    if (!period) {
      errors.push({ sheet: sheetName, row: r + 1, field: 'period', message: `Could not parse period "${periodRaw}"` });
      continue;
    }

    const photoUrl = getHyperlink(sheet, r, colMap.photo ?? 1);
    const size = colMap.size !== undefined ? String(row[colMap.size] || '').trim() || null : null;
    const resolution = colMap.resolution !== undefined ? String(row[colMap.resolution] || '').trim() || null : null;

    const screen = {
      typeCode,
      city: city || 'Ташкент',
      address: address || `${sheetName} — строка ${r + 1}`,
      size,
      resolution,
      externalId: colMap.externalId !== undefined ? String(row[colMap.externalId] || '').trim() || null : null,
      photoUrl,
      impressionsPerDay: colMap.impressionsPerDay !== undefined ? parseNum(row[colMap.impressionsPerDay]) : null,
      // Pricing intentionally NOT read — multi-period campaigns supply pricing via the form
      priceUnit: null, priceDiscounted: null, priceTotal: null, priceRub: null,
      commissionPct: null, agencyFeeAmt: null, productionCost: null,
      otsPlan: pfMap.otsPlan !== undefined ? parseNum(row[pfMap.otsPlan]) : null,
      ratingPlan: pfMap.ratingPlan !== undefined ? parseNum(row[pfMap.ratingPlan]) : null,
      otsFact: pfMap.otsFact !== undefined ? parseNum(row[pfMap.otsFact]) : null,
      ratingFact: pfMap.ratingFact !== undefined ? parseNum(row[pfMap.ratingFact]) : null,
      universe: pfMap.universe !== undefined ? parseNum(row[pfMap.universe]) : null,
    };

    const result = ScreenRowSchema.safeParse(screen);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ sheet: sheetName, row: r + 1, field: issue.path.join('.'), message: issue.message });
      }
      continue;
    }

    rows.push({
      screen: result.data,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      periodLabel: periodName(period.periodStart, period.periodEnd),
    });
  }

  return { campaign: blankCampaign(), rows, errors, warnings };
}

function blankCampaign(): CampaignData {
  return { clientName: '', project: null, yandexMapUrl: null, totalBudgetUzs: null, totalBudgetRub: null };
}
```

- [ ] **Step 6: Run tests**

```powershell
npm run test:parser
```

Expected: `All 2 files passed`.

- [ ] **Step 7: Commit**

```powershell
git add lib/parser/multi-period.ts lib/parser/schemas.ts lib/parser/sheets.ts lib/parser/__tests__/multi-period.test.ts
git commit -m "feat(parser): multi-period branch + ScreenType code-based typing"
```

---

### Task 6: Update existing parser callers to use `typeCode`

**Files:**
- Modify: `lib/parser/index.ts`
- Modify: `app/api/upload/[id]/confirm/route.ts`
- Modify: `components/admin/upload-dropzone.tsx`

The schema change in Task 5 broke the existing single-sheet branch. Fix the callers.

- [ ] **Step 1: In `lib/parser/index.ts`**

Replace assignments of `type: screenType` with `typeCode: screenType` (where `screenType` is now a string from `typeFromColumnValue`). Where the legacy code took the sheet's `fixedType` (was a `ScreenType` enum), change `detectSheetType` callers to return the `code` string instead of the enum.

Audit `lib/parser/sheets.ts:detectSheetType` — change its return type from `ScreenType | null` to `string | null` (codes), and remove the import of the enum.

```ts
// Before:
//   let screenType: ScreenType | null = fixedType;
// After:
  let screenType: string | null = fixedType;
```

```ts
// Before:
//   type: screenType,
// After:
  typeCode: screenType,
```

- [ ] **Step 2: In `app/api/upload/[id]/confirm/route.ts`**

The body now sends `typeCode` instead of `type`. The route must look up `ScreenType` by code and store the FK:

```ts
// Pre-resolve the type once per typeCode used in this batch
const codes = [...new Set(body.screens.map(s => s.typeCode).filter(Boolean))];
const types = await tx.screenType.findMany({ where: { code: { in: codes } } });
const typeIdByCode = new Map(types.map(t => [t.code, t.id]));

// In the upsert:
//  ... type fields ...
typeId: typeIdByCode.get(s.typeCode) ?? null,
```

For the duration of this transitional task, **continue writing the legacy `type` enum field as well** so the dashboard keeps working until Task 13 drops it. Map the code back to the legacy enum code when one exists (`LED`, `STATIC`, `STOP`, `AIRPORT`, `BUS`); fall back to `STATIC` for new types (`ROOF`, etc.) — those will only ever ship under `OTHER_CARRIERS` campaigns, where the legacy enum is unused. **Mark this fallback with a code comment so Task 13 removes it cleanly.**

```ts
function legacyEnumFor(code: string): 'LED' | 'STATIC' | 'STOP' | 'AIRPORT' | 'BUS' {
  switch (code) {
    case 'LED': case 'STATIC': case 'STOP': case 'AIRPORT': case 'BUS': return code;
    default: return 'STATIC'; // TODO(Task 13): drop after the legacy `type` enum is removed
  }
}
```

- [ ] **Step 3: In `components/admin/upload-dropzone.tsx`**

`ScreenRow` interface (line 19): rename `type` to `typeCode`. The `TYPE_COLORS` lookup keyed off `screen.type` (line 376) becomes `screen.typeCode`. The `typeLabel(screen.type)` calls become `typeLabel(screen.typeCode)`.

Add color entries for the new codes:

```ts
const TYPE_COLORS: Record<string, string> = {
  LED: 'bg-blue-500/20 text-blue-400',
  STATIC: 'bg-purple-500/20 text-purple-400',
  STOP: 'bg-emerald-500/20 text-emerald-400',
  AIRPORT: 'bg-sky-500/20 text-sky-400',
  BUS: 'bg-orange-500/20 text-orange-400',
  ROOF: 'bg-amber-500/20 text-amber-400',
  BRANDMAUER: 'bg-rose-500/20 text-rose-400',
  CINEMA: 'bg-fuchsia-500/20 text-fuchsia-400',
  METRO: 'bg-red-500/20 text-red-400',
};
```

- [ ] **Step 4: Verify TypeScript is clean**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Smoke-test the existing flow**

```powershell
npm run dev
```

In the browser: upload `docs/samples/final_sample.xlsx` to an existing `SCREENS` campaign. Verify the preview renders, types display correctly, and confirm writes screens with `typeId` populated.

- [ ] **Step 6: Commit**

```powershell
git add lib/parser/index.ts lib/parser/sheets.ts app/api/upload/[id]/confirm/route.ts components/admin/upload-dropzone.tsx
git commit -m "refactor(parser): switch type enum to code-string + ScreenType FK lookup"
```

---

## Phase 3 — API + confirm route

### Task 7: Accept `mediaType` in upload route + dispatch to multi-period parser

**Files:**
- Modify: `app/api/upload/route.ts`
- Modify: `lib/parser/index.ts`

- [ ] **Step 1: Read campaign's `mediaType` in `/api/upload`**

In `app/api/upload/route.ts`, after looking up the `Campaign`, branch the parser call:

```ts
const campaign = await prisma.campaign.findUnique({
  where: { id: campaignId },
  select: { id: true, mediaType: true },
});
if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

if (campaign.mediaType === 'OTHER_CARRIERS') {
  const result = parseMultiPeriod(buffer);
  // ... emit a different preview shape (handled in Task 9)
} else {
  const result = parseMediaPlan(buffer);
  // ... existing flow
}
```

The two parsers return different result shapes. Keep the response JSON consistent by returning a top-level `mode: 'screens' | 'multi-period'` discriminator and a typed payload underneath:

```ts
return NextResponse.json({
  mode: campaign.mediaType === 'OTHER_CARRIERS' ? 'multi-period' : 'screens',
  campaignId,
  minioKey,
  // for screens mode:
  screens?, screenGeo?, summary?, geocoding?,
  // for multi-period mode:
  rows?, periods?, screens?, screenGeo?, summary?,
  errors, warnings,
});
```

For multi-period mode, post-processing in the route should:
1. Group `rows` by `screen` (key: `city|address|typeCode`). One physical screen, many `(periodStart, periodEnd, otsPlan, otsFact, …)` entries.
2. Compute `periods`: deduplicated `(periodStart, periodEnd, label)`.
3. Run the existing Yandex-pin geocoding once per **screen** (not per row).
4. Emit a `summary` keyed by `typeCode` with screen counts.

Pseudocode for the multi-period post-processing:

```ts
const screenKey = (s: ScreenRow) => `${s.city}|${s.address}|${s.typeCode}`;
const screenMap = new Map<string, { screen: ScreenRow; metrics: MultiPeriodRow[] }>();
for (const row of result.rows) {
  const key = screenKey(row.screen);
  if (!screenMap.has(key)) screenMap.set(key, { screen: row.screen, metrics: [] });
  screenMap.get(key)!.metrics.push(row);
}
const screens = [...screenMap.values()].map(g => g.screen);
const periodsRaw = result.rows.map(r => ({ start: r.periodStart, end: r.periodEnd, label: r.periodLabel }));
const periods = dedupePeriods(periodsRaw);
```

Add `dedupePeriods` (helper inline in the route file or in a new `lib/parser/dedupe.ts`):

```ts
function dedupePeriods(items: { start: Date; end: Date; label: string }[]) {
  const m = new Map<string, { start: Date; end: Date; label: string }>();
  for (const p of items) {
    const k = `${p.start.toISOString()}_${p.end.toISOString()}`;
    if (!m.has(k)) m.set(k, p);
  }
  return [...m.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}
```

- [ ] **Step 2: Verify TS clean + smoke-test screens flow still works**

```powershell
npx tsc --noEmit
npm run dev
```

Upload `docs/samples/final_sample.xlsx` (a SCREENS-mode campaign) — preview should match before.

- [ ] **Step 3: Commit**

```powershell
git add app/api/upload/route.ts lib/parser/index.ts
git commit -m "feat(api): dispatch multi-period parser when Campaign.mediaType=OTHER_CARRIERS"
```

---

### Task 8: Confirm route handles multi-period writes

**Files:**
- Modify: `app/api/upload/[id]/confirm/route.ts`

- [ ] **Step 1: Branch on `mode`**

The body now includes `mode: 'screens' | 'multi-period'`. For `multi-period`, the body shape is:

```ts
interface MultiPeriodConfirmBody {
  mode: 'multi-period';
  minioKey: string;
  screens: (ScreenData & { metrics: { periodStart: string; periodEnd: string; periodLabel: string; otsPlan: number | null; ratingPlan: number | null; otsFact: number | null; ratingFact: number | null; universe: number | null }[] })[];
  yandexMapUrl?: string | null;
}
```

- [ ] **Step 2: Implement the multi-period write transaction**

```ts
if (body.mode === 'multi-period') {
  await prisma.$transaction(async (tx) => {
    // Wipe existing periods + their metrics
    await tx.campaignPeriod.deleteMany({ where: { campaignId } });
    await tx.screen.deleteMany({ where: { campaignId, metrics: { none: {} }, pricing: { none: {} } } });

    // Resolve type FK
    const codes = [...new Set(body.screens.map(s => s.typeCode))];
    const types = await tx.screenType.findMany({ where: { code: { in: codes } } });
    const typeIdByCode = new Map(types.map(t => [t.code, t.id]));

    // Collect unique periods, create them once
    const periodKey = (s: string, e: string) => `${s}_${e}`;
    const allPeriods = new Map<string, { start: Date; end: Date; label: string }>();
    for (const sc of body.screens) {
      for (const m of sc.metrics) {
        const k = periodKey(m.periodStart, m.periodEnd);
        if (!allPeriods.has(k)) allPeriods.set(k, { start: new Date(m.periodStart), end: new Date(m.periodEnd), label: m.periodLabel });
      }
    }
    const periodIdByKey = new Map<string, string>();
    for (const [k, p] of allPeriods) {
      const created = await tx.campaignPeriod.create({
        data: { campaignId, name: p.label, periodStart: p.start, periodEnd: p.end },
      });
      periodIdByKey.set(k, created.id);
    }

    // Update campaign date range to cover all periods, mark splitByPeriods
    if (allPeriods.size > 0) {
      const periodsArr = [...allPeriods.values()];
      const minStart = new Date(Math.min(...periodsArr.map(p => p.start.getTime())));
      const maxEnd = new Date(Math.max(...periodsArr.map(p => p.end.getTime())));
      await tx.campaign.update({
        where: { id: campaignId },
        data: { periodStart: minStart, periodEnd: maxEnd, splitByPeriods: true },
      });
    }

    // Upsert screens and write metrics per period
    for (const sc of body.screens) {
      const screen = await tx.screen.upsert({
        where: { campaignId_city_address: { campaignId, city: sc.city, address: sc.address } },
        create: {
          campaignId,
          externalId: sc.externalId || null,
          type: legacyEnumFor(sc.typeCode), // TODO(Task 13): remove
          typeId: typeIdByCode.get(sc.typeCode) ?? null,
          city: sc.city,
          address: sc.address,
          size: sc.size || null,
          resolution: sc.resolution || null,
          impressionsPerDay: sc.impressionsPerDay ? Math.round(sc.impressionsPerDay) : null,
          photoUrl: sc.photoUrl || null,
          lat: sc.lat || null,
          lng: sc.lng || null,
        },
        update: {
          externalId: sc.externalId || null,
          type: legacyEnumFor(sc.typeCode), // TODO(Task 13): remove
          typeId: typeIdByCode.get(sc.typeCode) ?? null,
          size: sc.size || null,
          resolution: sc.resolution || null,
          impressionsPerDay: sc.impressionsPerDay ? Math.round(sc.impressionsPerDay) : null,
          photoUrl: sc.photoUrl || null,
          lat: sc.lat || null,
          lng: sc.lng || null,
        },
      });

      for (const m of sc.metrics) {
        const periodId = periodIdByKey.get(periodKey(m.periodStart, m.periodEnd));
        if (!periodId) continue;
        await tx.screenMetrics.create({
          data: {
            screenId: screen.id,
            periodId,
            otsPlan: m.otsPlan ? Math.round(m.otsPlan) : null,
            ratingPlan: m.ratingPlan != null ? Number(m.ratingPlan.toFixed(4)) : null,
            otsFact: m.otsFact ? Math.round(m.otsFact) : null,
            ratingFact: m.ratingFact != null ? Number(m.ratingFact.toFixed(4)) : null,
            universe: m.universe ? Math.round(m.universe) : null,
            source: 'XLSX',
          },
        });
      }
    }

    await tx.campaign.update({
      where: { id: campaignId },
      data: { sourceFileUrl: body.minioKey || undefined, yandexMapUrl: body.yandexMapUrl || undefined },
    });
  });

  return NextResponse.json({ ok: true });
}
```

`legacyEnumFor` was added in Task 6 — re-use it here.

- [ ] **Step 3: TS check**

```powershell
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```powershell
git add app/api/upload/[id]/confirm/route.ts
git commit -m "feat(api): multi-period confirm — auto-create periods, no pricing write"
```

---

### Task 9: Lock `mediaType` when periods or financials exist

**Files:**
- Modify: route handlers for campaign update — find them under `app/api/admin/campaigns/[id]/route.ts` (or wherever `PATCH /campaigns/:id` lives)

- [ ] **Step 1: Locate the campaign-update endpoint**

Search:

```powershell
```

Run a `Grep` on `prisma.campaign.update` to find where the form submits. If the form submits to a Server Action (look for `'use server'` files near `campaign-form.tsx`), modify that.

- [ ] **Step 2: Add the lock check**

Before applying changes, if the request is changing `mediaType`:

```ts
if (typeof body.mediaType === 'string' && body.mediaType !== existing.mediaType) {
  const periodCount = await prisma.campaignPeriod.count({ where: { campaignId: id } });
  const hasFinancials =
    existing.totalBudgetUzs != null ||
    existing.productionCost != null ||
    existing.totalFinal != null ||
    existing.additionalAmount != null;
  if (periodCount > 0 || hasFinancials) {
    return NextResponse.json(
      { error: 'mediaType_locked', message: 'Очистите периоды и финансовые данные перед сменой типа кампании' },
      { status: 409 },
    );
  }
}
```

- [ ] **Step 3: Smoke-test**

In the dev UI, try to flip a campaign with periods from `OTHER_CARRIERS` to `SCREENS`. Expect a 409 with the Russian error.

- [ ] **Step 4: Commit**

```powershell
git add app/api/admin/campaigns/[id]/route.ts  # adjust path as needed
git commit -m "feat(api): lock Campaign.mediaType while periods/financials exist"
```

---

## Phase 4 — Campaign form

### Task 10: Add `mediaType` selector and currency-pair fields

**Files:**
- Modify: `components/admin/campaign-form.tsx`
- Modify: `app/[locale]/admin/campaigns/new/page.tsx`
- Modify: `app/[locale]/admin/campaigns/[id]/edit/page.tsx`
- Modify: `messages/{ru,en,uz}.json`

- [ ] **Step 1: Translation strings**

In each `messages/*.json` (`forms` namespace), add keys:

`messages/ru.json`:

```json
"mediaType": "Тип кампании",
"mediaTypeScreens": "Экраны",
"mediaTypeOtherCarriers": "Другие носители (Брендмауеры, вокзалы, Крыши и др.)",
"mediaTypeLockedHint": "Чтобы сменить тип, удалите все периоды и финансовые данные",
"additionalCurrency": "Доп. валюта",
"additionalAmount": "Сумма в доп. валюте",
"financialsHeader": "Финансовые данные",
```

Same keys in `en.json` and `uz.json` with translations:
- en: "Campaign type" / "Screens" / "Other carriers (brandmauers, train stations, rooftops, etc.)" / "Clear all periods and financial data to change the type" / "Additional currency" / "Additional amount" / "Financials"
- uz: "Kampaniya turi" / "Ekranlar" / "Boshqa tashuvchilar (brandmauerlar, vokzallar, tomlar va h.k.)" / "Turini o'zgartirish uchun barcha davrlarni va moliyaviy ma'lumotlarni tozalang" / "Qo'shimcha valyuta" / "Qo'shimcha summa" / "Moliyaviy ma'lumotlar"

- [ ] **Step 2: Extend `CampaignFormProps.initial` and `DraftState`**

```ts
interface CampaignFormProps {
  // ...
  initial?: {
    // ... existing
    mediaType: 'SCREENS' | 'OTHER_CARRIERS';
    additionalCurrency?: string | null;
    additionalAmount?: string | null;     // BigInt → string in/out
    totalBudgetUzs?: string | null;
    productionCost?: string | null;
    totalFinal?: string | null;
    canChangeMediaType: boolean;          // computed server-side
  };
}

interface DraftState {
  // ... existing
  mediaType: 'SCREENS' | 'OTHER_CARRIERS';
  additionalCurrency: string;
  additionalAmount: string;
  totalBudgetUzs: string;
  productionCost: string;
  totalFinal: string;
}
```

Wire each new state slot identical to existing fields: `useState`, draft load, draft save, server submit.

- [ ] **Step 3: Render the type selector**

Add right under the "Name" input:

```tsx
<label className="block text-sm">
  <span className="mb-1 block text-[var(--text-3)]">{tf('mediaType')}</span>
  <select
    value={mediaType}
    disabled={isEdit && !initial?.canChangeMediaType}
    onChange={(e) => setMediaType(e.target.value as 'SCREENS' | 'OTHER_CARRIERS')}
    className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
  >
    <option value="SCREENS">{tf('mediaTypeScreens')}</option>
    <option value="OTHER_CARRIERS">{tf('mediaTypeOtherCarriers')}</option>
  </select>
  {isEdit && !initial?.canChangeMediaType && (
    <span className="mt-1 block text-[11px] text-[var(--text-4)]">{tf('mediaTypeLockedHint')}</span>
  )}
</label>
```

- [ ] **Step 4: Conditional financials block**

Render when `mediaType === 'OTHER_CARRIERS'` (could also show for SCREENS later):

```tsx
{mediaType === 'OTHER_CARRIERS' && (
  <fieldset className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
    <legend className="px-1 text-xs uppercase tracking-wide text-[var(--text-3)]">{tf('financialsHeader')}</legend>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Input label="Бюджет (UZS)" value={totalBudgetUzs} onChange={setTotalBudgetUzs} type="number" />
      <Input label="Стоимость производства (UZS)" value={productionCost} onChange={setProductionCost} type="number" />
      <Input label="АК%" value={acRate} onChange={setAcRate} type="number" step="0.0001" />
      <Input label="Итого с АК и НДС (UZS)" value={totalFinal} onChange={setTotalFinal} type="number" />
      <Input label={tf('additionalCurrency')} value={additionalCurrency} onChange={setAdditionalCurrency} placeholder="RUB / USD / EUR" />
      <Input label={tf('additionalAmount')} value={additionalAmount} onChange={setAdditionalAmount} type="number" />
    </div>
  </fieldset>
)}
```

(Use the existing form's input pattern — there's no `<Input />` component yet; either inline the markup or extract one. Preserve the existing visual style.)

- [ ] **Step 5: Wire the new fields into the submit body**

In the submit handler, include the new fields when posting. The campaign-update endpoint may need a tiny extension to accept them (mostly straightforward additions to whatever Zod schema validates the body).

- [ ] **Step 6: Server-side computation of `canChangeMediaType`**

In `new/page.tsx`, pass `mediaType: 'SCREENS'`, `canChangeMediaType: true` (always on for new).
In `edit/page.tsx`, compute:

```ts
const periodCount = await prisma.campaignPeriod.count({ where: { campaignId: id } });
const hasFinancials =
  campaign.totalBudgetUzs != null ||
  campaign.productionCost != null ||
  campaign.totalFinal != null ||
  campaign.additionalAmount != null;
const canChangeMediaType = periodCount === 0 && !hasFinancials;
```

Pass to `<CampaignForm initial={{ ..., mediaType: campaign.mediaType, additionalCurrency: campaign.additionalCurrency, additionalAmount: campaign.additionalAmount?.toString() ?? null, ..., canChangeMediaType }} />`.

- [ ] **Step 7: TS check + smoke**

```powershell
npx tsc --noEmit
npm run dev
```

Create a new campaign → set type to "Другие носители" → financial section appears → save → revisit edit page → values persist → try to change type → disabled with hint.

- [ ] **Step 8: Commit**

```powershell
git add components/admin/campaign-form.tsx app/[locale]/admin/campaigns/new/page.tsx app/[locale]/admin/campaigns/[id]/edit/page.tsx messages/ru.json messages/en.json messages/uz.json
git commit -m "feat(form): mediaType selector + financials sub-form for OTHER_CARRIERS"
```

---

### Task 11: Upload UI handles multi-period preview

**Files:**
- Modify: `components/admin/upload-dropzone.tsx`
- Modify: `app/[locale]/admin/campaigns/[id]/upload/page.tsx`

- [ ] **Step 1: Pass `mediaType` from the upload page**

In `upload/page.tsx`, fetch the campaign's `mediaType` and pass to the dropzone:

```tsx
<UploadDropzone
  campaignId={campaign.id}
  locale={locale}
  periodId={periodId}
  mediaType={campaign.mediaType}
/>
```

In `upload-dropzone.tsx`, add to props:

```ts
mediaType: 'SCREENS' | 'OTHER_CARRIERS';
```

For OTHER_CARRIERS, hide the period selector entirely (periods are derived from the file).

- [ ] **Step 2: Render the multi-period preview**

When `mode === 'multi-period'`, render:
- A "Periods detected" pill row showing each unique period label and screen count.
- The screen table — but **without** the price columns (they're not in the file). Show a per-screen sparkline of OTS plan/fact across periods if it's easy; otherwise just show one row per screen with "OTS plan / fact" rolled up as `min..max` ranges.

Suggested render:

```tsx
{preview.mode === 'multi-period' && (
  <>
    <div className="flex flex-wrap gap-2">
      {preview.periods.map(p => (
        <span key={p.label} className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs">
          {p.label}
        </span>
      ))}
    </div>
    {/* Reduced-column screen table */}
  </>
)}
```

- [ ] **Step 3: Update the confirm payload**

When `mode === 'multi-period'`, the confirm body needs the `screens` array with per-screen `metrics[]`. Build that on the client from `preview.rows`:

```ts
const screensForConfirm = preview.screens.map(s => ({
  ...s,
  metrics: preview.rows
    .filter(r => r.screen.city === s.city && r.screen.address === s.address)
    .map(r => ({
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      periodLabel: r.periodLabel,
      otsPlan: r.screen.otsPlan,
      ratingPlan: r.screen.ratingPlan,
      otsFact: r.screen.otsFact,
      ratingFact: r.screen.ratingFact,
      universe: r.screen.universe,
    })),
}));

await fetch(`/api/upload/${campaignId}/confirm`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'multi-period',
    minioKey: preview.minioKey,
    yandexMapUrl: preview.campaign.yandexMapUrl,
    screens: screensForConfirm,
  }),
});
```

- [ ] **Step 4: Smoke-test the full flow**

- Create a campaign with `mediaType=OTHER_CARRIERS`, save with budget = 5_000_000_000 UZS.
- Upload `docs/samples/other_types.xlsx`.
- Preview shows 13 periods, 1 screen, "Крышная конструкция", no price columns.
- Confirm.
- Open the campaign dashboard — `splitByPeriods=true`, period filter shows all 13 months, KPI strip uses the form-entered budget.

- [ ] **Step 5: Commit**

```powershell
git add components/admin/upload-dropzone.tsx app/[locale]/admin/campaigns/[id]/upload/page.tsx
git commit -m "feat(ui): multi-period upload preview + per-screen-metrics confirm payload"
```

---

## Phase 5 — Template + dashboard wiring

### Task 12: Generate the new template XLSX

**Files:**
- Create: `scripts/build-other-carriers-template.ts`
- Create: `public/templates/other-carriers-template.xlsx` (script output, committed)

- [ ] **Step 1: Write the generator**

```ts
import * as XLSX from 'xlsx';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const wb = XLSX.utils.book_new();

const headerSuper = ['', '', '', '', '', '', 'плановые охваты', '', '', 'Фактические охваты', '', ''];
const header = [
  'Тип Внешней Рекламы',
  'Фото конструкции',
  'Город',
  'Адрес расположения',
  'Размер',
  'Период размещения',
  'ots',
  'rating',
  'universe',
  'ots',
  'rating',
  'Прогнозное кол-во выходов в сутки',  // optional last column
];

const exampleRow = ['Крышная конструкция', 'Фото', 'Ташкент', 'Пр. Амира Темура …', '15.58×3', '01.06.2025 - 30.06.2025', 1392831, 79.2, '', 1532112, 87.1, ''];

const data = [headerSuper, header, exampleRow];
const ws = XLSX.utils.aoa_to_sheet(data);
ws['!merges'] = [
  { s: { r: 0, c: 6 }, e: { r: 0, c: 8 } },
  { s: { r: 0, c: 9 }, e: { r: 0, c: 10 } },
];
ws['!cols'] = [
  { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 36 }, { wch: 12 }, { wch: 28 },
  { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 24 },
];

XLSX.utils.book_append_sheet(wb, ws, 'Медиаплан');

const out = 'public/templates/other-carriers-template.xlsx';
mkdirSync(dirname(out), { recursive: true });
XLSX.writeFile(wb, out);
console.log('Wrote', out);
```

- [ ] **Step 2: Run + commit the output**

```powershell
npx tsx scripts/build-other-carriers-template.ts
git add scripts/build-other-carriers-template.ts public/templates/other-carriers-template.xlsx
git commit -m "feat: other-carriers template + generator script"
```

- [ ] **Step 3: Add download link in upload UI**

In `upload-dropzone.tsx`, when `mediaType === 'OTHER_CARRIERS'`, render a small link near the dropzone:

```tsx
<a href="/templates/other-carriers-template.xlsx" download className="text-xs text-[var(--brand-primary)] hover:underline">
  {tu('downloadOtherCarriersTemplate')}
</a>
```

Add the translation string to all three locales.

- [ ] **Step 4: Re-parse the generated template to confirm round-trip**

```powershell
npm run test:parser
```

The multi-period test should still pass. Add a tiny additional test that loads `public/templates/other-carriers-template.xlsx` and asserts the parser returns 1 row.

```ts
// in lib/parser/__tests__/multi-period.test.ts, append:
{
  const tpl = readFileSync(join(process.cwd(), 'public/templates/other-carriers-template.xlsx'));
  const r = parseMultiPeriod(tpl);
  assert.equal(r.errors.length, 0, JSON.stringify(r.errors));
  assert.equal(r.rows.length, 1, `expected 1 example row, got ${r.rows.length}`);
}
```

```powershell
npm run test:parser
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add components/admin/upload-dropzone.tsx messages/ru.json messages/en.json messages/uz.json lib/parser/__tests__/multi-period.test.ts
git commit -m "feat(ui): template download link + parser round-trip test"
```

---

### Task 13: Drop legacy `Screen.type` enum + `Campaign.totalBudgetRub`

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: every code site referencing the legacy fields

This task **requires `--accept-data-loss`**. Confirm with the user before running.

- [ ] **Step 1: Find all remaining references**

```powershell
```

Use `Grep`:
- `\.type\b` in screen contexts (replace with `screenType.code` via include, or keep `typeId` lookups)
- `totalBudgetRub`

- [ ] **Step 2: Replace remaining usages**

Likely call sites:
- `app/[locale]/dashboard/page.tsx` — `totalBudgetRub` reads → use `additionalCurrency`/`additionalAmount` (display only)
- `app/[locale]/admin/campaigns/[id]/page.tsx` — same
- Any analytics/aggregation that reads `screen.type` — switch to `screen.screenType.code` (with `include: { screenType: true }`)

The Task 6 `legacyEnumFor` helper must be removed: replace its callers with the real `typeId`-only flow (no longer write `type` at all).

- [ ] **Step 3: Drop the columns**

In `prisma/schema.prisma`:

```prisma
model Campaign {
  // remove: totalBudgetRub BigInt?
}

model Screen {
  // remove: type ScreenType
  // optionally make typeId required:
  typeId       String
  screenType   ScreenType @relation(fields: [typeId], references: [id])
}

// remove:
// enum ScreenType { LED STATIC STOP AIRPORT BUS }
```

- [ ] **Step 4: Apply with explicit user approval**

Before running, **ask the user**:

> "About to drop `Campaign.totalBudgetRub` and `Screen.type` (and the `ScreenType` enum). Both have been backfilled to their replacements. Confirm with `--accept-data-loss`?"

Then:

```powershell
npx kill-port 3000
npx prisma db push --accept-data-loss
npx prisma generate
npx tsc --noEmit
```

- [ ] **Step 5: Smoke + commit**

```powershell
npm run dev
```

Visit dashboard for a SCREENS campaign and an OTHER_CARRIERS campaign. Verify both render correctly.

```powershell
git add prisma/schema.prisma app/[locale]/dashboard/page.tsx app/[locale]/admin/campaigns/[id]/page.tsx app/api/upload/[id]/confirm/route.ts components/admin/upload-dropzone.tsx
git commit -m "refactor: drop legacy ScreenType enum and totalBudgetRub"
```

---

### Task 14: Documentation + final smoke

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `CLAUDE.md` (add a short "media types" section)

- [ ] **Step 1: Document the new flow in `docs/ARCHITECTURE.md`**

Add a new subsection under section 6 (Parser) describing:
- Two `mediaType` values
- Multi-period file shape (sheet `Медиаплан`, period column F)
- Period auto-creation rule
- Why pricing is form-entered for `OTHER_CARRIERS`

- [ ] **Step 2: Add to `CLAUDE.md`**

Append a short paragraph at the end of "Project structure highlights":

```md
## Media types

A campaign has `mediaType: SCREENS | OTHER_CARRIERS`.
- `SCREENS` — multi-sheet workbook, one row per screen, prices in the file.
- `OTHER_CARRIERS` — single-sheet `Медиаплан`, one row per (screen × period). Periods auto-created from col F. Prices entered in the campaign form.
The toggle is locked once `CampaignPeriod`s or any financial field exist.
```

- [ ] **Step 3: End-to-end smoke**

Run through:
1. New `OTHER_CARRIERS` campaign → fill financials → upload `other_types.xlsx` → confirm → dashboard.
2. New `SCREENS` campaign → upload existing `final_sample.xlsx` → confirm → dashboard.
3. Edit the OTHER_CARRIERS campaign — type select disabled.
4. Delete all periods (Studio or future UI) → reload edit page → type select re-enabled.

- [ ] **Step 4: Commit**

```powershell
git add docs/ARCHITECTURE.md CLAUDE.md
git commit -m "docs: media types + multi-period parser flow"
```

---

## Self-review notes

**Spec coverage**:
- ✅ ScreenType as table not enum (Task 1, 13)
- ✅ Existing data preserved (Task 1 backfill, Task 13 only after backfill complete)
- ✅ `mediaType` toggle on Campaign (Task 2)
- ✅ Toggle locked when periods/financials exist (Task 9)
- ✅ Generic currency pair replaces hardcoded RUB (Task 2 + Task 13)
- ✅ New 11-col template (Task 12)
- ✅ Period auto-create from col F (Task 4 + Task 8)
- ✅ Pricing manual via form (Task 10), not parsed (Task 5)
- ✅ Yandex map still required (existing geocoding pipeline reused unchanged)
- ✅ `impressionsPerDay` optional in template (Task 12 — last column, optional value)
- ✅ Photo optional (existing parser already handles missing hyperlink)

**Out of scope (intentionally deferred)**:
- Per-screen pricing UI — currently campaign-level only. Add later if dashboards demand finer breakdowns.
- Currency conversion in dashboards — `additionalAmount` is display-only.
- Custom Russian month detection beyond `start.getUTCDate() <= 5` — adjust threshold if real-world files use unusual start dates.
