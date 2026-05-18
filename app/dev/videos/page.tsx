import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VideoReviewCard, type VideoReviewItem } from '@/components/dev/VideoReviewCard';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const STATUSES = ['pending', 'approved', 'rejected', 'edited', 'all'] as const;
type Status = (typeof STATUSES)[number];

export default async function VideoReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ dev?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const expected = process.env.DEV_TOOLS_TOKEN;
  if (!expected || sp.dev !== expected) notFound();
  const status = (STATUSES.includes(sp.status as Status) ? sp.status : 'pending') as Status;

  const db = supabaseAdmin();
  let q = db
    .from('videos')
    .select(
      'id, url, thumbnail_url, title, duration_ms, video_tag_reviews ( status, ai_raw, edited_tags, reviewed_at, notes )',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (status !== 'all') q = q.eq('video_tag_reviews.status', status);
  const { data } = await q;

  const rows = (data ?? []).filter((r) => {
    if (status === 'all') return true;
    const rv = Array.isArray(r.video_tag_reviews) ? r.video_tag_reviews[0] : r.video_tag_reviews;
    return rv && rv.status === status;
  });
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
  const items: VideoReviewItem[] = rows.map((r) => ({
    id: r.id,
    url: r.url,
    thumbnail_url: r.thumbnail_url,
    title: r.title,
    duration_ms: r.duration_ms,
    review: Array.isArray(r.video_tag_reviews)
      ? (r.video_tag_reviews[0] ?? null)
      : r.video_tag_reviews,
    effective_tags: tagsByVideo[r.id] ?? [],
  }));

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Video review queue</h1>
        <Link href={`/dev?dev=${encodeURIComponent(sp.dev!)}`} className="text-sm underline">
          ← /dev
        </Link>
      </header>
      <nav className="flex gap-2">
        {STATUSES.map((s) => {
          const active = s === status;
          return (
            <Link
              key={s}
              href={`/dev/videos?dev=${encodeURIComponent(sp.dev!)}&status=${s}`}
              className={`text-xs px-2 py-1 rounded ${
                active
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'border dark:border-zinc-700'
              }`}
            >
              {s}
            </Link>
          );
        })}
      </nav>
      <p className="text-xs text-zinc-500">{items.length} videos</p>
      <div className="space-y-3">
        {items.map((it) => (
          <VideoReviewCard key={it.id} item={it} token={sp.dev!} />
        ))}
      </div>
    </main>
  );
}
