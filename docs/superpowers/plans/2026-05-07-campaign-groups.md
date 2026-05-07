# Campaign Groups (Проекты) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `CampaignGroup` ("Проект") layer so admins can group multiple campaigns (typically a SCREENS + an OTHER_CARRIERS pair representing the same client initiative) under one logical project. Clients see project tiles on the dashboard list, drill into a modal of children, and switch between siblings via a multi-level `<optgroup>` selector.

**Architecture:** New first-class `CampaignGroup` table scoped per-client; `Campaign.groupId` FK with `SetNull` on group delete and `Cascade` on client delete. Two new admin-only API routes (`POST /api/projects`, `GET /api/clients/[id]/projects`) plus `groupId` threaded through existing campaign create/update routes. Client-facing UI extracts a shared `CampaignTile` component reused by the list page and the project modal; selector switches to native `<optgroup>` rendering when groups exist.

**Tech Stack:** Prisma 6, Next.js 14 App Router, next-intl, Zod, Tailwind, native HTML `<select>` / `<optgroup>`. No new runtime dependencies.

**Spec:** [docs/superpowers/specs/2026-05-07-campaign-groups-design.md](../specs/2026-05-07-campaign-groups-design.md)

---

## File map

### Schema / data
- Modify: `prisma/schema.prisma` — add `CampaignGroup`, `Campaign.groupId`, drop `Campaign.project` string
- Modify: `prisma/seed-sample.ts:157` — drop the `project: 'Т-банк OOH 2026'` reference

### API
- Create: `app/api/projects/route.ts` — `POST` (admin) creates a project with `(clientId, name)` dedup
- Create: `app/api/clients/[id]/projects/route.ts` — `GET` (admin) lists projects for one client
- Modify: `app/api/campaigns/route.ts` — accept `groupId` on `POST`
- Modify: `app/api/campaigns/[id]/route.ts` — accept `groupId` on `PUT`

### Pure helper + test
- Create: `lib/campaign-groups.ts` — `partitionCampaigns()` helper
- Create: `lib/__tests__/campaign-groups.test.ts` — assert-based tests
- Create: `lib/__tests__/run.ts` — discover-and-run loop (mirrors `lib/parser/__tests__/run.ts`)
- Modify: `package.json` — add `test:groups` npm script

### Admin
- Modify: `components/admin/campaign-form.tsx` — add toggle + project selector + inline create
- Modify: `app/[locale]/admin/campaigns/page.tsx` — add «Проект» column

### Client-facing dashboard
- Create: `components/dashboard/campaign-tile.tsx` — extracted from inline JSX in `campaigns-list.tsx`
- Create: `components/dashboard/project-tile.tsx` — `<button>` tile with name + child count
- Create: `components/dashboard/project-modal.tsx` — animated modal with children grid
- Modify: `app/[locale]/dashboard/campaigns-list.tsx` — render mixed grid + modal
- Modify: `app/[locale]/dashboard/page.tsx` — load `group` relation, partition for list view, thread `groupId`/`groupName` into selector campaigns
- Modify: `components/ui/campaign-selector.tsx` — render `<optgroup>` when groups exist

### i18n
- Modify: `messages/ru.json`, `messages/en.json`, `messages/uz.json` — new keys per task

---

## Conventions

- **TypeScript gate:** every task ends with `npx tsc --noEmit` + commit. Fail-state = roll back, fix, re-run.
- **Schema gate:** any task that touches `schema.prisma` follows the workflow in `CLAUDE.md` — `npx kill-port 3000` → `npx prisma db push` → `npx prisma generate` → `npx tsc --noEmit` → `npm run dev`.
- **Tests:** the codebase has no general test framework. Pure logic uses the existing `tsx`-driven `assert` pattern (see `lib/parser/__tests__/period.test.ts`). UI/API verification is `tsc --noEmit` + manual browser/cURL.
- **Commit style:** Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `i18n:`). Project memory: never push without explicit user approval — these tasks commit locally only.

---

## Task 1: Schema — add CampaignGroup, drop Campaign.project

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed-sample.ts:157`

- [ ] **Step 1.1: Verify the `project` column has no production data**

Run:

```
npx prisma studio
```

Open the `Campaign` table, confirm every row's `project` cell is empty/null. If any row holds a non-empty value, stop and ask the user before continuing — the `db push` will refuse to drop without `--accept-data-loss`. If all rows are null, close Prisma Studio.

- [ ] **Step 1.2: Edit `prisma/schema.prisma`**

In the `Campaign` block, **remove** this line (around line 124):

```prisma
  project        String?
```

In the same `Campaign` block, **add** the FK line (place it near the top, just below `client`):

```prisma
  groupId        String?
  group          CampaignGroup?   @relation(fields: [groupId], references: [id], onDelete: SetNull)
```

Add an index inside `Campaign`:

```prisma
  @@index([groupId])
