# Reach (Охват) data — design

**Date:** 2026-05-07
**Status:** Approved (pending implementation plan)
**Author:** brainstorming session, beck + claude

## Problem

Campaigns track reach (Охват) thresholds — Охват 1+, Охват 2+, … — each with a planned percentage and an actual (factual) percentage. Today there's no place in the system to enter, store, or display this data. Admins need a per-campaign editor; clients need a compact view of the data on the campaign dashboard with the option to expand into a full list.

## Non-goals

- Aggregation across campaigns (cross-campaign reach analytics). Out of scope.
- Per-period reach (only campaign-level). Out of scope.
- Editing on the client-facing dashboard — clients see the data read-only.
- Importing reach data from the XLSX media plan. Manual entry only.

## Data model

### New table: `ReachEntry`

```prisma
model ReachEntry {
  id         String   @id @default(uuid())
  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  n          Int      // Охват threshold (Охват 1+, Охват 2+, ...). Positive integer.
  plan       Float?   // Plan reach. Null while the admin is still entering.
  fact       Float?   // Fact reach. Null while the admin is still entering.
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([campaignId, n])
  @@index([campaignId])
}
```

`Campaign` gains a back-relation `reachEntries ReachEntry[]`. On campaign delete: cascade.

User-facing labels: «Охват» (ru) / "Reach" (en) / "Qamrov" (uz). Internal model name stays English (Prisma convention).

`Float` rather than `Decimal` — values are typically 0–100 percents, no need for DB-level precision over `double`.

## API

### `GET /api/campaigns/[id]/reach`

- **Auth:** admin or the campaign's owner-client (the client dashboard reads this).
- **Returns:** `[{ id, n, plan, fact }]` sorted by `n` ascending.

### `PUT /api/campaigns/[id]/reach`

- **Auth:** admin only.
- **Body:** `{ entries: [{ n: int, plan: number | null, fact: number | null }] }`
- **Semantics:** replace-all. Server runs in a transaction:
  1. Delete every `ReachEntry` for this campaign.
  2. Insert the new array.
- **Validation (returns 400 on failure):**
  - `entries.length ≤ 30`
  - Every `n` is an integer in `[1, 99]`
  - Every `n` is unique within the array
  - Every present `plan`/`fact` is a finite number `≥ 0`
- **Returns:** the freshly written entries, same shape as GET.

Replace-all chosen because the modal collects 30 rows max and saves once — no need to track per-row dirty state on either side.

## Admin UI — entry modal

### Trigger

A new button **«Охват»** on the campaign detail page (`app/[locale]/admin/campaigns/[id]/page.tsx`), placed alongside the existing action buttons (Upload XLSX, Edit, Pencil, etc.). Visible for any campaign status — admins may want to enter reach data while still in DRAFT.

### Modal contents

A new `<ReachDataModal>` client component:

- Header: «Данные охвата» (`admin.reachModalTitle`) + close X
- Vertically scrollable list, `overflow-y-auto`, `max-h` sized to fit comfortably on a 1080p screen
- Each row:
  ```
  Охват  [N input]+   План [number input]   Факт [number input]   [×]
  ```
  - `N` — small `<input type="number" min="1" max="99" step="1">`
  - `План`, `Факт` — `<input type="number" step="0.01" min="0">`, both optional (empty = null)
  - `×` — small icon button (Trash2 from lucide) that removes the row
- Footer:
  - «+ Добавить строку» — adds an empty row with `n` defaulted to `(max(existing n) + 1)`. Disabled when `entries.length === 30`.
  - «Отмена» — discard changes, close modal
  - «Сохранить» — PUT to API, close on success

### Client-side validation

- Save button is disabled when:
  - Any row has empty/invalid `n`
  - Two rows share the same `n`
  - More than 30 rows
- Inline error text when a duplicate `n` is detected (`admin.reachDuplicateN`)

### State

The modal fetches the current entries via `GET /api/campaigns/[id]/reach` on open (always — keeps the modal authoritative even if another admin edits in parallel). Edits live in local state until Save.

## Dashboard surface

A new **`<ReachCard>`** rendered as the **first slot** on the campaign-detail dashboard view (`app/[locale]/dashboard/dashboard-client.tsx`), immediately after `<CampaignHero>` and before the filter row + `<EfficiencyStrip>`.

### Visibility

