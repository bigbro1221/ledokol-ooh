const COLUMN_ALIASES: Record<string, string[]> = {
  type: ['Тип Внешней Рекламы', 'Тип внешней рекламы'],
  photo: ['Фото конструкции', 'Фото'],
  city: ['Город'],
  address: ['Адрес расположения', 'Адрес'],
  size: ['Размер конструкции'],
  resolution: ['Разрешение'],
  priceUnit: [
    'Стоимость за 1 единицу (без АК и НДС)',
    'Стоимость за 1 единицу (без НДС)',
    'Стоимость за 1 единицу ( без НДС)',
  ],
  priceDiscounted: ['Цена с учетом скидки'],
  priceRub: [
    'Цена с учетом скидки  в RUB',
    'Цена с учетом скидки в RUB',
    'Стоимость за 1 ед   в RUB',
  ],
  externalId: ['id', 'ID'],
  productionCost: ['Стоимость производства'],
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

  for (const [key, names] of Object.entries(COLUMN_ALIASES)) {
    for (let c = 0; c < headerRow.length; c++) {
      const cell = String(headerRow[c] || '').trim();
      if (names.some(n => cell.toLowerCase().startsWith(n.toLowerCase()))) {
        map[key] = c;
        break;
      }
    }
  }

  return map;
}
