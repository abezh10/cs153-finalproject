import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EnvStatusTable } from '@/components/dev/EnvStatusTable';
import { SettingsEditor } from '@/components/dev/SettingsEditor';
import { getSettings } from '@/lib/settings';
import { supabaseAdmin, DEMO_USER_ID } from '@/lib/supabase/admin';
import { DevActions } from './DevActions';

export const dynamic = 'force-dynamic';

export default async function DevHomePage({
  searchParams,
}: {
  searchParams: Promise<{ dev?: string }>;
}) {
  const sp = await searchParams;
  const expected = process.env.DEV_TOOLS_TOKEN;
  if (!expected || sp.dev !== expected) notFound();

  const settings = await getSettings();
  const db = supabaseAdmin();
  const [{ count: videoCount }, { count: engagementCount }, { count: approvedCount }] =
    await Promise.all([
      db.from('videos').select('id', { count: 'exact', head: true }),
      db
        .from('engagements')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', DEMO_USER_ID),
      db
        .from('video_tag_reviews')
        .select('video_id', { count: 'exact', head: true })
        .in('status', ['approved', 'edited']),
    ]);

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Developer tools</h1>
        <Link
          href={`/dev/videos?dev=${encodeURIComponent(sp.dev!)}`}
          className="text-sm underline"
        >
          Video review queue →
        </Link>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <Stat label="videos" value={videoCount ?? 0} />
        <Stat label="approved/edited" value={approvedCount ?? 0} />
        <Stat label="engagements (demo)" value={engagementCount ?? 0} />
      </section>

      <section className="border rounded-xl p-5 dark:border-zinc-800">
        <h2 className="font-medium mb-3">Environment</h2>
        <EnvStatusTable />
      </section>

      <section className="border rounded-xl p-5 dark:border-zinc-800">
        <h2 className="font-medium mb-3">Settings</h2>
        <SettingsEditor initial={settings} token={sp.dev!} />
      </section>

      <section className="border rounded-xl p-5 dark:border-zinc-800">
        <h2 className="font-medium mb-3">Manual triggers</h2>
        <DevActions token={sp.dev!} />
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-xl p-4 dark:border-zinc-800">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