```

After the `Campaign` model, add the new model:

```prisma
model CampaignGroup {
  id        String     @id @default(uuid())
  clientId  String
  client    Client     @relation(fields: [clientId], references: [id], onDelete: Cascade)
  name      String
  campaigns Campaign[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@unique([clientId, name])
  @@index([clientId])
}
```

In the existing `Client` block, add the back-relation:

```prisma
  campaignGroups CampaignGroup[]
```

- [ ] **Step 1.3: Fix the seed reference**

Edit `prisma/seed-sample.ts` around line 157. Locate the campaign-create payload that contains `project: 'Т-банк OOH 2026'` and **delete that one line**. The campaign create stays; only the `project` field goes away.

- [ ] **Step 1.4: Apply the schema**

Run sequentially:

```
npx kill-port 3000
npx prisma db push
npx prisma generate
npx tsc --noEmit
```

Expected: `db push` reports the column drop and table create with no `--accept-data-loss` prompt. `tsc --noEmit` exits 0 (any TS errors here mean code referenced `campaign.project` somewhere — fix them by deleting those references; today the field is unused so this should be clean).

- [ ] **Step 1.5: Restart dev server**

```
npm run dev
```

- [ ] **Step 1.6: Commit**

```
git add prisma/schema.prisma prisma/seed-sample.ts
git commit -m "feat(schema): add CampaignGroup table + Campaign.groupId, drop unused project string"
```

---

## Task 2: API — `GET /api/clients/[id]/projects`

**Files:**
- Create: `app/api/clients/[id]/projects/route.ts`

- [ ] **Step 2.1: Create the route file**

Path: `app/api/clients/[id]/projects/route.ts`

Contents:

```ts
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const projects = await prisma.campaignGroup.findMany({
    where: { clientId: id },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(projects);
}
```

- [ ] **Step 2.2: Verify**

```
npx tsc --noEmit
```

Expected: PASS.

Smoke-test in browser dev tools while logged in as admin:

```js
fetch('/api/clients/<some-client-id>/projects').then(r => r.json()).then(console.log)
```

Expected: `[]` (no projects exist yet).

- [ ] **Step 2.3: Commit**

```
git add "app/api/clients/[id]/projects/route.ts"
git commit -m "feat(api): GET /api/clients/[id]/projects (admin)"
```

---

## Task 3: API — `POST /api/projects` with case-insensitive dedup

**Files:**
- Create: `app/api/projects/route.ts`

- [ ] **Step 3.1: Create the route file**

Path: `app/api/projects/route.ts`

Contents:

```ts
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';

const CreateProjectSchema = z.object({
  clientId: z.string().uuid('Invalid client'),
  name: z.string().trim().min(1, 'Name is required').max(120),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const { clientId, name } = parsed.data;

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 400 });
  }

  const dupe = await prisma.campaignGroup.findFirst({
    where: { clientId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (dupe) {
    return NextResponse.json(
      { error: 'project_exists', existing: dupe },
      { status: 409 },
    );
  }

  const project = await prisma.campaignGroup.create({
    data: { clientId, name },
    select: { id: true, name: true },
  });
  return NextResponse.json(project, { status: 201 });
}
```

- [ ] **Step 3.2: Verify**

```
npx tsc --noEmit
```

Expected: PASS.

Smoke-test as admin:

```js
// Create
await fetch('/api/projects', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ clientId: '<id>', name: 'Test project' }),
}).then(r => r.json())
// → { id: '...', name: 'Test project' }

// Duplicate (case-insensitive) → 409
await fetch('/api/projects', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ clientId: '<id>', name: 'TEST PROJECT' }),
}).then(r => r.status)
// → 409
```

Then verify the GET route from Task 2 now returns the new project.

- [ ] **Step 3.3: Commit**

```
git add app/api/projects/route.ts
git commit -m "feat(api): POST /api/projects with per-client case-insensitive dedup"
```

---

## Task 4: API — accept `groupId` on campaign POST/PUT

**Files:**
- Modify: `app/api/campaigns/route.ts`
- Modify: `app/api/campaigns/[id]/route.ts`

- [ ] **Step 4.1: Extend create schema**

In `app/api/campaigns/route.ts`, add to `CreateCampaignSchema` (the Zod object) — alongside the other optional fields:

```ts
  groupId: z.string().uuid().nullable().optional(),
```

The destructure-and-spread in the create call (`const { additionalAmount, totalBudgetUzs, ... ...rest } = parsed.data; ... await prisma.campaign.create({ data: { ...rest, ... } })`) already passes through anything in `rest`, so `groupId` reaches Prisma untouched once it's in the schema. **However**, Prisma will reject a string `groupId` that points to a different client's project — guard explicitly:

After `const parsed = ... .safeParse(body);` and before `prisma.campaign.create`, insert:

```ts
    if (parsed.data.groupId != null) {
      const grp = await prisma.campaignGroup.findUnique({
        where: { id: parsed.data.groupId },
        select: { clientId: true },
      });
      if (!grp || grp.clientId !== parsed.data.clientId) {
        return NextResponse.json(
          { error: 'group_client_mismatch' },
          { status: 400 },
        );
      }
    }
```

- [ ] **Step 4.2: Extend update schema**

In `app/api/campaigns/[id]/route.ts`, add to `UpdateCampaignSchema`:

```ts
  groupId: z.string().uuid().nullable().optional(),
```

After the `existing` lookup but before `prisma.campaign.update`, validate the same client constraint. Replace the existing `existing` `select` to include `clientId`:

```ts
  const existing = await prisma.campaign.findUnique({
    where: { id },
    select: {
      clientId: true,                    // add this
      mediaType: true,
      periodStart: true,
      totalBudgetUzs: true,
      productionCost: true,
      totalFinal: true,
      additionalAmount: true,
      _count: { select: { periods: true } },
    },
  });
```

Then, immediately after the `mediaType` lock check (after the `if (parsed.data.mediaType && ...)` block, around line 86), insert:

```ts
  if (parsed.data.groupId !== undefined && parsed.data.groupId !== null) {
    const grp = await prisma.campaignGroup.findUnique({
      where: { id: parsed.data.groupId },
      select: { clientId: true },
    });
    if (!grp || grp.clientId !== existing.clientId) {
      return NextResponse.json(
        { error: 'group_client_mismatch' },
        { status: 400 },
      );
    }
  }
