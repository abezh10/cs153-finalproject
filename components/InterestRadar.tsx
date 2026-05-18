'use client';

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import { labelFor } from '@/lib/taxonomy';

export type RadarPoint = { tag: string; positive: number; negative: number };

export function InterestRadar({ weights }: { weights: Record<string, number> }) {
  const entries = Object.entries(weights)
    .filter(([, w]) => Math.abs(w) > 0.05)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 8);

  if (entries.length === 0) {
    return <p className="text-sm text-zinc-500">No signal yet — scroll the feed.</p>;
  }

  const data: RadarPoint[] = entries.map(([slug, w]) => ({
    tag: labelFor(slug),
    positive: w > 0 ? w : 0,
    negative: w < 0 ? -w : 0,
  }));

  return (
    <div className="w-full h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="80%">
          <PolarGrid stroke="#e5e5e5" />
          <PolarAngleAxis dataKey="tag" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
          <Radar name="liked" dataKey="positive" stroke="#ec4899" fill="#ec4899" fillOpacity={0.4} />
          <Radar name="skipped" dataKey="negative" stroke="#737373" fill="#737373" fillOpacity={0.3} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
