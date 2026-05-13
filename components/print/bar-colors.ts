/**
 * Shared color palette + status logic for the PDF print bars.
 *
 * The dashboard reach card uses an "overlay" pattern: a single bar trough
 * per row, with the plan width filling the trough as a neutral grey TRACK
 * and the fact width OVERLAYING in a status color (blue/green/amber for
 * on/over/under). All print bar widgets share these tokens so they read
 * as one family.
 */
export type BarStatus = 'over' | 'under' | 'on';

export const PLAN_TRACK = '#D6D9DD';
export const TROUGH = '#F1F3F6';

export const FACT_COLOR: Record<BarStatus, string> = {
  on:    '#3B82F6',
  over:  '#10B981',
  under: '#F59E0B',
};

export const STATUS_TEXT: Record<BarStatus, string> = {
  on:    '#3B82F6',
  over:  '#10B981',
  under: '#F59E0B',
};

export function statusFor(plan: number, fact: number): BarStatus {
  if (plan <= 0) return 'on';
  const r = fact / plan;
  if (r >= 1.02) return 'over';
  if (r <= 0.98) return 'under';
  return 'on';
}
