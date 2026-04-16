---
name: xlsx-media-plan-parser
description: Parse Ledokol OOH media plan XLSX files with 7 sheets (LED Tashkent, LED Regions, LED Stops, Static, Airport, Buses, Total). Handles column alias mapping, hyperlink extraction, Google Drive URL normalization, and Zod validation.
triggers:
  - parsing XLSX media plan
  - uploading spreadsheet
  - extracting screen data from Excel
  - media plan import
  - SheetJS workbook processing
  - column mapping for XLSX sheets
builds_on:
  - anthropic-agent-skills/xlsx (generic spreadsheet patterns)
---

# XLSX Media Plan Parser — Ledokol OOH

This skill covers parsing Ledokol's specific XLSX media plan format. For generic spreadsheet operations, defer to the `xlsx` skill from Anthropic. This skill adds Ledokol-specific knowledge.

## Reference

Full parser specification: `docs/ARCHITECTURE.md` section 6.

Sample file: `docs/samples/ЧЕРНОВИК.xlsx`

## Sheet Detection

Match sheet names case-insensitively:

| Regex | Type |
|-------|------|
| `/led.*ташкент/i` | LED_TASHKENT |
| `/led.*регион/i` | LED_REGIONS |
| `/led.*остановк/i` | LED_STOPS |
| `/статик/i` | STATIC |
| `/аэропорт/i` | AIRPORT |
| `/автобус/i` | BUSES |
| `/total/i` | TOTAL |

## Column Alias Mapping

Columns shift between sheet types. Detect by header row (usually row 7). Key aliases:

- `type` → `['Тип Внешней Рекламы']`
- `photo` → `['Фото конструкции', 'Фото']`
- `city` → `['Город']`
- `address` → `['Адрес расположения', 'Адрес']`
- `size` → `['Размер конструкции']`
- `resolution` → `['Разрешение']`
- `priceUnit` → `['Стоимость за 1 единицу (без НДС)', 'Стоимость за 1 единицу (без АК и НДС)']`
- `ots` → `['ots']`, `rating` → `['rating']`, `universe` → `['universe']`
- `externalId` → `['id', 'ID']`

## Hyperlink Extraction

SheetJS exposes hyperlinks via `cell.l.Target`:

- **Photo URLs**: Column B has display text "Фото" but the actual Google Drive URL is in `cell.l.Target`
- **Yandex Maps URL**: Cell G4 on `Total` sheet — check both `cell.v` (value) and `cell.l.Target` (link)

## Google Drive URL Normalization

Convert share URLs to thumbnail URLs:
```
Input:  https://drive.google.com/file/d/{ID}/view?usp=share_link
Output: https://drive.google.com/thumbnail?id={ID}&sz=w400
```

Extract file ID with: `/\/file\/d\/([^/]+)/`

## Validation

Use Zod schemas to validate parsed rows before DB write. Parsing is transactional — all rows import or none (rollback on failure).

## Parser Entry Point

Located at `lib/parser/index.ts`. Returns `ParseResult` with: campaign data, screen array, unmatched pins, errors, and warnings.
