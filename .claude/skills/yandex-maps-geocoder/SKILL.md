---
name: yandex-maps-geocoder
description: Extract coordinates from Yandex Maps Constructor links and fuzzy-match pin labels to XLSX spreadsheet addresses. Covers constructor ID extraction, GeoJSON fetching, and the proven 96% match-rate algorithm.
triggers:
  - extracting coordinates from Yandex Maps
  - geocoding screen addresses
  - matching pins to spreadsheet rows
  - fuzzy address matching
  - Yandex Constructor GeoJSON
  - lat/lng assignment for screens
---

# Yandex Maps Geocoder — Ledokol OOH

Reference: `docs/ARCHITECTURE.md` sections 3.3, 3.4, 6.7, 6.8.

## Constructor ID Extraction

URL format:
```
https://yandex.uz/maps/...&um=constructor%3A{CONSTRUCTOR_ID}&z=...
```

The ID is after `um=constructor%3A` (URL-decoded: `um=constructor:`).

## GeoJSON Fetch

```
https://api-maps.yandex.ru/services/constructor/1.0/js/?um=constructor:{ID}&lang=ru_RU
```

Response is JS wrapping a JSON object — extract the GeoJSON from it. Each feature has:
- `geometry.coordinates` → [lng, lat] (note: longitude first)
- `properties.description` → city
- `properties.name` → address label
- `properties['marker-color']` → pin color

## Fuzzy Matching Algorithm

Proven on real data: **174/182 pins matched (96%)** with threshold 0.35.

### Steps:
1. **Normalize** both pin label and XLSX address:
   - Lowercase
   - Strip punctuation: `[.,;:!?«»""'()–—/\\]` → space
   - Remove common words: `ориентир`, `ор-р`, `ор р`, `ул`, `пр`, `проспект`, `улица`, `перекрёсток`, `пересечение`
   - Collapse whitespace, trim

2. **Extract keywords**: Split normalized string, keep words with length > 2

3. **Compute overlap ratio**: `intersection_size / max(set_a_size, set_b_size)`

4. **Threshold**: 0.35 for a match

5. **Greedy assignment**: Each pin matches its best-scoring row; each row used at most once

## Unmatched Pins

Log unmatched pins for manual review — never silently drop them. Surface in the upload preview UI.
