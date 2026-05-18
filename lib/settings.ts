import { z } from 'zod';
import { supabaseAdmin } from './supabase/admin';

const modelRefSchema = z.object({
  provider: z.enum(['anthropic', 'google']),
  model: z.string().min(1),
});

export const settingsSchema = z.object({
  models: z.object({
    ingest_tagger: modelRefSchema,
    profile_summary: modelRefSchema,
    spotify_rerank: modelRefSchema,
    mock_recs: modelRefSchema,
  }),
  ranking: z.object({
    epsilon: z.number().min(0).max(1),
  }),
  scoring: z.object({
    like: z.number(),
    completion: z.number(),
    replay: z.number(),
    dislike: z.number(),
    skip: z.number(),
    decay_half_life_days: z.number().positive(),
  }),
  feed: z.object({
    batch_size: z.number().int().positive(),
    exclude_last_n_seen: z.number().int().nonnegative(),
  }),
  recs: z.object({
    music_candidates_per_query: z.number().int().positive(),
    music_final: z.number().int().positive(),
    mock_cards: z.number().int().positive(),
  }),
  exclude_rejected_videos_from_feed: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;
export type ModelJob = keyof Settings['models'];

let cache: { value: Settings; expiresAt: number } | null = null;
const TTL_MS = 5_000;

export async function getSettings(): Promise<Settings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const { data, error } = await supabaseAdmin()
    .from('settings')
    .select('value')
    .eq('key', 'current')
    .single();
  if (error) throw error;
  const parsed = settingsSchema.parse(data.value);
  cache = { value: parsed, expiresAt: Date.now() + TTL_MS };
  return parsed;
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (
    typeof base !== 'object' ||
    base === null ||
    typeof patch !== 'object' ||
    patch === null ||
    Array.isArray(base) ||
    Array.isArray(patch)
  ) {
    return (patch as T) ?? base;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    out[k] = deepMerge((base as Record<string, unknown>)[k], v);
  }
  return out as T;
}

export async function patchSettings(patch: unknown): Promise<Settings> {
  const current = await getSettings();
  const merged = deepMerge(current, patch);
  const validated = settingsSchema.parse(merged);
  const { error } = await supabaseAdmin()
    .from('settings')
    .update({ value: validated, updated_at: new Date().toISOString() })
    .eq('key', 'current');
  if (error) throw error;
  cache = { value: validated, expiresAt: Date.now() + TTL_MS };
  return validated;
}

export function invalidateSettingsCache(): void {
  cache = null;
}
