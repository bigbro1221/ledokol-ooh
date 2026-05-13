'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { CampaignTile, type CampaignTileData } from '@/components/dashboard/campaign-tile';
import { ProjectTile } from '@/components/dashboard/project-tile';
import { ProjectModal } from '@/components/dashboard/project-modal';
import { partitionCampaigns } from '@/lib/campaign-groups';
import type { DateFormat } from '@/lib/format-period';

export interface TileGridRow extends CampaignTileData {
  groupId: string | null;
  groupName: string | null;
  createdAt: Date;
  [key: string]: unknown;
}

interface Props {
  rows: TileGridRow[];
  locale: string;
  dateFormat: DateFormat;
}

export function TileGrid({ rows, locale, dateFormat }: Props) {
  const tc = useTranslations('campaignsPage');
  const tStatus = useTranslations('campaignStatus');
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

  const { projects, ungrouped } = partitionCampaigns(rows);

  // Render order: projects + ungrouped mixed, sorted by start date desc.
  // A project's anchor date is the *latest* periodStart among its children —
  // it bubbles up whenever any of its campaigns has a fresh start.
  const merged: Array<
    | { kind: 'project'; id: string; name: string; children: TileGridRow[]; date: Date }
    | { kind: 'campaign'; row: TileGridRow; date: Date }
  > = [
    ...projects.map(p => {
      const latest = p.children.reduce<Date>(
        (max, c) => (c.periodStart > max ? c.periodStart : max),
        p.children[0].periodStart,
      );
      return { kind: 'project' as const, id: p.id, name: p.name, children: p.children, date: latest };
    }),
    ...ungrouped.map(u => ({ kind: 'campaign' as const, row: u, date: u.periodStart })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const openProject = projects.find(p => p.id === openProjectId);

  return (
    <>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {merged.map(item => item.kind === 'project' ? (
          <ProjectTile
            key={`p-${item.id}`}
            id={item.id}
            name={item.name}
            childCount={item.children.length}
            childCountLabel={tc('projectTileLabel')}
            childItems={item.children.map(c => ({
              id: c.id,
              name: c.name,
              href: `/${locale}/dashboard?campaign=${c.id}`,
              status: c.status,
              statusLabel: tStatus(c.status),
            }))}
            expandLabel={tc('projectExpand')}
            isExpanded={openProjectId === item.id}
            onOpen={() => setOpenProjectId(item.id)}
          />
        ) : (
          <CampaignTile
            key={`c-${item.row.id}`}
            campaign={item.row}
            href={`/${locale}/dashboard?campaign=${item.row.id}`}
            locale={locale}
            dateFormat={dateFormat}
            statusLabel={tStatus(item.row.status)}
            screensLabel={tc('colScreens')}
          />
        ))}
      </div>

      <AnimatePresence>
        {openProject && (
          <ProjectModal
            key={openProject.id}
            projectId={openProject.id}
            projectName={openProject.name}
            campaigns={openProject.children}
            locale={locale}
            dateFormat={dateFormat}
            statusLabelFor={s => tStatus(s)}
            screensLabel={tc('colScreens')}
            onClose={() => setOpenProjectId(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
