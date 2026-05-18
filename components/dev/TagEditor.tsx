'use client';

import { useMemo, useState } from 'react';
import { TAXONOMY, type Tag } from '@/lib/taxonomy';

export type EditedTag = { slug: string; weight: number };

export function TagEditor({
  initial,
  onChange,
}: {
  initial: EditedTag[];
  onChange: (tags: EditedTag[]) => void;
}) {
  const [tags, setTags] = useState<EditedTag[]>(initial);
  const [filter, setFilter] = useState('');

  const setAndEmit = (next: EditedTag[]) => {
    setTags(next);
    onChange(next);
  };

  const add = (slug: string) => {
    if (tags.some((t) => t.slug === slug)) return;
    setAndEmit([...tags, { slug, weight: 0.7 }]);
  };
  const remove = (slug: string) => setAndEmit(tags.filter((t) => t.slug !== slug));
  const setWeight = (slug: string, w: number) =>
    setAndEmit(tags.map((t) => (t.slug === slug ? { ...t, weight: w } : t)));

  const grouped = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const by: Record<string, Tag[]> = {};
    for (const t of TAXONOMY) {
      if (f && !(t.slug.includes(f) || t.label.toLowerCase().includes(f))) continue;
      (by[t.category] ??= []).push(t);
    }
    return by;
  }, [filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tags.length === 0 && <span className="text-xs text-zinc-500">no tags</span>}
        {tags.map((t) => (
          <span
            key={t.slug}
            className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 text-xs rounded px-2 py-1"
          >
            {t.slug}
            <input
              type="number"
              step="0.1"
              min={0}
              max={1}
              value={t.weight}
              onChange={(e) => setWeight(t.slug, Math.min(1, Math.max(0, Number(e.target.value))))}
              className="w-12 text-xs border rounded px-1"
            />
            <button onClick={() => remove(t.slug)} className="text-red-600 ml-1">
              ✕
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter taxonomy…"
        className="text-xs border rounded px-2 py-1 w-full bg-white dark:bg-zinc-900 dark:border-zinc-700"
      />
      <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-2 dark:border-zinc-700">
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat}>
            <p className="text-[10px] uppercase text-zinc-500 mb-1">{cat}</p>
            <div className="flex flex-wrap gap-1.5">
              {list.map((t) => (
                <button
                  key={t.slug}
                  onClick={() => add(t.slug)}
                  disabled={tags.some((x) => x.slug === t.slug)}
                  className="text-xs rounded px-2 py-0.5 border dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
                >
                  {t.slug}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