```

The existing `update({ data: { ...rest, ... } })` already forwards `groupId` from `rest` (since it's not in the special-cased destructure list). No further change needed.

- [ ] **Step 4.3: Verify**

```
npx tsc --noEmit
```

Expected: PASS.

Smoke-test:

```js
// Create campaign with groupId
await fetch('/api/campaigns', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    name: 'Test', clientId: '<id>', groupId: '<project-id>',
    periodStart: '2026-01-01', periodEnd: '2026-01-31',
  }),
}).then(r => r.status)
// → 201

// Update with mismatched group → 400
await fetch('/api/campaigns/<id>', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ groupId: '<project-from-different-client>' }),
}).then(r => r.status)
// → 400

// Detach group
await fetch('/api/campaigns/<id>', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ groupId: null }),
}).then(r => r.status)
// → 200
```

- [ ] **Step 4.4: Commit**

```
git add "app/api/campaigns/route.ts" "app/api/campaigns/[id]/route.ts"
git commit -m "feat(api): campaign create/update accept groupId with client-match guard"
```

---

## Task 5: Pure helper — `partitionCampaigns()` + tests

**Files:**
- Create: `lib/campaign-groups.ts`
- Create: `lib/__tests__/campaign-groups.test.ts`
- Create: `lib/__tests__/run.ts`
- Modify: `package.json`

- [ ] **Step 5.1: Write the failing test first**

Path: `lib/__tests__/campaign-groups.test.ts`

```ts
import assert from 'node:assert/strict';
import { partitionCampaigns, type InputCampaign } from '../campaign-groups';

const c = (
  id: string,
  createdAt: string,
  groupId: string | null = null,
  groupName: string | null = null,
): InputCampaign => ({
  id,
  groupId,
  groupName,
  createdAt: new Date(createdAt),
});

// 1. No groups → all ungrouped, sorted by createdAt desc
{
  const out = partitionCampaigns([
    c('a', '2026-01-01'),
    c('b', '2026-03-01'),
    c('c', '2026-02-01'),
  ]);
  assert.equal(out.projects.length, 0);
  assert.deepEqual(out.ungrouped.map(x => x.id), ['b', 'c', 'a']);
}

// 2. Mixed groups + ungrouped, project bubbles by latest child createdAt
{
  const out = partitionCampaigns([
    c('a', '2026-01-01', 'g1', 'Project One'),  // older child
    c('b', '2026-04-01', 'g1', 'Project One'),  // newer child → bubbles g1
    c('c', '2026-02-01'),                       // ungrouped
    c('d', '2026-03-01', 'g2', 'Project Two'),  // single child of g2
  ]);
  assert.equal(out.projects.length, 2);
  // representative date desc: g1 (apr) → g2 (mar) → ungrouped 'c' (feb)
  assert.deepEqual(
    [...out.projects.map(p => p.id), ...out.ungrouped.map(u => u.id)],
    ['g1', 'g2', 'c'],
  );
  // children kept in same input order within their project
  assert.deepEqual(out.projects[0].children.map(x => x.id), ['a', 'b']);
}

// 3. Empty projects (no children) are filtered out
//    — caller should never pass them, but be defensive
{
  const out = partitionCampaigns([
    c('a', '2026-01-01'),
  ]);
  assert.equal(out.projects.length, 0);
  assert.equal(out.ungrouped.length, 1);
}

// 4. Group with groupId but missing groupName falls into ungrouped (defensive)
{
  const out = partitionCampaigns([
    c('a', '2026-01-01', 'g1', null),
  ]);
  assert.equal(out.projects.length, 0);
  assert.equal(out.ungrouped.length, 1);
}
```

- [ ] **Step 5.2: Add the runner**

Path: `lib/__tests__/run.ts`

```ts
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(__dirname).filter(f => f.endsWith('.test.ts')).sort();

async function main() {
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
}

main();
```

- [ ] **Step 5.3: Add the npm script**

Edit `package.json` — in `"scripts"`, add after `test:parser`:

```json
    "test:groups": "tsx lib/__tests__/run.ts",
```

- [ ] **Step 5.4: Run the test — expect FAIL**

```
npm run test:groups
```

Expected: `FAIL: Cannot find module ... campaign-groups`

- [ ] **Step 5.5: Implement the helper**

Path: `lib/campaign-groups.ts`

```ts
export interface InputCampaign {
  id: string;
  groupId: string | null;
  groupName: string | null;
  createdAt: Date;
  // pass-through — the caller hands us whatever else it needs to render
  [key: string]: unknown;
}

export interface ProjectGroup<T extends InputCampaign = InputCampaign> {
  id: string;          // groupId
  name: string;
  children: T[];
  representativeDate: Date;  // max(child.createdAt)
}

export interface Partitioned<T extends InputCampaign = InputCampaign> {
  projects: ProjectGroup<T>[];
  ungrouped: T[];
}

/**
 * Splits a flat campaign list into projects (each with its children) and
 * ungrouped campaigns. Projects sort by their newest child's createdAt;
 * ungrouped sort by their own createdAt; both desc.
 *
 * Defensive: a campaign with `groupId` but no `groupName` is treated as
 * ungrouped (shouldn't happen if the caller selects `group { id, name }`).
 */
