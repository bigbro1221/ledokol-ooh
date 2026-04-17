const STOP_WORDS = /\b(ориентир|ор-р|ор р|напротив|рядом|около|сторона|стороне|бывш|бывший|возле|вдоль|ул|пр|проспект|улица|перекрёсток|перекресток|пересечение|район|шаҳри|шахри)\b/gi;

export function normalize(s: string): string {
  return s
    .toLowerCase()
    // ё → е  (extremely common Russian spelling variant)
    .replace(/ё/g, 'е')
    // strip punctuation / brackets
    .replace(/[.,;:!?«»""''()\[\]{}–—/\\|]/g, ' ')
    // "ор." shorthand for ориентир
    .replace(/\bор\.\s*/g, ' ')
    .replace(STOP_WORDS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract keywords, keeping:
 *  - words longer than 2 chars (standard)
 *  - numeric tokens of any length (house numbers matter)
 *  - also generates sub-tokens for compound words (e.g. "янгишахар" → also adds "янги","шахар")
 */
export function extractKeywords(s: string): Set<string> {
  const words = normalize(s).split(' ').filter(Boolean);
  const tokens = new Set<string>();

  for (const w of words) {
    if (w.length === 0) continue;
    // Always keep numbers regardless of length
    if (/^\d+$/.test(w)) { tokens.add(w); continue; }
    // Standard: keep words > 2 chars
    if (w.length > 2) tokens.add(w);
    // Compound word splitting: if a long word can be split into known sub-words
    // Try all sub-words of length 4+ within compound (catches "янгишахар" → "янги","шахар")
    if (w.length >= 8) {
      for (let start = 0; start < w.length - 3; start++) {
        for (let len = 4; len <= w.length - start; len++) {
          const sub = w.slice(start, start + len);
          if (sub.length >= 4) tokens.add(sub);
        }
      }
    }
  }
  return tokens;
}

/**
 * Scoring: hybrid of Jaccard (precision-biased) and Recall (for short queries).
 * Short queries (≤3 keywords) use recall so that "Экобазар" → pin with 5 words still matches.
 * Compound-word penalty: sub-token matches count as 0.7 (weaker than exact word match).
 */
export function matchScore(query: string, pin: string): number {
  const rawQuery = normalize(query).split(' ').filter(w => w.length > 2 || /^\d+$/.test(w));
  const rawPin = normalize(pin).split(' ').filter(w => w.length > 2 || /^\d+$/.test(w));

  if (!rawQuery.length || !rawPin.length) return 0;

  const kwQuery = new Set(rawQuery);
  const kwPin = new Set(rawPin);

  // Exact overlap
  const exactOverlap = Array.from(kwQuery).filter(w => kwPin.has(w)).length;

  // Soft prefix/substring overlap (for compound word splits and case endings)
  // e.g. "дружбы" matches "дружба" via shared prefix of len ≥ 5
  // e.g. "янгишахар" contains "янги" as substring
  let softOverlap = 0;
  for (const qw of Array.from(kwQuery)) {
    if (kwPin.has(qw)) continue; // already counted as exact
    for (const pw of Array.from(kwPin)) {
      if (pw.length < 4 || qw.length < 4) continue;
      const minLen = Math.min(qw.length, pw.length);
      const prefixLen = Math.max(4, Math.floor(minLen * 0.75));
      // Prefix match (case endings): "дружбы" / "дружба" share "дружб"
      if (qw.slice(0, prefixLen) === pw.slice(0, prefixLen)) { softOverlap += 0.7; break; }
      // Substring match (compound words): "янгишахар" contains "янги"
      if (qw.includes(pw) || pw.includes(qw)) { softOverlap += 0.7; break; }
    }
  }

  const totalOverlap = exactOverlap + softOverlap;

  // Recall score: what fraction of the QUERY is covered by the pin
  const recall = totalOverlap / kwQuery.size;
  // Jaccard-like: overlap / union
  const jaccard = totalOverlap / Math.max(kwQuery.size, kwPin.size);

  // For very short queries (1–3 words), recall matters more — a pin covering all query terms is a match
  if (kwQuery.size <= 3) {
    return Math.max(recall * 0.9, jaccard);
  }
  return Math.max(recall * 0.7, jaccard);
}

const MATCH_THRESHOLD = 0.28;

export interface YandexPin {
  lat: number;
  lng: number;
  city: string;
  label: string;
}

export interface MatchedScreen {
  address: string;
  lat: number;
  lng: number;
}

/**
 * Greedy assignment: each pin matches its best row; each row used at most once.
 * Deduplicates pins with identical labels before matching to avoid wasting pairs.
 */
export function matchPinsToRows(
  pins: YandexPin[],
  addresses: string[]
): { matched: Map<string, { lat: number; lng: number }>; unmatched: YandexPin[] } {
  // Deduplicate pins by label — keep first occurrence of each unique label
  const seenLabels = new Set<string>();
  const uniquePins: YandexPin[] = [];
  for (const pin of pins) {
    const key = normalize(pin.label);
    if (!seenLabels.has(key)) { seenLabels.add(key); uniquePins.push(pin); }
  }

  const matched = new Map<string, { lat: number; lng: number }>();
  const usedAddresses = new Set<string>();
  const unmatched: YandexPin[] = [];

  // Score all pin-address pairs
  const scores: { pinIdx: number; address: string; score: number }[] = [];
  for (let i = 0; i < uniquePins.length; i++) {
    for (const addr of addresses) {
      const score = matchScore(addr, uniquePins[i].label);
      if (score >= MATCH_THRESHOLD) {
        scores.push({ pinIdx: i, address: addr, score });
      }
    }
  }

  // Sort by score descending for greedy assignment
  scores.sort((a, b) => b.score - a.score);

  const usedPins = new Set<number>();
  for (const { pinIdx, address, score } of scores) {
    if (usedPins.has(pinIdx) || usedAddresses.has(address)) continue;
    if (score >= MATCH_THRESHOLD) {
      matched.set(address, { lat: uniquePins[pinIdx].lat, lng: uniquePins[pinIdx].lng });
      usedPins.add(pinIdx);
      usedAddresses.add(address);
    }
  }

  for (let i = 0; i < uniquePins.length; i++) {
    if (!usedPins.has(i)) unmatched.push(uniquePins[i]);
  }

  return { matched, unmatched };
}
