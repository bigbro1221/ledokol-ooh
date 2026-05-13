'use client';
import { PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#FF6B2C', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899'];

interface Slice { name: string; value: number }

export function PrintTypeDonut({ slices }: { slices: Slice[] }) {
  return (
    <div style={{ width: 260, height: 180 }}>
      <PieChart width={260} height={180}>
        <Pie data={slices} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" stroke="#fff" strokeWidth={1}>
          {slices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={8} wrapperStyle={{ fontSize: 9 }} />
      </PieChart>
    </div>
  );
}
