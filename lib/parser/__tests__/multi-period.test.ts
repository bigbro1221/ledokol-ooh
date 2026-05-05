import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMultiPeriod } from '../multi-period';

const sample = readFileSync(join(process.cwd(), 'docs/samples/other_types.xlsx'));
const result = parseMultiPeriod(sample);

assert.equal(result.errors.length, 0, `errors: ${JSON.stringify(result.errors)}`);

// Sample contains 13 monthly rows for one screen
assert.equal(result.rows.length, 13, `expected 13 rows, got ${result.rows.length}`);

// All rows are the same physical screen
const addresses = new Set(result.rows.map(r => r.screen.address.trim()));
assert.equal(addresses.size, 1, `expected 1 unique address, got ${addresses.size}`);

// All rows are typed ROOF
assert(result.rows.every(r => r.screen.typeCode === 'ROOF'));

// Periods are unique per row
const periods = new Set(result.rows.map(r => `${r.periodStart.toISOString()}_${r.periodEnd.toISOString()}`));
assert.equal(periods.size, 13);

// Plan OTS values vary
const otsValues = new Set(result.rows.map(r => r.screen.otsPlan));
assert(otsValues.size >= 10, 'expected diverse OTS values across periods');

// Period naming
const labels = result.rows.map(r => r.periodLabel);
assert(labels.includes('Май 2025'));
assert(labels.includes('Июнь 2025'));
