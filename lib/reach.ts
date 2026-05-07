export interface ReachRow {
  id: string;
  n: number;
  plan: number | null;
  fact: number | null;
}

/**
 * Pick the rows shown on the dashboard's collapsed Reach card.
 * - 0 entries → []
 * - 1 entry → [that one]
 * - 2 entries → both (sorted)
 * - ≥3 entries → first, middle (floor(length/2)), last (sorted)
 *
 * Always sorts the input by `n` ascending first so the caller doesn't have to.
 */
export function pickRepresentative<T extends ReachRow>(entries: T[]): T[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => a.n - b.n);
  if (sorted.length <= 2) return sorted;
  const first = sorted[0];
  const middle = sorted[Math.floor(sorted.length / 2)];
  const last = sorted[sorted.length - 1];
  return [first, middle, last];
}