export function partitionCampaigns<T extends InputCampaign>(
  campaigns: T[],
): Partitioned<T> {
  const byGroup = new Map<string, { name: string; children: T[]; rep: Date }>();
  const ungrouped: T[] = [];

  for (const c of campaigns) {
    if (c.groupId && c.groupName) {
      const slot = byGroup.get(c.groupId);
      if (slot) {
        slot.children.push(c);
        if (c.createdAt > slot.rep) slot.rep = c.createdAt;
      } else {
        byGroup.set(c.groupId, {
          name: c.groupName,
          children: [c],
          rep: c.createdAt,
        });
      }
    } else {
      ungrouped.push(c);
    }
  }

  const projects: ProjectGroup<T>[] = [...byGroup.entries()].map(
    ([id, { name, children, rep }]) => ({
      id,
      name,
      children,
      representativeDate: rep,
    }),
  );

  // Combined desc-by-date ordering happens at the call site (it depends on
  // ungrouped's createdAt too). But sort projects by their own representative
  // date here so callers can rely on a stable internal order.
  projects.sort((a, b) => b.representativeDate.getTime() - a.representativeDate.getTime());
  ungrouped.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return { projects, ungrouped };
}
```

- [ ] **Step 5.6: Run the test — expect PASS**

```
npm run test:groups
```

Expected: `All 1 files passed`.

- [ ] **Step 5.7: Typecheck**

```
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5.8: Commit**

```
git add lib/campaign-groups.ts lib/__tests__/ package.json
git commit -m "feat(lib): partitionCampaigns helper + assert-based tests"
```

---

## Task 6: Admin form — toggle + project selector + inline create

**Files:**
- Modify: `components/admin/campaign-form.tsx`
- Modify: `messages/ru.json`, `messages/en.json`, `messages/uz.json`

- [ ] **Step 6.1: Add i18n keys**

For each of `messages/ru.json`, `messages/en.json`, `messages/uz.json` — under the existing `forms` namespace, add:

```json
    "belongsToProject": "...",
    "projectLabel": "...",
    "projectPlaceholder": "...",
    "projectCreateNew": "...",
    "projectNewName": "...",
    "projectSaveNew": "...",
    "projectCancelNew": "...",
    "projectExists": "..."
```

Translations:

| key | ru | en | uz |
|---|---|---|---|
| belongsToProject | Принадлежит проекту | Part of a project | Loyihaga tegishli |
| projectLabel | Проект | Project | Loyiha |
| projectPlaceholder | Выберите проект… | Choose a project… | Loyihani tanlang… |
| projectCreateNew | + Создать новый | + Create new | + Yangi yaratish |
| projectNewName | Название проекта | Project name | Loyiha nomi |
| projectSaveNew | Сохранить | Save | Saqlash |
| projectCancelNew | Отмена | Cancel | Bekor qilish |
| projectExists | Проект с таким именем уже существует | A project with this name already exists | Bunday nomli loyiha allaqachon mavjud |

- [ ] **Step 6.2: Extend `CampaignFormProps` and `DraftState`**

In `components/admin/campaign-form.tsx`:

In the `initial?: { ... }` shape inside `CampaignFormProps` (after `mediaType?`):

```ts
    groupId?: string | null;
```

In `DraftState` (after `mediaType`):

```ts
  belongsToProject: boolean;
  groupId: string;
```

In `loadDraft` no change is needed — the schema is just JSON.

- [ ] **Step 6.3: Add state + project list fetch**

After the `additionalAmount` `useState` hook (around line 105), add:

```tsx
  const [belongsToProject, setBelongsToProject] = useState<boolean>(
    !!initial?.groupId,
  );
  const [groupId, setGroupId] = useState<string>(initial?.groupId ?? '');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectSaveError, setProjectSaveError] = useState<string | null>(null);
  const [projectSaving, setProjectSaving] = useState(false);
```

Below the existing `useEffect`s for the draft, add a new effect that loads projects when `clientId` changes:

```tsx
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

  // Switching client invalidates a stale project selection.
  useEffect(() => {
    if (!initial && clientId) {
      // new-campaign flow: drop the selection silently
      setBelongsToProject(false);
      setGroupId('');
      setCreatingProject(false);
      setNewProjectName('');
    }
    // For edits, the FK is already correct since the API guards client-match.
    // We still re-fetch the project list (above effect handles it).
  }, [clientId, initial]);
```

- [ ] **Step 6.4: Wire `groupId` into the submit payload**

Find where the form builds its POST/PUT body (in this file, the body is composed inline at submit). Add to that body, alongside `clientId`/`name`/etc.:

```tsx
      groupId: belongsToProject && groupId ? groupId : null,
```

If you can't immediately spot the exact submit call, search for `clientId,` inside the file and add `groupId` next to it in the request body.

- [ ] **Step 6.5: Render the toggle + selector UI**

Locate the existing client `<select>` block (shown around lines 260-275 of the current file — labeled `tf('company')`). **Immediately after that block's closing `</div>`**, insert the new project section:

```tsx
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
```

- [ ] **Step 6.6: Update the `initial` shape passed to the form**

Find where the parent page renders `<CampaignForm initial={...}>` — typically `app/[locale]/admin/campaigns/[id]/edit/page.tsx`. The `initial` object is built from a Prisma campaign row. Add to that object:

```ts
        groupId: campaign.groupId,
```

