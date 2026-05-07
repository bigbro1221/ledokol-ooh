import assert from 'node:assert/strict';
import { pickRepresentative, type ReachRow } from '../reach';

const r = (n: number, plan: number | null = null, fact: number | null = null): ReachRow => ({
  id: `r${n}`, n, plan, fact,
});

// 1. Empty input → empty output
{
  assert.deepEqual(pickRepresentative([]), []);
}

// 2. Single entry → that one
{
  const out = pickRepresentative([r(1, 10, 8)]);
  assert.equal(out.length, 1);
  assert.equal(out[0].n, 1);
}

// 3. Two entries → both
{
  const out = pickRepresentative([r(1), r(5)]);
  assert.deepEqual(out.map(x => x.n), [1, 5]);
}

// 4. ≥3 entries → first, middle (floor(length/2)), last
{
  const out = pickRepresentative([r(1), r(2), r(3), r(5), r(8), r(13)]);
  // length 6 → middle index = floor(6/2) = 3 → r(5)
  assert.deepEqual(out.map(x => x.n), [1, 5, 13]);
}

// 5. Caller-supplied unsorted input is sorted-asc by n before picking
{
  const out = pickRepresentative([r(5), r(1), r(3)]);
  // sorted: 1, 3, 5 → length 3 → first/middle/last = 1/3/5
  assert.deepEqual(out.map(x => x.n), [1, 3, 5]);
}
