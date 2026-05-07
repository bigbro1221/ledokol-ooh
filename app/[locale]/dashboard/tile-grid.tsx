'use client';

import { useState } from 'react';
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

  // Combined render order: projects + ungrouped sorted together by date desc.
  const merged: Array<
    | { kind: 'project'; id: string; name: string; children: TileGridRow[]; date: Date }
    | { kind: 'campaign'; row: TileGridRow; date: Date }
  > = [
    ...projects.map(p => ({ kind: 'project' as const, id: p.id, name: p.name, children: p.children, date: p.representativeDate })),
    ...ungrouped.map(u => ({ kind: 'campaign' as const, row: u, date: u.createdAt })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const openProject = projects.find(p => p.id === openProjectId);

  return (
    <>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {merged.map(item => item.kind === 'project' ? (
          <ProjectTile
            key={`p-${item.id}`}
            name={item.name}
            childCount={item.children.length}
            childCountLabel={tc('projectTileLabel')}
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

      {openProject && (
        <ProjectModal
          projectName={openProject.name}
          children={openProject.children}
          locale={locale}
          dateFormat={dateFormat}
          statusLabelFor={s => tStatus(s)}
          screensLabel={tc('colScreens')}
          onClose={() => setOpenProjectId(null)}
        />
      )}
    </>
  );
}
