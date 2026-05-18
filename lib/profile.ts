import { callModel } from './llm';
import { getSettings, type Settings } from './settings';
import { supabaseAdmin, DEMO_USER_ID } from './supabase/admin';
import { TAXONOMY, TAG_BY_SLUG } from './taxonomy';

type EngagementRow = {
  video_id: string;
  watch_ms: number;
  completion_pct: number;
  liked: boolean;
  disliked: boolean;
  replays: number;
  created_at: string;
};

function signalFor(e: EngagementRow, s: Settings['scoring']): number {
  const skipped = e.completion_pct < 0.3;
  return (
    (e.liked ? s.like : 0) +
    s.completion * e.completion_pct +
    s.replay * Math.min(e.replays, 3) +
    (e.disliked ? s.dislike : 0) +
    (skipped ? s.skip : 0)
  );
}

export async function buildTagWeights(
  userId: string = DEMO_USER_ID,
): Promise<Record<string, number>> {
  const settings = await getSettings();
  const db = supabaseAdmin();

  const { data: engagements, error: e1 } = await db
    .from('engagements')
    .select('video_id, watch_ms, completion_pct, liked, disliked, replays, created_at')
    .eq('user_id', userId);
  if (e1) throw e1;
  if (!engagements || engagements.length === 0) {
    await db
      .from('interest_profile')
      .update({ tag_weights: {}, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    return {};
  }

  const videoIds = Array.from(new Set(engagements.map((r) => r.video_id)));
  const { data: tagRows, error: e2 } = await db
    .from('v_effective_video_tags')
    .select('video_id, tag_slug, weight')
    .in('video_id', videoIds);
  if (e2) throw e2;

  const tagsByVideo = new Map<string, Array<{ slug: string; weight: number }>>();
  for (const r of tagRows ?? []) {
    const arr = tagsByVideo.get(r.video_id) ?? [];
    arr.push({ slug: r.tag_slug, weight: r.weight });
    tagsByVideo.set(r.video_id, arr);
  }

  const now = Date.now();
  const halfLifeMs = settings.scoring.decay_half_life_days * 86_400_000;
  const sums: Record<string, number> = {};

  for (const e of engagements as EngagementRow[]) {
    const tags = tagsByVideo.get(e.video_id);
    if (!tags || tags.length === 0) continue;
    const signal = signalFor(e, settings.scoring);
    if (signal === 0) continue;
    const ageMs = now - new Date(e.created_at).getTime();
    const decay = Math.exp(-(Math.LN2 * ageMs) / halfLifeMs);
    for (const t of tags) {
      sums[t.slug] = (sums[t.slug] ?? 0) + signal * t.weight * decay;
    }
  }

  const weights: Record<string, number> = {};
  for (const [slug, raw] of Object.entries(sums)) {
    weights[slug] = Math.tanh(raw / 5);
  }

  await db
    .from('interest_profile')
    .update({ tag_weights: weights, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  return weights;
}

export async function summarizeProfile(
  userId: string = DEMO_USER_ID,
): Promise<string> {
  const db = supabaseAdmin();
  const { data: prof, error } = await db
    .from('interest_profile')
    .select('tag_weights')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  const weights = (prof.tag_weights ?? {}) as Record<string, number>;

  const entries = Object.entries(weights).filter(
    ([slug]) => TAG_BY_SLUG[slug] !== undefined,
  );
  const positives = entries
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const negatives = entries
    .filter(([, w]) => w < 0)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5);

  if (positives.length === 0 && negatives.length === 0) {
    const empty = 'Scroll the feed for a bit — your interest profile builds from what you watch.';
    await db
      .from('interest_profile')
      .update({ llm_summary: empty, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    return empty;
  }

  const fmt = (pairs: [string, number][]) =>
    pairs
      .map(([slug, w]) => `${TAG_BY_SLUG[slug]?.label ?? slug} (${slug}, ${w.toFixed(2)})`)
      .join(', ');

  const taxonomyDigest = TAXONOMY.map((t) => `${t.slug} [${t.category}]: ${t.label}`).join('\n');

  const system =
    'You write short, friendly natural-language summaries of a viewer\'s taste based on their tag weights from a short-video feed. ' +
    'Be specific, second person, ~120 words, no bullet lists, no headings. Cite specific tags by their human label, not slug. ' +
    'If you cite a "skip" or negative tag, frame it as "you tend to skip…". ' +
    'Never invent tags outside this taxonomy:\n' +
    taxonomyDigest;

  const user = `Positive tags (higher = stronger interest): ${fmt(positives) || 'none'}.
Negative tags (lower = stronger avoidance): ${fmt(negatives) || 'none'}.
Write the summary now.`;

  const out = await callModel<{ summary: string }>('profile_summary', {
    system,
    user,
    schemaName: 'write_summary',
    schemaDescription: 'Output the user-facing taste summary.',
    jsonSchema: {
      type: 'object',
      required: ['summary'],
      properties: {
        summary: { type: 'string', description: 'The ~120-word summary.' },
      },
    },
    cacheSystem: true,
    maxTokens: 600,
  });

  await db
    .from('interest_profile')
    .update({ llm_summary: out.summary, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  return out.summary;
}

export async function recomputeProfile(userId: string = DEMO_USER_ID) {
  const tag_weights = await buildTagWeights(userId);
  const llm_summary = await summarizeProfile(userId);
  return { tag_weights, llm_summary };
}