(Where `campaign` is the row already fetched. If the existing fetch doesn't select `groupId`, extend the `select` to include it.)

- [ ] **Step 6.7: Verify**

```
npx tsc --noEmit
```

Manual smoke: open `/[locale]/admin/campaigns/new`, pick a client, toggle the new checkbox, click "+ Create new", type a name, save → the project appears as the selected option. Submit the campaign, then re-edit it — the toggle stays ON and the project remains selected.

- [ ] **Step 6.8: Commit**

```
git add components/admin/campaign-form.tsx messages/ "app/[locale]/admin/campaigns/[id]/edit/page.tsx"
git commit -m "feat(admin): campaign form — toggle + project selector + inline create"
```

---

## Task 7: Admin campaigns table — add «Проект» column

**Files:**
- Modify: `app/[locale]/admin/campaigns/page.tsx`
- Modify: `messages/ru.json`, `messages/en.json`, `messages/uz.json`

- [ ] **Step 7.1: Add the i18n key**

In each of `messages/{ru,en,uz}.json`, under `admin`:

```json
    "tableProject": "Проект"   // ru
    "tableProject": "Project"  // en
    "tableProject": "Loyiha"   // uz
```

- [ ] **Step 7.2: Extend the Prisma include**

In `app/[locale]/admin/campaigns/page.tsx`, at the `prisma.campaign.findMany` call (around line 25):

```ts
  const campaigns = await prisma.campaign.findMany({
    include: {
      client: { select: { name: true } },
      group: { select: { name: true } },              // add
      _count: { select: { screens: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
```

- [ ] **Step 7.3: Insert the column**

In the `<thead>`, add a new `<th>` between «Компания» (`tableCompany`) and «Статус» (`tableStatus`):

```tsx
<th className="border-b border-[var(--border)] px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-3)]">{t('tableProject')}</th>
```

In each `<tr>` body row, add a corresponding `<td>` between the company `<td>` and the status `<td>`:

```tsx
<td className="border-b border-[var(--border)] px-4 py-3 text-sm text-[var(--text-2)]">
  {c.group?.name ?? '—'}
</td>
```

Update the empty-state `colSpan` from `5` to `6`.

- [ ] **Step 7.4: Verify**

```
npx tsc --noEmit
```

Open `/admin/campaigns` — the column appears, populated for grouped campaigns, `—` for ungrouped.

- [ ] **Step 7.5: Commit**

```
git add "app/[locale]/admin/campaigns/page.tsx" messages/
git commit -m "feat(admin): campaigns table — Project column"
```

---

## Task 8: Refactor — extract `<CampaignTile>` from campaigns-list

**Files:**
- Create: `components/dashboard/campaign-tile.tsx`
- Modify: `app/[locale]/dashboard/campaigns-list.tsx`

This refactor pre-stages the modal rebuild — the tile renders identically in both contexts after this.

- [ ] **Step 8.1: Create the tile component**

Path: `components/dashboard/campaign-tile.tsx`

```tsx
import Link from 'next/link';
import { type DateFormat, formatCampaignPeriod } from '@/lib/format-period';

export interface CampaignTileData {
  id: string;
  name: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  screensCount: number;
}

interface Props {
  campaign: CampaignTileData;
  href: string;
  locale: string;
  dateFormat: DateFormat;
  statusLabel: string;
  screensLabel: string;
}

export function CampaignTile({ campaign: c, href, locale, dateFormat, statusLabel, screensLabel }: Props) {
  const period = formatCampaignPeriod(c.periodStart, c.periodEnd, locale, dateFormat);
  const isActive = c.status === 'ACTIVE';
  return (
    <Link
      href={href}
      className="group relative rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:border-[var(--border-hi)] hover:shadow-[var(--shadow-md)]"
    >
      {isActive && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[rgba(16,185,129,0.12)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] text-[var(--success)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
          {statusLabel}
        </span>
      )}
      <h3 className="pr-16 text-[16px] font-semibold tracking-tight text-[var(--text)] group-hover:text-[var(--brand-primary)]">
        {c.name}
      </h3>
      <p className="mt-0.5 text-[12px] text-[var(--text-3)]" style={{ fontFamily: 'var(--font-mono)' }}>
        {period}
      </p>
      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]">{screensLabel}</p>
          <p className="mt-0.5 text-[15px] font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
            {c.screensCount.toLocaleString('ru-RU')}
          </p>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 8.2: Replace the inline tile in `campaigns-list.tsx`**

In `app/[locale]/dashboard/campaigns-list.tsx`:

Add the import at top:

```ts
import { CampaignTile } from '@/components/dashboard/campaign-tile';
```

Find the `rows.map(r => { ... return <Link ...> ... </Link> })` block and replace it with:

```tsx
        {rows.map(r => (
          <CampaignTile
            key={r.id}
            campaign={{
              id: r.id,
              name: r.name,
              status: r.status,
              periodStart: r.periodStart,
              periodEnd: r.periodEnd,
              screensCount: r.screensCount,
            }}
            href={`/${locale}/dashboard?campaign=${r.id}`}
            locale={locale}
            dateFormat={dateFormat}
            statusLabel={tStatus(r.status)}
            screensLabel={tc('colScreens')}
          />
        ))}
```

Delete the now-unused local `Stat` helper at the bottom of the file. The `formatCampaignPeriod` import is still used elsewhere — leave it; if not, the typecheck will complain and it can be removed.

- [ ] **Step 8.3: Verify**

```
npx tsc --noEmit
```

Visual check: the dashboard list renders identically to before.

- [ ] **Step 8.4: Commit**

```
git add components/dashboard/campaign-tile.tsx "app/[locale]/dashboard/campaigns-list.tsx"
git commit -m "refactor(dashboard): extract CampaignTile component"
```

---

## Task 9: `<ProjectTile>` component

**Files:**
- Create: `components/dashboard/project-tile.tsx`
- Modify: `messages/{ru,en,uz}.json`

- [ ] **Step 9.1: Add i18n keys**

Under `campaignsPage` in each messages file:

| key | ru | en | uz |
|---|---|---|---|
| projectTileLabel | КАМПАНИИ | CAMPAIGNS | KAMPANIYALAR |

- [ ] **Step 9.2: Create the component**

Path: `components/dashboard/project-tile.tsx`

```tsx
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
```

- [ ] **Step 9.3: Verify**

```
npx tsc --noEmit
```

Expected: PASS. (Component is unused yet — that's fine; Task 11 wires it.)

- [ ] **Step 9.4: Commit**

```
git add components/dashboard/project-tile.tsx messages/
git commit -m "feat(dashboard): ProjectTile component (name + child count, no status/period)"
```

---

## Task 10: `<ProjectModal>` component

**Files:**
- Create: `components/dashboard/project-modal.tsx`
- Modify: `messages/{ru,en,uz}.json`

- [ ] **Step 10.1: Add i18n keys**

Under `campaignsPage`:

| key | ru | en | uz |
|---|---|---|---|
| projectModalClose | Закрыть | Close | Yopish |
| projectEmpty | В этом проекте пока нет кампаний | No campaigns in this project yet | Ushbu loyihada hali kampaniyalar yo'q |
| projectChildCount | "{count, plural, =0 {нет кампаний} =1 {1 кампания} few {# кампании} other {# кампаний}}" | "{count, plural, =0 {no campaigns} =1 {1 campaign} other {# campaigns}}" | "{count, plural, =0 {kampaniya yo'q} =1 {1 ta kampaniya} other {# ta kampaniya}}" |

- [ ] **Step 10.2: Create the component**

Path: `components/dashboard/project-modal.tsx`

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CampaignTile, type CampaignTileData } from './campaign-tile';
import { type DateFormat } from '@/lib/format-period';

interface Props {
  projectName: string;
  children: CampaignTileData[];
  locale: string;
  dateFormat: DateFormat;
  statusLabelFor: (status: string) => string;
  screensLabel: string;
  onClose: () => void;
}

export function ProjectModal({
  projectName, children, locale, dateFormat,
  statusLabelFor, screensLabel, onClose,
}: Props) {
  const tc = useTranslations('campaignsPage');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Esc dismiss
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus trap entry — focus the close button on mount
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLButtonElement>('[data-close]')?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={projectName}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      style={{ animation: 'projectModalBackdrop 220ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      <style>{`
        @keyframes projectModalBackdrop { from { opacity: 0 } to { opacity: 1 } }
        @keyframes projectModalPanel {
          from { opacity: 0; transform: scale(0.92) }
          to   { opacity: 1; transform: scale(1) }
        }
      `}</style>
      <div
        ref={dialogRef}
        className="relative max-h-[85vh] w-[min(90vw,720px)] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
        style={{ animation: 'projectModalPanel 220ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
      >
        <button
          type="button"
          data-close
          aria-label={tc('projectModalClose')}
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
        <h2 className="text-[22px] font-medium tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {projectName}
        </h2>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          {tc('projectChildCount', { count: children.length })}
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {children.length === 0 ? (
            <p className="col-span-full py-8 text-center text-sm text-[var(--text-3)]">
              {tc('projectEmpty')}
            </p>
          ) : (
            children.map(c => (
              <CampaignTile
                key={c.id}
                campaign={c}
                href={`/${locale}/dashboard?campaign=${c.id}`}
                locale={locale}
                dateFormat={dateFormat}
                statusLabel={statusLabelFor(c.status)}
                screensLabel={screensLabel}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 10.3: Verify**

```
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 10.4: Commit**

```
git add components/dashboard/project-modal.tsx messages/
git commit -m "feat(dashboard): ProjectModal — children grid + Esc/backdrop dismiss"
```

---

## Task 11: Wire campaigns-list — partition + render mixed grid + modal

**Files:**
- Modify: `app/[locale]/dashboard/page.tsx`
- Modify: `app/[locale]/dashboard/campaigns-list.tsx`

- [ ] **Step 11.1: Extend the page-level Prisma query**

In `app/[locale]/dashboard/page.tsx`, locate the `aggCampaigns = await prisma.campaign.findMany(...)` call inside the `if (!campaignIdParam)` branch. Extend its `select`:

```ts
        groupId: true,
        group: { select: { id: true, name: true } },
```

- [ ] **Step 11.2: Build the row data with group info**

The rows handed to `<CampaignsListView>` need group identity. Where the page currently maps `aggCampaigns` into `rows`, add to each row object:

```ts
        groupId: c.groupId,
        groupName: c.group?.name ?? null,
        createdAt: c.createdAt,
```

(Verify the `select` already pulls `createdAt`. If not, add it.)

- [ ] **Step 11.3: Update `CampaignsListView` props**

In `app/[locale]/dashboard/campaigns-list.tsx`:

Extend the `Row` interface:

```ts
interface Row {
  id: string;
  name: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  budget: number;
  screensCount: number;
  otsPlan: number;
  groupId: string | null;
  groupName: string | null;
  createdAt: Date;
}
```

- [ ] **Step 11.4: Convert to a client component for the modal**

The modal needs `useState`. Split this file: `CampaignsListView` stays as a server component for the KPI strip + heading, but delegate the tile grid to a new client child.

At the bottom of `app/[locale]/dashboard/campaigns-list.tsx`, **replace** the `rows.map(...)` grid with a `<TileGrid>` invocation, and add the new client component file:

Path: `app/[locale]/dashboard/tile-grid.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CampaignTile, type CampaignTileData } from '@/components/dashboard/campaign-tile';
import { ProjectTile } from '@/components/dashboard/project-tile';
import { ProjectModal } from '@/components/dashboard/project-modal';
import { partitionCampaigns, type InputCampaign } from '@/lib/campaign-groups';
import type { DateFormat } from '@/lib/format-period';

export interface TileGridRow extends CampaignTileData {
  groupId: string | null;
  groupName: string | null;
  createdAt: Date;
}

interface Props {
  rows: TileGridRow[];
  locale: string;
  dateFormat: DateFormat;
}

export function TileGrid({ rows, locale, dateFormat }: Props) {
  const tc = useTranslations('campaignsPage');
  const tStatus = useTranslations('campaignStatus');
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

  const { projects, ungrouped } = partitionCampaigns(rows);

  // Combined render order: projects + ungrouped sorted together by date desc.
  const merged: Array<
    | { kind: 'project'; id: string; name: string; children: TileGridRow[]; date: Date }
    | { kind: 'campaign'; row: TileGridRow; date: Date }
  > = [
    ...projects.map(p => ({ kind: 'project' as const, id: p.id, name: p.name, children: p.children, date: p.representativeDate })),
    ...ungrouped.map(u => ({ kind: 'campaign' as const, row: u, date: u.createdAt })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const openProject = projects.find(p => p.id === openProjectId);

  return (
    <>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {merged.map(item => item.kind === 'project' ? (
          <ProjectTile
            key={`p-${item.id}`}
            name={item.name}
            childCount={item.children.length}
            childCountLabel={tc('projectTileLabel')}
            onOpen={() => setOpenProjectId(item.id)}
          />
        ) : (
          <CampaignTile
            key={`c-${item.row.id}`}
            campaign={item.row}
            href={`/${locale}/dashboard?campaign=${item.row.id}`}
            locale={locale}
            dateFormat={dateFormat}
            statusLabel={tStatus(item.row.status)}
            screensLabel={tc('colScreens')}
          />
        ))}
      </div>

      {openProject && (
        <ProjectModal
          projectName={openProject.name}
          children={openProject.children}
          locale={locale}
          dateFormat={dateFormat}
          statusLabelFor={s => tStatus(s)}
          screensLabel={tc('colScreens')}
          onClose={() => setOpenProjectId(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 11.5: Use `TileGrid` from the server component**

In `campaigns-list.tsx`, replace the `<div className="grid...">{rows.map(...)}</div>` block (the whole tile loop) with:

```tsx
      <TileGrid rows={rows} locale={locale} dateFormat={dateFormat} />
```

Add the import at top:

```ts
import { TileGrid } from './tile-grid';
```

You can now also delete any imports made unused by the move (`CampaignTile`, `formatCampaignPeriod` if it was added in Task 8 and is no longer used here, etc.). Run `tsc --noEmit` and trim what it complains about.

- [ ] **Step 11.6: Verify**

```
npx tsc --noEmit
```

Manual smoke:
1. Create two campaigns under the same client; assign one to a new project, leave the other ungrouped.
2. Open `/[locale]/dashboard` — see one project tile + one ungrouped campaign tile, ordered by recency.
3. Click the project tile → modal animates open, child renders inside.
4. Click the child → navigates to its dashboard view (modal unmounts via route change).
5. Reopen the modal, press Esc / click backdrop / click X → modal closes.

- [ ] **Step 11.7: Commit**

```
git add "app/[locale]/dashboard/page.tsx" "app/[locale]/dashboard/campaigns-list.tsx" "app/[locale]/dashboard/tile-grid.tsx"
git commit -m "feat(dashboard): mixed project+campaign tile grid with drilldown modal"
```

---

## Task 12: Multi-level `<optgroup>` campaign selector

**Files:**
- Modify: `components/ui/campaign-selector.tsx`
- Modify: `app/[locale]/dashboard/page.tsx`
- Modify: `app/[locale]/dashboard/dashboard-client.tsx`
- Modify: `messages/{ru,en,uz}.json`

- [ ] **Step 12.1: Add the «Без проекта» i18n key**

Under `dashboard` in each messages file:

| key | ru | en | uz |
|---|---|---|---|
| selectorUngrouped | Без проекта | No project | Loyihasiz |

- [ ] **Step 12.2: Update `CampaignSelector`**

In `components/ui/campaign-selector.tsx`, replace the file with:

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { type DateFormat, formatCampaignPeriod } from '@/lib/format-period';

interface Campaign {
  id: string;
  name: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  groupId: string | null;
  groupName: string | null;
}

function campaignLabel(c: Campaign, dateFormat: DateFormat, locale: string): string {
  if (c.periodStart && c.periodEnd) {
    const start = new Date(c.periodStart);
    const end = new Date(c.periodEnd);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return `${c.name}. ${formatCampaignPeriod(start, end, locale, dateFormat)}`;
    }
  }
  return c.name;
}

export function CampaignSelector({
  campaigns,
  currentId,
  locale,
  dateFormat = 'smart_hybrid',
}: {
  campaigns: Campaign[];
  currentId: string;
  locale: string;
  dateFormat?: DateFormat;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('dashboard');

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('campaign', e.target.value);
    router.push(`/${locale}/dashboard?${params.toString()}`);
    router.refresh();
  }

  // Partition: grouped campaigns by group, ungrouped flat
  const byGroup = new Map<string, { name: string; items: Campaign[] }>();
  const ungrouped: Campaign[] = [];
  for (const c of campaigns) {
    if (c.groupId && c.groupName) {
      const slot = byGroup.get(c.groupId);
      if (slot) slot.items.push(c);
      else byGroup.set(c.groupId, { name: c.groupName, items: [c] });
    } else {
      ungrouped.push(c);
    }
  }
  const groupArr = [...byGroup.entries()]
    .map(([id, { name, items }]) => ({ id, name, items }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const hasGroups = groupArr.length > 0;

  return (
    <div className="relative w-full sm:w-auto">
      <select
        value={currentId}
        onChange={handleChange}
        className="w-full min-h-[44px] appearance-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] py-2 pl-3 pr-8 text-[13px] transition-colors hover:border-[var(--border-hi)] focus:border-[var(--border-em)] focus:outline-none sm:w-auto sm:min-h-0 sm:py-1.5"
      >
        {hasGroups ? (
          <>
            {groupArr.map(g => (
              <optgroup key={g.id} label={g.name}>
                {g.items.map(c => (
                  <option key={c.id} value={c.id}>{campaignLabel(c, dateFormat, locale)}</option>
                ))}
              </optgroup>
            ))}
            {ungrouped.length > 0 && (
              <optgroup label={t('selectorUngrouped')}>
                {ungrouped.map(c => (
                  <option key={c.id} value={c.id}>{campaignLabel(c, dateFormat, locale)}</option>
                ))}
              </optgroup>
            )}
          </>
        ) : (
          campaigns.map(c => (
            <option key={c.id} value={c.id}>{campaignLabel(c, dateFormat, locale)}</option>
          ))
        )}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
    </div>
  );
}
```

- [ ] **Step 12.3: Thread `groupId`/`groupName` from the page**

In `app/[locale]/dashboard/page.tsx`, find the two places (around line 472 and line 480) where the `campaigns` array is built for `<DashboardClient>`. They look like:

```ts
        clientName: c.client.name,
```

Add to each inline object:

```ts
        groupId: c.groupId,
        groupName: c.group?.name ?? null,
```

(`group: { select: { id: true, name: true } }` was already added in Task 11. Verify it's also part of the same Prisma `findMany` used here — if this part of the page uses a different query, extend that one too.)

- [ ] **Step 12.4: Update `DashboardClient` props**

In `app/[locale]/dashboard/dashboard-client.tsx`, in the `Props` interface, replace:

```ts
  campaigns: { id: string; name: string; status: string; clientName: string; periodStart: string; periodEnd: string }[];
```

with:

```ts
  campaigns: { id: string; name: string; status: string; periodStart: string; periodEnd: string; groupId: string | null; groupName: string | null }[];
```

(Drop `clientName` — already unused since this morning's earlier change.)

The `campaign` (singular) prop can drop `clientName` too if it's not used:

```ts
  campaign: { name: string; periodStart: string; periodEnd: string; status: string };
```

If TS complains about removed fields, search the file for `clientName` and clean up.

- [ ] **Step 12.5: Verify**

```
npx tsc --noEmit
```

Manual smoke:
1. With zero projects → selector still renders flat (regression check).
2. With projects → opens with `<optgroup>` headers, ungrouped under «Без проекта».
3. Selecting any option still routes to the right campaign.

- [ ] **Step 12.6: Commit**

```
git add components/ui/campaign-selector.tsx "app/[locale]/dashboard/page.tsx" "app/[locale]/dashboard/dashboard-client.tsx" messages/
git commit -m "feat(dashboard): multi-level campaign selector via <optgroup>"
```

---

## Task 13: Smoke pass — full feature exercise

This task is verification, not implementation.

- [ ] **Step 13.1: Run all gates**

```
npx tsc --noEmit
npm run test:groups
npm run test:parser
```

Expected: all pass.

- [ ] **Step 13.2: Walk the user journeys**

1. **Admin creates a project from a new campaign.** `/admin/campaigns/new` → pick client → toggle ON → "+ Create new" → save name → save campaign. Project is now in the list.
2. **Admin reuses the project on a second campaign of the same client.** Same flow, but pick the existing name from the dropdown. Save.
3. **Admin reassigns.** Edit campaign #2 → change project to a different one. Save.
4. **Admin removes from project.** Edit campaign #2 → toggle OFF. Save.
5. **Admin tries duplicate.** "+ Create new" → enter the existing name (any case). Form shows «Проект с таким именем уже существует».
6. **Admin sees the column.** `/admin/campaigns` shows «Проект» populated for grouped rows.
7. **Client list view.** `/dashboard` mixes a project tile + ungrouped tiles.
8. **Modal.** Click project tile → modal opens, children render. Esc / backdrop / X dismiss.
9. **Selector.** Open a campaign in the project → selector shows `<optgroup>` per project + «Без проекта» for ungrouped.
10. **Empty project edge case.** Delete all children of a project (admin-side). Confirm: project tile disappears from `/dashboard`; selector emits no optgroup; the empty `CampaignGroup` row remains in the DB (visible via Prisma Studio).

- [ ] **Step 13.3: No commit; this is a verification task**

---

## Self-review notes

- **Spec coverage check:** every section of the spec is mapped to a task above (schema → 1; API → 2/3/4; admin form → 6; admin table → 7; helper → 5; list page + modal → 8/9/10/11; selector → 12; i18n folded into the relevant tasks; lifecycle (orphan tolerated) is enforced by the `partitionCampaigns` filter in step 5.5 + the empty-project filtering in `TileGrid`; cascade is in the schema definition).
- **Pre-existing constraints respected:** the schema workflow in `CLAUDE.md` (kill-port → db push → generate → tsc → restart) is in Task 1. Conventional commit format matches recent history.
- **Out of scope (deferred per spec):** "manage projects" admin page (rename/delete projects), filter/sort UI on the new admin column, project-level dashboard. These are not in this plan.
