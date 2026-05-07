# Campaign groups (Проекты) — design

**Date:** 2026-05-07
**Status:** Approved (pending implementation plan)
**Author:** brainstorming session, beck + claude

## Problem

A single real-world client initiative can be split across two campaigns because of the `mediaType` divide introduced last week (`SCREENS` vs `OTHER_CARRIERS`). Today these surface in the client-facing list at `/[locale]/dashboard` as two unrelated tiles. We need a way to group them so a client sees one logical project and can drill into its child campaigns.

## Non-goals

- A "manage projects" admin page (list, rename, delete projects). Out of scope; admins manage projects implicitly through the campaign edit form.
- Aggregated KPIs at the project level (no "Project dashboard" view, no rolled-up Общий бюджет/OTS for a project). Top KPIs on the list page still aggregate across all client campaigns.
- Filter/sort UI for the new admin table column. Deferred.
- Cross-client projects. Each project belongs to exactly one client.

## Data model

### New table: `CampaignGroup`

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

User-facing label: «Проект» / "Project" / "Loyiha". Internal name `CampaignGroup` keeps `Project` namespace free (Next.js, Prisma generators).

### `Campaign` changes

- Add `groupId String?` and relation `group CampaignGroup? @relation(...)` with `onDelete: SetNull`.
- **Drop** the existing unused `project: String?` column. Single seed-data reference (`prisma/seed-sample.ts:157`) — fix the seed, then a regular `prisma db push` is sufficient (no `--accept-data-loss` needed in dev because the column is empty everywhere except seed).

### `Client`

No schema change; the relation reverse is implicit via `CampaignGroup.client`.

## Admin form (campaign create/edit)

In the existing campaign form, between «Client» and «Period», add a new sub-section:

```
☐ Принадлежит проекту       ← toggle, i18n key admin.formBelongsToProject

When ON:

  Проект *
  [ Searchable dropdown ▾ ]
    ├─ <existing projects for the selected client>
    └─ + Создать новый…
```

### Behavior rules

- Toggle is disabled until a client is selected (groups are scoped to the client).
- Switching client clears the project selection and the toggle reverts to OFF.
- Toggling OFF clears `groupId` in the form's local state. Persisted on submit.
- Clicking «+ Создать новый…» swaps the dropdown for an inline `<input>` + Сохранить / Отмена. Save POSTs to `/api/projects`, returns `{ id, name }`, and that becomes the selection.

### New API surface

- `GET /api/clients/[id]/projects` → `[{ id, name }]`. Admin-only.
- `POST /api/projects` body `{ clientId, name }` → `{ id, name }`. Admin-only. **409** on `(clientId, name)` duplicate (case-insensitive). **400** if the admin lacks permission for the client.
- The existing campaign `POST` and `PUT` routes (`/api/campaigns`, `/api/campaigns/[id]`) accept an optional `groupId: string | null` field. No breaking change for existing payloads.

### Permissions

- All `/api/projects/*` and `/api/clients/[id]/projects` routes are admin-only via the existing `requireAdmin` guard.
- Client users have no write surface for projects.

## Client-facing list (`/[locale]/dashboard`, no `?campaign=` param)

### Top KPIs unchanged

«Общий бюджет / Всего поверхностей / Общий OTS / Активные» continue to aggregate across every campaign the client owns, ignoring grouping. Grouping is purely a navigation/organization aid.

### Tile grid

Same `auto-fill 280px` grid as today, but mixed with two tile kinds:

#### Campaign tile

Unchanged — name, period subtitle, status pill, surfaces count below the divider.

#### Project tile

Same outer chrome (border, hover, transitions) as a campaign tile, but stripped to:

```
┌──────────────────────────────────┐
│ 📁  Project name                 │  ← no status pill
│                                  │
│ ──────────────────────────────── │
│ КАМПАНИИ                         │
│ 3                                │
└──────────────────────────────────┘
```

- Lucide `Folder` icon (16px) at the top-left of the title for visual distinction.
- No status, no period subtitle.
- Single `Stat` (same component as campaign tile) below the divider: label `КАМПАНИИ` (i18n `campaignsPage.projectTileLabel`), value = child count.
- Element type: `<button>`, not `<Link>`. Clicking opens the modal; no route change.

### Sort order

Chronological mixed by representative date:

- Project: `MAX(child.createdAt)` — bubbles to the top when any of its children is touched.
- Ungrouped campaign: its own `createdAt`.

Final order: `representativeDate desc`.

### Project drilldown modal

Opens when a project tile is clicked.

- **Animation:** CSS-only — modal panel animates `transform: scale(0.92) → scale(1)` with `opacity: 0 → 1`, backdrop fades `opacity: 0 → 1`. ~220ms cubic-bezier(0.16, 1, 0.3, 1). No new dependency. (A true layout-morph from the clicked tile is a possible future enhancement once we have a use for framer-motion or the View Transitions API more broadly.)
- **Header:** project name (left) + close (X) button (right, aria-label from i18n).
- **Subtitle:** «N кампаний» using the existing pluralization helper.
- **Body:** child campaigns rendered with the **same campaign tile component** as the outer grid. 1-col mobile, 2-col `sm+`. Click a child tile → routes to `/[locale]/dashboard?campaign=<id>` (modal unmounts on navigation; no explicit dismiss needed).
- **Dismiss:** backdrop click, Esc, X button.
- **Empty-project state:** «В этом проекте пока нет кампаний» block (i18n `dashboard.projectEmpty`). Defensive — projects with zero children are filtered out of the tile grid in the first place, so this only triggers if all children are deleted while a modal is open.

### Data fetching

