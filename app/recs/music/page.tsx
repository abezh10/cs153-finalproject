import Link from 'next/link';
import { ConnectSpotifyButton } from '@/components/ConnectSpotifyButton';
import { searchAndRerank } from '@/lib/spotify';
import { supabaseAdmin, DEMO_USER_ID } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function MusicRecsPage({
  searchParams,
}: {
  searchParams: Promise<{ spotify_error?: string }>;
}) {
  const sp = await searchParams;
  const db = supabaseAdmin();
  const { data: token } = await db
    .from('spotify_tokens')
    .select('user_id')
    .eq('user_id', DEMO_USER_ID)
    .maybeSingle();

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Music recommendations</h1>
        <Link href="/dashboard" className="text-sm underline">
          ← dashboard
        </Link>
      </div>
      {sp.spotify_error && (
        <p className="text-sm text-red-600">Spotify error: {sp.spotify_error}</p>
      )}

      {!token ? (
        <div className="border rounded-xl p-6 text-center space-y-3 dark:border-zinc-800">
          <p className="text-sm">
            Connect Spotify to get song recommendations matching your video-feed taste.
          </p>
          <ConnectSpotifyButton />
        </div>
      ) : (
        <MusicGrid />
      )}
    </main>
  );
}

async function MusicGrid() {
  let recs: Awaited<ReturnType<typeof searchAndRerank>> = [];
  let err: string | null = null;
  try {
    recs = await searchAndRerank();
  } catch (e) {
    err = (e as Error).message;
  }

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (recs.length === 0) {
    return <p className="text-sm text-zinc-500">No recommendations yet. Scroll the feed more, then return.</p>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {recs.map((r) => (
        <div key={r.track.id} className="space-y-1">
          <iframe
            src={`https://open.spotify.com/embed/track/${r.track.id}`}
            width="100%"
            height={152}
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
            loading="lazy"
            className="rounded-xl"
          />
          <p title={r.why} className="text-[11px] text-zinc-500 line-clamp-2 cursor-help">
            {r.why}
          </p>
        </div>
      ))}
    </div>
  );
}
