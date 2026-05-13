'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Row { city: string; screens: number; ots: number }

export function PrintCityBars({ rows, label }: { rows: Row[]; label: string }) {
  return (
    <div style={{ width: 260, height: 180 }}>
      <BarChart width={260} height={180} data={rows} margin={{ top: 10, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="#eee" />
        <XAxis dataKey="city" stroke="#888" fontSize={9} />
        <YAxis stroke="#888" fontSize={9} />
        <Bar dataKey="ots" fill="#3B82F6" name={label} />
      </BarChart>
    </div>
  );
}
