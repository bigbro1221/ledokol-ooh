export type DateFormat =
  | 'smart_hybrid'
  | 'month_only'
  | 'full_range'
  | 'numeric_dmy'
  | 'numeric_dmon';

export const DATE_FORMAT_OPTIONS: {
  value: DateFormat;
  labelRu: string;
  labelEn: string;
  labelUz: string;
}[] = [
  { value: 'smart_hybrid', labelRu: 'Умный', labelEn: 'Smart', labelUz: 'Aqlli' },
  { value: 'month_only', labelRu: 'Только месяц', labelEn: 'Month only', labelUz: 'Faqat oy' },
  { value: 'full_range', labelRu: 'Полный период', labelEn: 'Full range', labelUz: "To'liq davr" },
  { value: 'numeric_dmy', labelRu: 'ДД.ММ.ГГГГ', labelEn: 'DD.MM.YYYY', labelUz: 'KK.OO.YYYY' },
  { value: 'numeric_dmon', labelRu: 'ДД.МММ.ГГГГ', labelEn: 'DD.Mon.YYYY', labelUz: 'KK.Oy.YYYY' },
];

const LOCALE_MAP: Record<string, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  uz: 'uz-UZ',
  tr: 'tr-TR',
};

function intlLocale(locale: string): string {
  return LOCALE_MAP[locale] ?? 'ru-RU';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Hardcoded 3-char month abbreviations per locale — avoids Intl trailing dots
// (ru-RU Intl short months include dots: "янв.", "февр.", etc.)
const MONTH_ABBR: Record<string, string[]> = {
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
};

function monthAbbr(d: Date, locale: string): string {
  return MONTH_ABBR[locale]?.[d.getMonth()]
    // Fallback: Intl short, strip any trailing dot Intl may add
    ?? new Intl.DateTimeFormat(LOCALE_MAP[locale] ?? 'ru-RU', { month: 'short' })
         .format(d)
         .replace(/\.+$/, '');
}

export function formatCampaignPeriod(
  start: Date,
  end: Date,
  locale: string,
  format: DateFormat = 'smart_hybrid',
): string {
  const loc = intlLocale(locale);
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();
  const currentYear = new Date().getFullYear();

  switch (format) {
    case 'smart_hybrid': {
      if (sameMonth) {
        const opts: Intl.DateTimeFormatOptions =
          start.getFullYear() === currentYear
            ? { month: 'long' }
            : { month: 'long', year: 'numeric' };
        return capitalize(new Intl.DateTimeFormat(loc, opts).format(start));
      }
      // Cross-month: "15 июля – 10 августа 2025 г."
      const s = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long' }).format(start);
      const e = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' }).format(end);
      return `${s} – ${e}`;
    }

    case 'month_only': {
      return capitalize(
        new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(start),
      );
    }

    case 'full_range': {
      if (sameMonth) {
        const endFmt = new Intl.DateTimeFormat(loc, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(end);
        return `${start.getDate()}–${endFmt}`;
      }
      const s = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long' }).format(start);
      const e = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' }).format(end);
      return `${s} – ${e}`;
    }

    case 'numeric_dmy': {
      const fmt = (d: Date) =>
        `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
      return `${fmt(start)} – ${fmt(end)}`;
    }

    case 'numeric_dmon': {
      const fmt = (d: Date) => `${pad2(d.getDate())}.${monthAbbr(d, locale)}.${d.getFullYear()}`;
      return `${fmt(start)} – ${fmt(end)}`;
    }
  }
}
