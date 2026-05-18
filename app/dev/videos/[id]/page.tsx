import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VideoReviewCard, type VideoReviewItem } from '@/components/dev/VideoReviewCard';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function VideoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dev?: string }>;
}) {
  const sp = await searchParams;
  const { id } = await params;
  const expected = process.env.DEV_TOOLS_TOKEN;
  if (!expected || sp.dev !== expected) notFound();

  const db = supabaseAdmin();
  const { data: video } = await db
    .from('videos')
    .select(
      'id, url, thumbnail_url, title, duration_ms, video_tag_reviews ( status, ai_raw, edited_tags, reviewed_at, notes )',
    )
    .eq('id', id)
    .single();
  if (!video) notFound();

  const { data: tagRows } = await db
    .from('v_effective_video_tags')
    .select('video_id, tag_slug, weight')
    .eq('video_id', id);

  const review = Array.isArray(video.video_tag_reviews)
    ? video.video_tag_reviews[0] ?? null
    : video.video_tag_reviews;

  const item: VideoReviewItem = {
    id: video.id,
    url: video.url,
    thumbnail_url: video.thumbnail_url,
    title: video.title,
    duration_ms: video.duration_ms,
    review,
    effective_tags: (tagRows ?? []).map((r) => ({ slug: r.tag_slug, weight: r.weight })),
  };

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{video.title ?? video.id}</h1>
        <Link
          href={`/dev/videos?dev=${encodeURIComponent(sp.dev!)}`}
          className="text-sm underline"
        >
          ← review queue
        </Link>
      </header>

      <video
        src={video.url}
        controls
        muted
        playsInline
        className="w-full rounded-xl bg-black aspect-video object-contain"
      />

      <VideoReviewCard item={item} token={sp.dev!} />

      <section className="border rounded-xl p-4 dark:border-zinc-800">
        <h2 className="font-medium mb-2 text-sm">Raw model output</h2>
        <pre className="text-xs bg-zinc-50 dark:bg-zinc-900 p-3 rounded overflow-x-auto">
          {JSON.stringify(review?.ai_raw ?? {}, null, 2)}
        </pre>
      </section>
    </main>
  );
}
