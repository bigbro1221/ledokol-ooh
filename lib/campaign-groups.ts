export interface InputCampaign {
  id: string;
  groupId: string | null;
  groupName: string | null;
  createdAt: Date;
  // pass-through — the caller hands us whatever else it needs to render
  [key: string]: unknown;
}

export interface ProjectGroup<T extends InputCampaign = InputCampaign> {
  id: string;          // groupId
  name: string;
  children: T[];
  representativeDate: Date;  // max(child.createdAt)
}

export interface Partitioned<T extends InputCampaign = InputCampaign> {
  projects: ProjectGroup<T>[];
  ungrouped: T[];
}

/**
 * Splits a flat campaign list into projects (each with its children) and
 * ungrouped campaigns. Projects sort by their newest child's createdAt;
 * ungrouped sort by their own createdAt; both desc.
 *
 * Defensive: a campaign with `groupId` but no `groupName` is treated as
 * ungrouped (shouldn't happen if the caller selects `group { id, name }`).
 */
export function partitionCampaigns<T extends InputCampaign>(
  campaigns: T[],
): Partitioned<T> {
  const byGroup = new Map<string, { name: string; children: T[]; rep: Date }>();
  const ungrouped: T[] = [];

  for (const c of campaigns) {
    if (c.groupId && c.groupName) {
      const slot = byGroup.get(c.groupId);
      if (slot) {
        slot.children.push(c);
        if (c.createdAt > slot.rep) slot.rep = c.createdAt;
      } else {
        byGroup.set(c.groupId, {
          name: c.groupName,
          children: [c],
          rep: c.createdAt,
        });
      }
    } else {
      ungrouped.push(c);
    }
  }

  const projects: ProjectGroup<T>[] = Array.from(byGroup.entries()).map(
    ([id, { name, children, rep }]) => ({
      id,
      name,
      children,
      representativeDate: rep,
    }),
  );

  // Combined desc-by-date ordering happens at the call site (it depends on
  // ungrouped's createdAt too). But sort projects by their own representative
  // date here so callers can rely on a stable internal order.
  projects.sort((a, b) => b.representativeDate.getTime() - a.representativeDate.getTime());
  ungrouped.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return { projects, ungrouped };
}
