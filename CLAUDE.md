# Claude working notes — ledokol/ooh

## Prisma schema changes

### Workflow (mandatory)

1. **Before changing `prisma/schema.prisma`**, check if the change involves data loss:
   - Adding a non-nullable column without a default → **data loss risk**
   - Dropping a column or model → **data loss risk**
   - Adding a nullable column or a column with a default → safe
   - **Always ask the user before running `--accept-data-loss`**

2. **Stop the dev server first.** The Next.js dev server locks
   `node_modules/.prisma/client/query_engine-windows.dll.node`.
   Running `prisma generate` while it is running causes an EPERM error.

   ```bash
   npx kill-port 3000
   ```

3. **Push the schema** (apply DDL to the database):

   ```bash
   # Safe changes (nullable columns, defaults, new tables):
   npx prisma db push

   # Changes that may drop data — only after explicit user approval:
   npx prisma db push --accept-data-loss
   ```

4. **Regenerate the Prisma client** (updates TypeScript types):

   ```bash
   npx prisma generate
   ```

5. **Verify TypeScript is still clean:**

   ```bash
   npx tsc --noEmit
   ```

6. **Restart the dev server:**

   ```bash
   npm run dev
   ```

Do all of this yourself — do not ask the user to run these commands.

---

## Project structure highlights

- `prisma/schema.prisma` — single source of truth for DB schema
- `lib/parser/` — XLSX parsing pipeline
  - `sheets.ts` — sheet routing (type-named, period, total)
  - `columns.ts` — column alias map + plan/fact super-header detection
  - `schemas.ts` — Zod schemas for parsed rows
  - `index.ts` — orchestration
  - `matcher.ts` — Yandex pin → screen address geocoding
  - `yandex.ts` — Yandex map widget HTML scraping
- `app/api/upload/route.ts` — parse + geocode (does NOT write to DB)
- `app/api/upload/[id]/confirm/route.ts` — write parsed screens to DB
- `public/templates/mediaplan-template.xlsx` — downloadable template
- `docs/samples/` — sample files used to develop/test the parser

## Final template column layout (Медиаплан sheet)

| Col | Header | Parser field |
|-----|--------|-------------|
| A | Тип Внешней Рекламы | `type` |
| B | Фото конструкции | `photoUrl` (hyperlink) |
| C | Город | `city` |
| D | Адрес расположения | `address` |
| E | Кол-во носителей | — |
| F | Период размещения | — |
| G | Длительность ролика | — |
| H | Время работы | — |
| I | Кол-во выходов в блоке | — |
| J | Прогнозное кол-во выходов в сутки | — |
| K | Стоимость монтажных и печатных работ (без АК и НДС) | `productionCost` |
| L | Общая сумма (без АК и НДС) | `priceTotal` |
| M | AK% | `commissionPct` |
| N | AK сумма | `agencyFeeAmt` |
| O | Общая сумма (с АК и НДС) | `priceDiscounted` |
| P | ots | `otsPlan` (plan region) |
| Q | rating | `ratingPlan` |
| R | universe | `universe` |
| S | ots | `otsFact` (fact region) |
| T | rating | `ratingFact` |

Super-header row (row 1): "плановые охваты" at col P, "Фактические охваты" at col S.

## Geocoding notes

- Yandex maps widget (`yandex.ru/map-widget/v1/`) embeds pin data twice in the HTML — deduplicate before matching.
- Matching uses hybrid recall/Jaccard scoring with ё→е normalisation and compound-word subtoken splitting.
- Placeholder addresses like "Адресная программа будет подбираться..." will never match — expected.
- Match threshold: 0.28.
