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

// Bad input
assert.equal(parsePeriodString(''), null);
assert.equal(parsePeriodString('not a date'), null);
assert.equal(parsePeriodString('05.05.2025'), null); // single date — not a range
