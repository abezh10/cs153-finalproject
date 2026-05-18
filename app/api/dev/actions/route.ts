import { NextResponse } from 'next/server';
import { checkDevTokenOrNotFound } from '@/lib/dev-auth';
import { recomputeProfile } from '@/lib/profile';
import { supabaseAdmin, DEMO_USER_ID } from '@/lib/supabase/admin';
import { TAXONOMY } from '@/lib/taxonomy';

export const dynamic = 'force-dynamic';

type Action = 'recompute_profile' | 'clear_engagements' | 'reseed_taxonomy' | 'clear_image_cache';

export async function POST(req: Request) {
  checkDevTokenOrNotFound(req);
  const body = (await req.json().catch(() => ({}))) as { action?: Action };
  const db = supabaseAdmin();
  switch (body.action) {
    case 'recompute_profile': {
      const r = await recomputeProfile();
      return NextResponse.json({ ok: true, ...r });
    }
    case 'clear_engagements': {
      const { error } = await db.from('engagements').delete().eq('user_id', DEMO_USER_ID);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await db
        .from('interest_profile')
        .update({ tag_weights: {}, llm_summary: null, updated_at: new Date().toISOString() })
        .eq('user_id', DEMO_USER_ID);
      return NextResponse.json({ ok: true });
    }
    case 'reseed_taxonomy': {
      const rows = TAXONOMY.map((t) => ({ slug: t.slug, label: t.label, category: t.category }));
      const { error } = await db.from('tags').upsert(rows, { onConflict: 'slug' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, count: rows.length });
    }
    case 'clear_image_cache': {
      const { error } = await db.from('mock_rec_image_cache').delete().neq('query', '');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
}
