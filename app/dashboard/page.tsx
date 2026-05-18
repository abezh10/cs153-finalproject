import Link from 'next/link';
import { InterestRadar } from '@/components/InterestRadar';
import { supabaseAdmin, DEMO_USER_ID } from '@/lib/supabase/admin';
import { RegenerateButton } from './RegenerateButton';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { data } = await supabaseAdmin()
    .from('interest_profile')
    .select('tag_weights, llm_summary, updated_at')
    .eq('user_id', DEMO_USER_ID)
    .single();

  const weights = (data?.tag_weights ?? {}) as Record<string, number>;
  const summary = (data?.llm_summary ?? null) as string | null;
  const hasSignal = Object.values(weights).some((w) => Math.abs(w) > 0.05);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Interests</h1>
        <Link href="/feed" className="text-sm underline">
          ← back to feed
        </Link>
      </div>

      <section className="border rounded-xl p-5 dark:border-zinc-800">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h2 className="font-medium">Your taste, summarized</h2>
          <RegenerateButton />
        </div>
        {hasSignal ? (
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {summary ?? 'No summary yet — click Regenerate.'}
          </p>
        ) : (
          <p className="text-sm text-zinc-500">
            Scroll the feed first — your profile builds from what you watch.
          </p>
        )}
        {data?.updated_at && (
          <p className="text-[10px] text-zinc-400 mt-2">
            updated {new Date(data.updated_at).toLocaleString()}
          </p>
        )}
      </section>

      <section className="border rounded-xl p-5 dark:border-zinc-800">
        <h2 className="font-medium mb-3">Tag profile</h2>
        <InterestRadar weights={weights} />
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Link
          href="/recs/music"
          className="border rounded-xl p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          <p className="text-xs text-zinc-500">apply to</p>
          <p className="font-medium">Music</p>
          <p className="text-xs text-zinc-500 mt-1">via Spotify</p>
        </Link>
        <Link
          href="/recs/food"
          className="border rounded-xl p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          <p className="text-xs text-zinc-500">apply to</p>
          <p className="font-medium">Food</p>
          <p className="text-xs text-zinc-500 mt-1">mock delivery</p>
        </Link>
        <Link
          href="/recs/shopping"
          className="border rounded-xl p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          <p className="text-xs text-zinc-500">apply to</p>
          <p className="font-medium">Shopping</p>
          <p className="text-xs text-zinc-500 mt-1">mock products</p>
        </Link>
      </section>
    </main>
  );
}
