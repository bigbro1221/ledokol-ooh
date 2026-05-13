const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya',
  ъ: '', ь: '',
};

const ACCENT_MAP: Record<string, string> = {
  á: 'a', à: 'a', ä: 'a', â: 'a', ã: 'a',
  é: 'e', è: 'e', ë: 'e', ê: 'e',
  í: 'i', ì: 'i', ï: 'i', î: 'i',
  ó: 'o', ò: 'o', ö: 'o', ô: 'o', õ: 'o',
  ú: 'u', ù: 'u', ü: 'u', û: 'u',
  ñ: 'n', ç: 'c',
};

/**
 * Transliterates Cyrillic + strips diacritics + slugifies.
 * Non-Latin/non-mapped chars are dropped silently. Empty input returns "".
 */
export function slugForFilename(input: string): string {
  const lower = input.toLowerCase();
  let out = '';
  for (const ch of lower) {
    if (CYRILLIC_MAP[ch] !== undefined) out += CYRILLIC_MAP[ch];
    else if (ACCENT_MAP[ch] !== undefined) out += ACCENT_MAP[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else if (ch.charCodeAt(0) < 128) out += '-';
    // anything else (other scripts) drops
  }
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '');
}
