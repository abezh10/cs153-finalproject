import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin, DEMO_USER_ID } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const engagementSchema = z.object({
  video_id: z.string().uuid(),
  watch_ms: z.number().int().nonnegative(),
  completion_pct: z.number().min(0).max(1),
  liked: z.boolean().optional().default(false),
  disliked: z.boolean().optional().default(false),
  replays: z.number().int().nonnegative().optional().default(0),
});

export async function POST(req: Request) {
  // sendBeacon ships a Blob; fetch ships JSON. Parse uniformly by reading text.
  let payload: unknown;
  try {
    const text = await req.text();
    payload = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = engagementSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db.from('engagements').insert({
    user_id: DEMO_USER_ID,
    video_id: parsed.data.video_id,
    watch_ms: parsed.data.watch_ms,
    completion_pct: parsed.data.completion_pct,
    liked: parsed.data.liked,
    disliked: parsed.data.disliked,
    replays: parsed.data.replays,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Debounce: every 5 engagements trigger a profile recompute in the background.
  const { count } = await db
    .from('engagements')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', DEMO_USER_ID);
  if (count !== null && count > 0 && count % 5 === 0) {
    // Fire and forget — don't await.
    void fetch(new URL('/api/profile', req.url), { method: 'POST' }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
