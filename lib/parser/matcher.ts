const STOP_WORDS = /\b(ориентир|ор-р|ор р|ул|пр|проспект|улица|перекр[её]сток|пересечение)\b/g;

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,;:!?«»""'()–—/\\]/g, ' ')
    .replace(STOP_WORDS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractKeywords(s: string): Set<string> {
  return new Set(normalize(s).split(' ').filter(w => w.length > 2));
}

export function matchScore(a: string, b: string): number {
  const kwA = extractKeywords(a);
  const kwB = extractKeywords(b);
  if (!kwA.size || !kwB.size) return 0;
  const overlap = Array.from(kwA).filter(w => kwB.has(w)).length;
  return overlap / Math.max(kwA.size, kwB.size);
}

const MATCH_THRESHOLD = 0.35;

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
 */
export function matchPinsToRows(
  pins: YandexPin[],
  addresses: string[]
): { matched: Map<string, { lat: number; lng: number }>; unmatched: YandexPin[] } {
  const matched = new Map<string, { lat: number; lng: number }>();
  const usedAddresses = new Set<string>();
  const unmatched: YandexPin[] = [];

  // Score all pin-address pairs
  const scores: { pinIdx: number; address: string; score: number }[] = [];
  for (let i = 0; i < pins.length; i++) {
    for (const addr of addresses) {
      const score = matchScore(pins[i].label, addr);
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
      matched.set(address, { lat: pins[pinIdx].lat, lng: pins[pinIdx].lng });
      usedPins.add(pinIdx);
      usedAddresses.add(address);
    }
  }

  for (let i = 0; i < pins.length; i++) {
    if (!usedPins.has(i)) unmatched.push(pins[i]);
  }

  return { matched, unmatched };
}
