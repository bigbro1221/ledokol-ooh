'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Row { name: string; plan: number; fact: number }

export function PrintPlanFactBars({ rows, planLabel, factLabel }: { rows: Row[]; planLabel: string; factLabel: string }) {
  return (
    <div style={{ width: 540, height: 200 }}>
      <BarChart width={540} height={200} data={rows} margin={{ top: 16, right: 12, bottom: 12, left: 12 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="#eee" />
        <XAxis dataKey="name" stroke="#888" fontSize={10} />
        <YAxis stroke="#888" fontSize={10} />
        <Bar dataKey="plan" fill="#3B82F6" name={planLabel} />
        <Bar dataKey="fact" fill="#FF6B2C" name={factLabel} />
      </BarChart>
    </div>
  );
}
