import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkDevTokenOrNotFound } from '@/lib/dev-auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isValidSlug } from '@/lib/taxonomy';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'edited']),
  edited_tags: z
    .array(z.object({ slug: z.string(), weight: z.number().min(0).max(1) }))
    .optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  checkDevTokenOrNotFound(req);
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.status === 'edited') {
    if (!parsed.data.edited_tags || parsed.data.edited_tags.length === 0) {
      return NextResponse.json({ error: 'edited_tags required for status=edited' }, { status: 400 });
    }
    const bad = parsed.data.edited_tags.find((t) => !isValidSlug(t.slug));
    if (bad) {
      return NextResponse.json({ error: `unknown tag slug: ${bad.slug}` }, { status: 400 });
    }
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from('video_tag_reviews')
    .update({
      status: parsed.data.status,
      edited_tags: parsed.data.status === 'edited' ? parsed.data.edited_tags : null,
      notes: parsed.data.notes ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('video_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
