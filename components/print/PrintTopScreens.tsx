'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Row { address: string; ots: number }

export function PrintTopScreens({ rows, label }: { rows: Row[]; label: string }) {
  return (
    <div style={{ width: 540, height: 240 }}>
      <BarChart width={540} height={240} data={rows} layout="vertical" margin={{ top: 8, right: 12, bottom: 8, left: 100 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="#eee" />
        <XAxis type="number" stroke="#888" fontSize={9} />
        <YAxis type="category" dataKey="address" stroke="#888" fontSize={9} width={100} />
        <Bar dataKey="ots" fill="#FF6B2C" name={label} />
      </BarChart>
    </div>
  );
}
