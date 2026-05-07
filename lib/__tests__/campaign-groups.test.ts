import assert from 'node:assert/strict';
import { partitionCampaigns, type InputCampaign } from '../campaign-groups';

const c = (
  id: string,
  createdAt: string,
  groupId: string | null = null,
  groupName: string | null = null,
): InputCampaign => ({
  id,
  groupId,
  groupName,
  createdAt: new Date(createdAt),
});

// 1. No groups → all ungrouped, sorted by createdAt desc
{
  const out = partitionCampaigns([
    c('a', '2026-01-01'),
    c('b', '2026-03-01'),
    c('c', '2026-02-01'),
  ]);
  assert.equal(out.projects.length, 0);
  assert.deepEqual(out.ungrouped.map(x => x.id), ['b', 'c', 'a']);
}

// 2. Mixed groups + ungrouped, project bubbles by latest child createdAt
{
  const out = partitionCampaigns([
    c('a', '2026-01-01', 'g1', 'Project One'),  // older child
    c('b', '2026-04-01', 'g1', 'Project One'),  // newer child → bubbles g1
    c('c', '2026-02-01'),                       // ungrouped
    c('d', '2026-03-01', 'g2', 'Project Two'),  // single child of g2
  ]);
  assert.equal(out.projects.length, 2);
  // representative date desc: g1 (apr) → g2 (mar) → ungrouped 'c' (feb)
  assert.deepEqual(
    [...out.projects.map(p => p.id), ...out.ungrouped.map(u => u.id)],
    ['g1', 'g2', 'c'],
  );
  // children kept in same input order within their project
  assert.deepEqual(out.projects[0].children.map(x => x.id), ['a', 'b']);
}

// 3. Empty projects (no children) are filtered out
//    — caller should never pass them, but be defensive
{
  const out = partitionCampaigns([
    c('a', '2026-01-01'),
  ]);
  assert.equal(out.projects.length, 0);
  assert.equal(out.ungrouped.length, 1);
}

// 4. Group with groupId but missing groupName falls into ungrouped (defensive)
{
  const out = partitionCampaigns([
    c('a', '2026-01-01', 'g1', null),
  ]);
  assert.equal(out.projects.length, 0);
  assert.equal(out.ungrouped.length, 1);
}
