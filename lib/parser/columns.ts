const COLUMN_ALIASES: Record<string, string[]> = {
  type: ['Тип Внешней Рекламы', 'Тип внешней рекламы'],
  photo: ['Фото конструкции', 'Фото'],
  city: ['Город'],
  address: ['Адрес расположения', 'Адрес'],
  size: ['Размер конструкции', 'Размер'],
  resolution: ['Разрешение'],
  priceUnit: [
    'Стоимость за 1 единицу (без АК и НДС)',
    'Стоимость за 1 единицу (без НДС)',
    'Стоимость за 1 единицу ( без НДС)',
  ],
  priceDiscounted: [
    'Цена с учетом скидки',
    'Общая сумма (с АК и НДС)',   // final price incl. agency fee — final template col O
  ],
  commissionPct: [
    'АК(%',   // "АК(%)" — new template (must be before plain "АК" alias)
    'AK%',
    'АК%',
    'АК, %',
    'АК %',
  ],
  agencyFeeAmt: [
    'AK сумма',
    'АК сумма',
    'АК, сумма',
    'АК',     // plain "АК" column in new template — matched after commissionPct via usedCols
  ],
  priceTotal: [
    'Общая сумма (без  АК и НДС)', // double-space variant — final template col L
    'Общая сумма (без АК и НДС)',
    'Общая сумма(без АК и НДС)',
  ],
  priceRub: [
    'Total без НДС в RUB',
    'Total без НДС в RUB',
    'Цена с учетом скидки  в RUB',
    'Цена с учетом скидки в RUB',
    'Стоимость за 1 ед   в RUB',
  ],
  impressionsPerDay: [
    'Прогнозное кол-во выходов в сутки',
    'Прогнозное количество выходов в сутки',
    'Кол-во выходов в сутки',
  ],
  externalId: ['id', 'ID'],
  productionCost: [
    'Стоимость производства',
    'Стоимость монтажных',        // "Стоимость монтажных  и печатных работ (без АК и НДС)" — final template col K
  ],
  // ots/rating are handled separately via Plan/Fact detection
  ots: ['ots', 'OTS'],
  rating: ['rating', 'Rating'],
  universe: ['universe', 'Universe'],
};

export interface ColumnMap {
  [key: string]: number | undefined;
}

export function findHeaderRow(data: unknown[][]): number {
  for (let r = 0; r < Math.min(12, data.length); r++) {
    const row = data[r] as string[];
    if (row?.some(cell =>
      typeof cell === 'string' && /город|адрес расположения/i.test(cell.trim())
    )) {
      return r;
    }
  }
  return 7;
}

export function buildColumnMap(headerRow: string[]): ColumnMap {
  const map: ColumnMap = {};
  const usedCols = new Set<number>();

  for (const [key, names] of Object.entries(COLUMN_ALIASES)) {
    // skip ots/rating/universe — all handled by buildPlanFactMap
    if (key === 'ots' || key === 'rating' || key === 'universe') continue;

    for (let c = 0; c < headerRow.length; c++) {
      if (usedCols.has(c)) continue;
      const cell = String(headerRow[c] || '').trim();
      if (names.some(n => cell.toLowerCase().startsWith(n.toLowerCase()))) {
        map[key] = c;
        usedCols.add(c);
        break;
      }
    }
  }

  return map;
}

/**
 * Detect Plan/Fact column positions.
 *
 * Looks at the row ABOVE the header row for "Plan" / "Fact" markers.
 * If found: maps otsPlan, ratingPlan, otsFact, ratingFact to the correct columns.
 * If not found (old format): maps otsPlan from the single "ots" column, no fact data.
 */
export function buildPlanFactMap(
  data: unknown[][],
  headerIdx: number,
  headerRow: string[],
): { otsPlan?: number; ratingPlan?: number; otsFact?: number; ratingFact?: number; universe?: number } {
  const superRow = headerIdx > 0 ? (data[headerIdx - 1] as string[]) : [];

  // Check if super-header row contains Plan / Fact markers (English or Russian)
  let planCol = -1;
  let factCol = -1;
  for (let c = 0; c < superRow.length; c++) {
    const cell = String(superRow[c] || '').trim().toLowerCase();
    const isPlan = cell === 'plan' || /план/.test(cell);   // "plan", "плановые охваты"
    const isFact = cell === 'fact' || /факт/.test(cell);   // "fact", "фактические охваты"
    if (isPlan && planCol === -1) planCol = c;
    if (isFact && factCol === -1) factCol = c;
  }

  const isHeader = (cell: string, names: string[]) =>
    names.some(n => cell.toLowerCase().startsWith(n.toLowerCase()));

  if (planCol >= 0 && factCol >= 0) {
    // New format: Plan/Fact super-header detected
    // Find "ots", "rating", "universe" columns relative to Plan and Fact markers
    let otsPlan: number | undefined;
    let ratingPlan: number | undefined;
    let otsFact: number | undefined;
    let ratingFact: number | undefined;
    let universe: number | undefined;

    for (let c = 0; c < headerRow.length; c++) {
      const cell = String(headerRow[c] || '').trim();
      if (!cell) continue;

      const isOts = isHeader(cell, ['ots', 'OTS']);
      const isRating = isHeader(cell, ['rating', 'Rating']);
      const isUniverse = isHeader(cell, ['universe', 'Universe']);

      if (isUniverse && universe === undefined) { universe = c; continue; }

      if (isOts) {
        // Assign to plan or fact based on which region this column falls in
        if (otsPlan === undefined && c >= planCol && (factCol < 0 || c < factCol)) {
          otsPlan = c;
        } else if (otsFact === undefined && factCol >= 0 && c >= factCol) {
          otsFact = c;
        }
      }
      if (isRating) {
        if (ratingPlan === undefined && c >= planCol && (factCol < 0 || c < factCol)) {
          ratingPlan = c;
        } else if (ratingFact === undefined && factCol >= 0 && c >= factCol) {
          ratingFact = c;
        }
      }
    }

    return { otsPlan, ratingPlan, otsFact, ratingFact, universe };
  } else {
    // Old format: no Plan/Fact super-header — single ots/rating treated as plan
    let otsPlan: number | undefined;
    let ratingPlan: number | undefined;
    let universe: number | undefined;

    for (let c = 0; c < headerRow.length; c++) {
      const cell = String(headerRow[c] || '').trim();
      if (isHeader(cell, ['ots', 'OTS']) && otsPlan === undefined) otsPlan = c;
      if (isHeader(cell, ['rating', 'Rating']) && ratingPlan === undefined) ratingPlan = c;
      if (isHeader(cell, ['universe', 'Universe']) && universe === undefined) universe = c;
    }

    return { otsPlan, ratingPlan, otsFact: undefined, ratingFact: undefined, universe };
  }
}