The page already pulls all campaigns. Extend the `select` to include:

```ts
group: { select: { id: true, name: true } }
```

In the page component, partition into:

```ts
{
  projects: Array<{
    id: string,
    name: string,
    children: CampaignTile[],
    representativeDate: Date,
  }>,
  ungrouped: CampaignTile[],
}
```

Filter out projects with `children.length === 0` before rendering. The full children list is embedded in the SSR payload — no second fetch when the modal opens.

## Dashboard multi-level selector

Single change in [`components/ui/campaign-selector.tsx`](components/ui/campaign-selector.tsx) — render `<optgroup>`s when groupings exist.

### New props shape

```ts
campaigns: Array<{
  id: string;
  name: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  groupId: string | null;
  groupName: string | null;
}>
```

(`clientName` is dropped — the earlier change already stopped using it.)

### Render rules

- Partition into `byGroup: Map<groupId, Campaign[]>` (key by groupId, sorted alphabetically by groupName) and `ungrouped: Campaign[]`.
- For each group with ≥1 child, emit an `<optgroup label={groupName}>` with the children as `<option>`s.
- Ungrouped campaigns go under a final `<optgroup label="Без проекта">` (i18n `dashboard.selectorUngrouped`) — **only if** at least one group is also being rendered. If there are zero groups, render a flat `<select>` exactly like today (regression-safe).
- Per-option label unchanged: `${campaign.name}. ${period}`.
- Group order: alphabetical by name. Ungrouped tail last.

### Page wiring

The campaigns list page (`app/[locale]/dashboard/page.tsx`, ~lines 472 & 480) already builds the `campaigns` array passed to `<DashboardClient>`. Extend the inline objects with `groupId: c.groupId, groupName: c.group?.name ?? null`. The page already needs `group { id, name }` in the Prisma select for Section 3, so this is no extra fetch.

## Admin campaigns table

[`app/[locale]/admin/campaigns/page.tsx`](app/[locale]/admin/campaigns/page.tsx).

Add one column **«Проект»** (i18n `admin.tableProject`) between «Компания» and «Статус»:

| Название | Компания | Проект | Статус | Период | Поверхности |
|---|---|---|---|---|---|
| … | BYD | BYD spring 2026 | … | … | … |
| … | BYD | — | … | … | … |

- Source: `c.group?.name ?? '—'`.
- No filtering / sorting UI on this column for now.

## Lifecycle

| Event | Behavior |
|---|---|
| Admin creates first campaign with a new project | Inline "+ Создать новый…" → `POST /api/projects` → use returned id on the campaign create payload |
| Admin reassigns a campaign to a different project | `PUT /api/campaigns/[id]` with the new `groupId` |
| Admin removes a campaign from its project (toggle OFF) | `groupId` → `null`. Project row persists |
| Admin deletes a campaign | Project row persists. If it was the last child, the project is now an orphan |
| Admin deletes a client | Cascade-delete: client → its projects → its campaigns (existing cascade chain plus the new `onDelete: Cascade` on `CampaignGroup.client`) |
| Project becomes orphan (zero children) | No automatic cleanup. A future "manage projects" page will let admin remove empties manually. The list page filters orphans out of the tile grid; the dashboard selector emits no optgroup for them |

## i18n keys (ru / en / uz)

```
admin.tableProject               → Проект / Project / Loyiha
admin.formBelongsToProject       → Принадлежит проекту / Part of a project / Loyihaga tegishli
admin.formProjectPlaceholder     → Выберите проект… / Choose a project… / Loyihani tanlang…
admin.formProjectCreateNew       → + Создать новый… / + Create new… / + Yangi yaratish…
admin.formProjectNewName         → Название проекта / Project name / Loyiha nomi
campaignsPage.projectTileLabel   → КАМПАНИИ / CAMPAIGNS / KAMPANIYALAR
campaignsPage.projectModalClose  → Закрыть / Close / Yopish    (aria-label)
dashboard.selectorUngrouped      → Без проекта / No project / Loyihasiz
dashboard.projectEmpty           → В этом проекте пока нет кампаний / No campaigns in this project yet / Ushbu loyihada hali kampaniyalar yo'q
```

## Test surface

To be developed via TDD in the implementation plan.

- **Schema migration**
  - Existing campaigns get `groupId = null` after migration.
  - The `project: String?` column is dropped after the seed fix.
- **API**
  - `POST /api/projects` returns 409 on duplicate `(clientId, name)` (case-insensitive).
  - `POST /api/projects` returns 403 when the caller is a `CLIENT` user.
  - `POST /api/projects` returns 400 if the admin's request references an unknown client.
  - `GET /api/clients/[id]/projects` returns only that client's projects.
- **Admin form**
  - Inline-create flow: type a new name → save → that name appears selected without a page refresh.
  - Switching client clears the project selection and the toggle.
  - Toggle OFF clears `groupId` in the submitted payload.
- **Client list page**
  - Project tile renders only when the project has ≥1 child.
  - Project tile click opens the modal, modal renders the children.
  - Click on a child tile inside the modal navigates to the dashboard view.
  - Sort order respects representative-date rule (project bubbles up when a child is touched).
- **Dashboard selector**
  - Zero groups → flat `<select>` (regression check, matches today's behavior).
  - ≥1 group → `<optgroup>` per project, alphabetical, ungrouped under «Без проекта» tail.
  - Selecting a child option still navigates correctly.
- **Lifecycle**
  - Deleting a campaign leaves its project row intact.
  - Deleting a client cascades to all its projects.

## Open questions

None at design-approval time. The "manage projects" admin page is the obvious next-spec follow-up if/when orphan cleanup becomes a real pain.