- 0 entries → card hides entirely (no empty state on the dashboard).
- ≥ 1 entry → card renders.

### Default (collapsed) state — 3 rows

Show up to 3 representative rows:

| entries.length | rows shown |
|---|---|
| 1 | the one entry |
| 2 | first and last (i.e. both) |
| ≥ 3 | first (`entries[0]`), middle (`entries[Math.floor(length / 2)]`), last (`entries[length - 1]`) |

Row format (both labels visible inline):
```
Охват N+   План <value>   Факт <value>
```

If `plan` or `fact` is null on a row, render `—`.

### Expanded state — modal

Click the card → expand to a centered modal showing **all** entries sorted ascending. Same compact row layout. Read-only — clients can't edit. Close via Esc / backdrop / X.

### Animation

Identical pattern to the project tile → modal morph that already exists:

- The card root is a `<motion.div layoutId={\`reach-${campaignId}\`}>` plus the existing card chrome.
- The modal panel root is a `<motion.div layoutId={\`reach-${campaignId}\`}>` with the modal layout.
- Wrapped in `<AnimatePresence>`. Card hides (`visibility: hidden`) while the modal is open so framer-motion morphs cleanly.
- Backdrop is a separate `motion.div` with simple opacity fade.
- Inner content crossfades over the morph (default rows fade out, full list fades in).
- Reuse `morphTransition` constant (`duration: 0.4, ease: [0.16, 1, 0.3, 1]`) and the styling from `ProjectModal`.

### Data path

Page (`app/[locale]/dashboard/page.tsx`) fetches the campaign's reach entries (via Prisma `include: { reachEntries: { orderBy: { n: 'asc' } } }`) when serving the campaign-detail branch. The serialized list is threaded through `<DashboardClient>` to `<ReachCard>`. No client-side fetch needed for display.

## Validation summary

- `n` integer in `[1, 99]`
- `plan`, `fact` finite floats `≥ 0`, both nullable
- Unique `(campaignId, n)`
- Max 30 entries per campaign

DB enforces uniqueness; API enforces range, type, and 30-row cap; modal enforces the same client-side for UX.

## i18n keys (ru / en / uz)

```
admin.reachButton            → Охват / Reach / Qamrov
admin.reachModalTitle        → Данные охвата / Reach data / Qamrov ma'lumotlari
admin.reachColumnReach       → Охват / Reach / Qamrov
admin.reachColumnPlan        → План / Plan / Reja
admin.reachColumnFact        → Факт / Fact / Fakt
admin.reachAddRow            → + Добавить строку / + Add row / + Qator qo'shish
admin.reachDeleteRow         → Удалить / Delete / O'chirish
admin.reachSave              → Сохранить / Save / Saqlash
admin.reachCancel            → Отмена / Cancel / Bekor qilish
admin.reachMaxRows           → Максимум 30 строк / Max 30 rows / Maksimum 30 qator
admin.reachDuplicateN        → Это значение уже добавлено / Already added / Bu qiymat allaqachon qo'shilgan
dashboard.reachCardTitle     → Охват / Reach / Qamrov
dashboard.reachModalClose    → Закрыть / Close / Yopish
dashboard.reachPlanLabel     → План / Plan / Reja
dashboard.reachFactLabel     → Факт / Fact / Fakt
```

## Test surface

- **Schema:** migration adds `ReachEntry` table + index + unique. No data migration.
- **API**
  - `GET` returns sorted-asc entries for the requested campaign only.
  - `GET` returns 403 for clients of other campaigns.
  - `PUT` is admin-only (403 for clients).
  - `PUT` returns 400 on > 30 rows, on duplicate `n` in payload, on invalid `n` range, on negative plan/fact.
  - `PUT` is replace-all: passing `[]` clears all entries.
- **Admin modal**
  - Add row → defaults to `max(n) + 1`.
  - Delete row → updates list; saving persists.
  - Duplicate `n` blocks Save and surfaces inline error.
  - Save closes the modal; reopen reflects the new state.
- **Dashboard card**
  - 0 entries → card not rendered.
  - 1/2/≥3 entries → correct subset rendered (length-based selection).
  - Click → modal opens with full list and the morph animation.
  - Esc / backdrop / X dismiss.
  - Read-only — no edit affordance visible for clients.

## Open questions

None at design-approval time.
