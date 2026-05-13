import type { DashboardCampaign } from '@/lib/campaign-detail';

interface Props {
  campaign: DashboardCampaign;
  labels: {
    rowNum: string;
    type: string;
    city: string;
    address: string;
    otsPlan: string;
    otsFact: string;
    size: string;
    impPerDay: string;
  };
}

function fmtNum(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n.toLocaleString('ru-RU');
}

export function PrintScreensTable({ campaign, labels }: Props) {
  const rows = campaign.screens.map((s, i) => {
    const otsPlan = s.metrics.reduce((m, x) => m + (x.otsPlan ?? 0), 0);
    const otsFact = s.metrics.reduce((m, x) => m + (x.otsFact ?? 0), 0);
    const size = s.metrics.find(m => m.size)?.size ?? '—';
    const impPerDay = s.metrics.find(m => m.impressionsPerDay)?.impressionsPerDay ?? null;
    return {
      n: i + 1,
      type: s.screenType.code,
      city: s.city.trim(),
      address: s.address,
      otsPlan, otsFact, size, impPerDay,
    };
  });

  return (
    <table className="pdf-screens-table">
      <thead>
        <tr>
          <th style={{ width: 20 }}>{labels.rowNum}</th>
          <th style={{ width: 50 }}>{labels.type}</th>
          <th style={{ width: 70 }}>{labels.city}</th>
          <th>{labels.address}</th>
          <th className="num" style={{ width: 60 }}>{labels.otsPlan}</th>
          <th className="num" style={{ width: 60 }}>{labels.otsFact}</th>
          <th style={{ width: 50 }}>{labels.size}</th>
          <th className="num" style={{ width: 50 }}>{labels.impPerDay}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.n}>
            <td>{r.n}</td>
            <td>{r.type}</td>
            <td>{r.city}</td>
            <td>{r.address}</td>
            <td className="num">{fmtNum(r.otsPlan)}</td>
            <td className="num">{fmtNum(r.otsFact)}</td>
            <td>{r.size}</td>
            <td className="num">{r.impPerDay != null ? r.impPerDay.toLocaleString('ru-RU') : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
