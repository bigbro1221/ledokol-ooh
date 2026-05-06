import assert from 'node:assert/strict';
import { parsePeriodString, periodName } from '../period';

// Single-month range → "Май 2025"
{
  const r = parsePeriodString('05.05.2025 - 31.05.2025');
  assert(r);
  assert.equal(r.periodStart.toISOString().slice(0, 10), '2025-05-05');
  assert.equal(r.periodEnd.toISOString().slice(0, 10), '2025-05-31');
  assert.equal(periodName(r.periodStart, r.periodEnd), 'Май 2025');
}

// Cross-month range → raw range string
{
  const r = parsePeriodString('15.01.2025 - 14.02.2025');
  assert(r);
  assert.equal(periodName(r.periodStart, r.periodEnd), '15.01.2025 – 14.02.2025');
}

// Single calendar month with full coverage → "Июнь 2025"
{
  const r = parsePeriodString('01.06.2025 - 30.06.2025');
  assert(r);
  assert.equal(periodName(r.periodStart, r.periodEnd), 'Июнь 2025');
}

// Whitespace + en-dash variants
assert(parsePeriodString('05.05.2025–31.05.2025'));
assert(parsePeriodString('  05.05.2025  -  31.05.2025  '));

// Em-dash separator
assert(parsePeriodString('05.05.2025 — 31.05.2025'));

// Cross-year range → raw range, no Russian month label
{
  const r = parsePeriodString('20.12.2024 - 10.01.2025');
  assert(r);
  assert.equal(periodName(r.periodStart, r.periodEnd), '20.12.2024 – 10.01.2025');
}

// Leap-year February full coverage → "Февраль 2024"
{
  const r = parsePeriodString('01.02.2024 - 29.02.2024');
  assert(r);
  assert.equal(periodName(r.periodStart, r.periodEnd), 'Февраль 2024');
}

// Non-leap February full coverage → "Февраль 2025"
{
  const r = parsePeriodString('01.02.2025 - 28.02.2025');
  assert(r);
  assert.equal(periodName(r.periodStart, r.periodEnd), 'Февраль 2025');
}

// Any range entirely within one calendar month → "<Month> <Year>",
// even partial coverage (mid-month chunks, end-of-campaign tails).
{
  const r = parsePeriodString('06.05.2025 - 31.05.2025');
  assert(r);
  assert.equal(periodName(r.periodStart, r.periodEnd), 'Май 2025');
}
{
  const r = parsePeriodString('01.05.2026 - 04.05.2026');
  assert(r);
  assert.equal(periodName(r.periodStart, r.periodEnd), 'Май 2026');
}
{
  const r = parsePeriodString('15.04.2026 - 20.04.2026');
  assert(r);
  assert.equal(periodName(r.periodStart, r.periodEnd), 'Апрель 2026');
}

// Bad input
assert.equal(parsePeriodString(''), null);
assert.equal(parsePeriodString('not a date'), null);
assert.equal(parsePeriodString('05.05.2025'), null); // single date — not a range
assert.equal(parsePeriodString('31.06.2025 - 31.07.2025'), null); // 31 June doesn't exist
assert.equal(parsePeriodString('30.02.2025 - 31.03.2025'), null); // 30 Feb doesn't exist
assert.equal(parsePeriodString('31.05.2025 - 05.05.2025'), null); // reverse range
