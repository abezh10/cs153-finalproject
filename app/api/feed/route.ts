import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';
import { supabaseAdmin, DEMO_USER_ID } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type Video = {
  id: string;
  url: string;
  thumbnail_url: string | null;
  title: string | null;
  duration_ms: number;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cursor = Number(url.searchParams.get('cursor') ?? '0');
  const settings = await getSettings();
  const batch = settings.feed.batch_size;
  const db = supabaseAdmin();

  const { data: prof } = await db
    .from('interest_profile')
    .select('tag_weights')
    .eq('user_id', DEMO_USER_ID)
    .single();
  const weights = (prof?.tag_weights ?? {}) as Record<string, number>;

  const { data: recent } = await db
    .from('engagements')
    .select('video_id, created_at')
    .eq('user_id', DEMO_USER_ID)
    .order('created_at', { ascending: false })
    .limit(settings.feed.exclude_last_n_seen);
  const recentIds = new Set((recent ?? []).map((r) => r.video_id));

  const { data: reviewBlocks } = settings.exclude_rejected_videos_from_feed
    ? await db.from('video_tag_reviews').select('video_id').eq('status', 'rejected')
    : { data: [] as { video_id: string }[] };
  const blocked = new Set((reviewBlocks ?? []).map((r) => r.video_id));
  for (const id of recentIds) blocked.add(id);

  const { data: videos } = await db
    .from('videos')
    .select('id, url, thumbnail_url, title, duration_ms');
  const pool = (videos ?? []).filter((v) => !blocked.has(v.id)) as Video[];

  // Score each video by sum(effective_tag_weight * profile_weight).
  let scoreMap = new Map<string, number>();
  if (Object.keys(weights).length > 0 && pool.length > 0) {
    const { data: tagRows } = await db
      .from('v_effective_video_tags')
      .select('video_id, tag_slug, weight')
      .in('video_id', pool.map((v) => v.id));
    for (const r of tagRows ?? []) {
      const w = weights[r.tag_slug];
      if (w === undefined) continue;
      scoreMap.set(r.video_id, (scoreMap.get(r.video_id) ?? 0) + w * r.weight);
    }
  } else {
    scoreMap = new Map();
  }

  // epsilon-greedy mix: epsilon% random, (1-epsilon)% ranked by score.
  const eps = settings.ranking.epsilon;
  const nRandom = Math.round(batch * eps);
  const nRanked = batch - nRandom;

  const ranked = [...pool].sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0));
  const pickRanked = ranked.slice(cursor, cursor + nRanked);
  const usedIds = new Set(pickRanked.map((v) => v.id));
  const remainingRandom = pool.filter((v) => !usedIds.has(v.id));
  for (let i = remainingRandom.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remainingRandom[i], remainingRandom[j]] = [remainingRandom[j], remainingRandom[i]];
  }
  const pickRandom = remainingRandom.slice(0, nRandom);

  const out = [...pickRanked, ...pickRandom];
  return NextResponse.json({
    videos: out,
    nextCursor: cursor + nRanked,
    poolSize: pool.length,
  });
}
