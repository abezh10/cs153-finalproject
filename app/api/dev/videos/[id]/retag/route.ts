import { NextResponse } from 'next/server';
import { checkDevTokenOrNotFound } from '@/lib/dev-auth';
import { callModel } from '@/lib/llm';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isValidSlug, TAXONOMY } from '@/lib/taxonomy';

export const dynamic = 'force-dynamic';

type TaggerOutput = {
  tags: { slug: string; weight: number }[];
  confidence: number;
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  checkDevTokenOrNotFound(req);
  const { id } = await ctx.params;
  const db = supabaseAdmin();
  const { data: video, error } = await db
    .from('videos')
    .select('id, thumbnail_url, title')
    .eq('id', id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  if (!video.thumbnail_url) {
    return NextResponse.json({ error: 'video has no thumbnail' }, { status: 400 });
  }

  const taxonomyList = TAXONOMY.map(
    (t) => `- ${t.slug} (${t.category}) — ${t.label}`,
  ).join('\n');
  const system = `You assign tags to short videos for a recommendation system.
You will see one thumbnail image and the video title. Choose between 1 and 6 tags
ONLY from the fixed taxonomy below. Assign each tag a confidence weight between 0 and 1.
Do not invent slugs. If nothing fits, return an empty list.

Taxonomy:
${taxonomyList}`;

  const raw = await callModel<TaggerOutput>('ingest_tagger', {
    system,
    user: `Title: ${video.title ?? ''}\nThumbnail attached. Choose tags.`,
    images: [{ url: video.thumbnail_url }],
    schemaName: 'assign_tags',
    schemaDescription: 'Assign taxonomy tags to this video.',
    jsonSchema: {
      type: 'object',
      required: ['tags', 'confidence'],
      properties: {
        tags: {
          type: 'array',
          items: {
            type: 'object',
            required: ['slug', 'weight'],
            properties: {
              slug: { type: 'string' },
              weight: { type: 'number' },
            },
          },
        },
        confidence: { type: 'number' },
      },
    },
    cacheSystem: true,
    maxTokens: 800,
  });

  const valid = raw.tags
    .filter((t) => isValidSlug(t.slug) && t.weight >= 0 && t.weight <= 1)
    .slice(0, 8);

  await db.from('video_tags').delete().eq('video_id', id);
  if (valid.length > 0) {
    const { data: tagRows } = await db
      .from('tags')
      .select('id, slug')
      .in('slug', valid.map((t) => t.slug));
    const tagIdBySlug = new Map((tagRows ?? []).map((r) => [r.slug, r.id]));
    const rows = valid
      .map((t) => ({
        video_id: id,
        tag_id: tagIdBySlug.get(t.slug),
        weight: t.weight,
      }))
      .filter((r) => r.tag_id !== undefined);
    if (rows.length > 0) {
      await db.from('video_tags').insert(rows);
    }
  }

  await db.from('video_tag_reviews').upsert(
    {
      video_id: id,
      status: 'pending',
      ai_raw: { ...raw, tagged_at: new Date().toISOString(), retagged: true },
      edited_tags: null,
      reviewed_at: null,
    },
    { onConflict: 'video_id' },
  );

  return NextResponse.json({ ai_raw: raw, tags: valid });
}
