'use client';

import { useState } from 'react';
import type { Settings } from '@/lib/settings';

const PROVIDER_MODELS: { provider: 'anthropic' | 'google'; model: string; label: string }[] = [
  { provider: 'anthropic', model: 'claude-opus-4-7', label: 'Anthropic · Claude Opus 4.7' },
  { provider: 'anthropic', model: 'claude-sonnet-4-6', label: 'Anthropic · Claude Sonnet 4.6' },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', label: 'Anthropic · Claude Haiku 4.5' },
  { provider: 'google', model: 'gemini-2.5-flash', label: 'Google · Gemini 2.5 Flash' },
  { provider: 'google', model: 'gemini-2.5-pro', label: 'Google · Gemini 2.5 Pro' },
];

const JOBS: Array<keyof Settings['models']> = [
  'ingest_tagger',
  'profile_summary',
  'spotify_rerank',
  'mock_recs',
];

export function SettingsEditor({ initial, token }: { initial: Settings; token: string }) {
  const [s, setS] = useState<Settings>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/dev/settings?dev=${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(s),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(body));
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const setModel = (job: keyof Settings['models'], modelKey: string) => {
    const [provider, model] = modelKey.split('|');
    setS({
      ...s,
      models: { ...s.models, [job]: { provider: provider as 'anthropic' | 'google', model } },
    });
  };

  return (
    <div className="space-y-6 text-sm">
      <section>
        <h3 className="font-medium mb-2">Models per job</h3>
        <div className="grid grid-cols-2 gap-3">
          {JOBS.map((job) => {
            const cur = s.models[job];
            return (
              <label key={job} className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">{job}</span>
                <select
                  className="border rounded px-2 py-1 bg-white dark:bg-zinc-900 dark:border-zinc-700"
                  value={`${cur.provider}|${cur.model}`}
                  onChange={(e) => setModel(job, e.target.value)}
                >
                  {PROVIDER_MODELS.map((m) => (
                    <option key={`${m.provider}|${m.model}`} value={`${m.provider}|${m.model}`}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="font-medium mb-2">Scoring weights</h3>
        <div className="grid grid-cols-3 gap-3">
          {(['like', 'completion', 'replay', 'dislike', 'skip', 'decay_half_life_days'] as const).map((k) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">{k}</span>
              <input
                type="number"
                step="0.1"
                value={s.scoring[k]}
                onChange={(e) => setS({ ...s, scoring: { ...s.scoring, [k]: Number(e.target.value) } })}
                className="border rounded px-2 py-1 bg-white dark:bg-zinc-900 dark:border-zinc-700"
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-medium mb-2">Ranking</h3>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">epsilon (random fraction in feed): {s.ranking.epsilon.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.ranking.epsilon}
            onChange={(e) => setS({ ...s, ranking: { epsilon: Number(e.target.value) } })}
          />
        </label>
      </section>

      <section>
        <h3 className="font-medium mb-2">Feed & recs</h3>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">feed.batch_size</span>
            <input
              type="number"
              value={s.feed.batch_size}
              onChange={(e) => setS({ ...s, feed: { ...s.feed, batch_size: Number(e.target.value) } })}
              className="border rounded px-2 py-1 bg-white dark:bg-zinc-900 dark:border-zinc-700"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">feed.exclude_last_n_seen</span>
            <input
              type="number"
              value={s.feed.exclude_last_n_seen}
              onChange={(e) =>
                setS({ ...s, feed: { ...s.feed, exclude_last_n_seen: Number(e.target.value) } })
              }
              className="border rounded px-2 py-1 bg-white dark:bg-zinc-900 dark:border-zinc-700"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">recs.mock_cards</span>
            <input
              type="number"
              value={s.recs.mock_cards}
              onChange={(e) => setS({ ...s, recs: { ...s.recs, mock_cards: Number(e.target.value) } })}
              className="border rounded px-2 py-1 bg-white dark:bg-zinc-900 dark:border-zinc-700"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">recs.music_candidates_per_query</span>
            <input
              type="number"
              value={s.recs.music_candidates_per_query}
              onChange={(e) =>
                setS({ ...s, recs: { ...s.recs, music_candidates_per_query: Number(e.target.value) } })
              }
              className="border rounded px-2 py-1 bg-white dark:bg-zinc-900 dark:border-zinc-700"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">recs.music_final</span>
            <input
              type="number"
              value={s.recs.music_final}
              onChange={(e) => setS({ ...s, recs: { ...s.recs, music_final: Number(e.target.value) } })}
              className="border rounded px-2 py-1 bg-white dark:bg-zinc-900 dark:border-zinc-700"
            />
          </label>
          <label className="flex items-center gap-2 mt-5">
            <input
              type="checkbox"
              checked={s.exclude_rejected_videos_from_feed}
              onChange={(e) => setS({ ...s, exclude_rejected_videos_from_feed: e.target.checked })}
            />
            <span className="text-xs">exclude rejected videos from feed</span>
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="bg-black text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {savedAt && <span className="text-xs text-green-600">saved at {savedAt}</span>}
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    </div>
  );
}
