import { NextResponse } from 'next/server';
import { checkDevTokenOrNotFound } from '@/lib/dev-auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const STATUS_VALUES = ['pending', 'approved', 'rejected', 'edited', 'all'] as const;
type Status = (typeof STATUS_VALUES)[number];

export async function GET(req: Request) {
  checkDevTokenOrNotFound(req);
  const url = new URL(req.url);
  const statusParam = (url.searchParams.get('status') ?? 'pending') as Status;
  const status = STATUS_VALUES.includes(statusParam) ? statusParam : 'pending';
  const limit = Math.min(100, Number(url.searchParams.get('limit') ?? '50'));
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? '0'));

  const db = supabaseAdmin();
  let query = db
    .from('videos')
    .select(
      'id, url, thumbnail_url, title, duration_ms, video_tag_reviews ( status, ai_raw, edited_tags, reviewed_at, notes )',
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== 'all') {
    // Filter on the join: supabase-js does this via .filter on the embedded relation.
    query = query.eq('video_tag_reviews.status', status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Drop videos that did not match the status filter (the embedded select returns null for them).
  const rows = (data ?? []).filter(
    (r) =>
      status === 'all' ||
      (Array.isArray(r.video_tag_reviews)
        ? r.video_tag_reviews.length > 0
        : r.video_tag_reviews !== null),
  );

  // Also load tag rows for display.
  const ids = rows.map((r) => r.id);
  const tagsByVideo: Record<string, { slug: string; weight: number }[]> = {};
  if (ids.length > 0) {
    const { data: tagRows } = await db
      .from('v_effective_video_tags')
      .select('video_id, tag_slug, weight')
      .in('video_id', ids);
    for (const r of tagRows ?? []) {
      (tagsByVideo[r.video_id] ??= []).push({ slug: r.tag_slug, weight: r.weight });
    }
  }

  return NextResponse.json({
    videos: rows.map((r) => ({
      ...r,
      review: Array.isArray(r.video_tag_reviews)
        ? r.video_tag_reviews[0] ?? null
        : r.video_tag_reviews,
      effective_tags: tagsByVideo[r.id] ?? [],
    })),
  });
}
