import 'dotenv/config';
import { callModel } from '../lib/llm';
import { pexelsGetVideo } from '../lib/pexels';
import { supabaseAdmin, DEMO_USER_ID } from '../lib/supabase/admin';
import { isValidSlug, TAXONOMY } from '../lib/taxonomy';

void DEMO_USER_ID;

const PEXELS_SEARCH = 'https://api.pexels.com/videos/search';

// Search queries used to discover candidate videos. The taxonomy slugs in the
// `expected` field are *hints* fed into the system prompt; the LLM still
// decides which tags actually apply.
const SEED_QUERIES: { query: string; perPage: number }[] = [
  { query: 'pasta cooking', perPage: 4 },
  { query: 'sushi chef', perPage: 3 },
  { query: 'dessert baking cake', perPage: 4 },
  { query: 'street food night market', perPage: 3 },
  { query: 'coffee pour over', perPage: 3 },
  { query: 'cocktail bar', perPage: 2 },
  { query: 'vegan salad bowl', perPage: 2 },
  { query: 'bbq grill steak', perPage: 3 },
  { query: 'lofi study desk', perPage: 3 },
  { query: 'acoustic guitar folk', perPage: 3 },
  { query: 'edm concert lights', perPage: 3 },
  { query: 'hip hop dance street', perPage: 3 },
  { query: 'jazz live club', perPage: 2 },
  { query: 'piano performance', perPage: 2 },
  { query: 'workout gym training', perPage: 4 },
  { query: 'yoga stretching home', perPage: 3 },
  { query: 'mountain hiking trail', perPage: 3 },
  { query: 'travel city walking', perPage: 3 },
  { query: 'pottery ceramics making', perPage: 2 },
  { query: 'reading cozy living room', perPage: 3 },
  { query: 'video game controller', perPage: 2 },
  { query: 'gardening plants', perPage: 2 },
  { query: 'neon city night', perPage: 2 },
  { query: 'natural light home minimal', perPage: 2 },
];

type PexelsSearchResp = {
  videos: { id: number }[];
};

async function pexelsSearch(query: string, perPage: number): Promise<number[]> {
  const url = `${PEXELS_SEARCH}?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=portrait`;
  const res = await fetch(url, { headers: { Authorization: process.env.PEXELS_API_KEY ?? '' } });
  if (!res.ok) throw new Error(`Pexels search failed for "${query}": ${res.status}`);
  const body = (await res.json()) as PexelsSearchResp;
  return body.videos.map((v) => v.id);
}

type TaggerOutput = {
  tags: { slug: string; weight: number }[];
  confidence: number;
};

async function tagVideo(thumbnailUrl: string, title: string): Promise<TaggerOutput> {
  const taxonomyList = TAXONOMY.map(
    (t) => `- ${t.slug} (${t.category}) — ${t.label}`,
  ).join('\n');
  const system = `You assign tags to short videos for a recommendation system.
You will see one thumbnail image and the video title. Choose between 1 and 6 tags
ONLY from the fixed taxonomy below. Assign each tag a confidence weight between 0 and 1.
Do not invent slugs. If nothing fits, return an empty list.

Taxonomy:
${taxonomyList}`;
  const user = `Title: ${title}\nThumbnail attached. Choose tags.`;

  return callModel<TaggerOutput>('ingest_tagger', {
    system,
    user,
    images: [{ url: thumbnailUrl }],
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
              slug: { type: 'string', description: 'One slug from the taxonomy.' },
              weight: { type: 'number', description: 'Confidence in [0, 1].' },
            },
          },
        },
        confidence: { type: 'number', description: 'Overall confidence in [0, 1].' },
      },
    },
    cacheSystem: true,
    maxTokens: 800,
  });
}

async function ingestOne(videoId: number, force: boolean): Promise<'inserted' | 'skipped' | 'updated'> {
  const db = supabaseAdmin();
  const meta = await pexelsGetVideo(videoId);

  // If already exists and not --force, skip.
  const { data: existing } = await db
    .from('videos')
    .select('id')
    .eq('url', meta.url)
    .maybeSingle();
  if (existing && !force) return 'skipped';

  let dbVideoId = existing?.id as string | undefined;
  if (!dbVideoId) {
    const { data: inserted, error } = await db
      .from('videos')
      .insert({
        url: meta.url,
        thumbnail_url: meta.thumbnail,
        title: meta.title,
        duration_ms: meta.durationMs,
      })
      .select('id')
      .single();
    if (error) throw error;
    dbVideoId = inserted.id;
  }

  // If --force on an existing video, only re-tag if it has not been human-reviewed.
  if (existing && force) {
    const { data: review } = await db
      .from('video_tag_reviews')
      .select('status')
      .eq('video_id', dbVideoId)
      .maybeSingle();
    if (review && review.status !== 'pending') return 'skipped';
    await db.from('video_tags').delete().eq('video_id', dbVideoId);
  }

  const raw = await tagVideo(meta.thumbnail, meta.title);
  const validTags = raw.tags
    .filter((t) => isValidSlug(t.slug) && t.weight >= 0 && t.weight <= 1)
    .slice(0, 8);

  if (validTags.length > 0) {
    const { data: tagRows } = await db
      .from('tags')
      .select('id, slug')
      .in('slug', validTags.map((t) => t.slug));
    const tagIdBySlug = new Map((tagRows ?? []).map((r) => [r.slug, r.id]));
    const rows = validTags
      .map((t) => ({
        video_id: dbVideoId!,
        tag_id: tagIdBySlug.get(t.slug),
        weight: t.weight,
      }))
      .filter((r) => r.tag_id !== undefined);
    if (rows.length > 0) {
      const { error } = await db
        .from('video_tags')
        .upsert(rows, { onConflict: 'video_id,tag_id' });
      if (error) throw error;
    }
  }

  await db.from('video_tag_reviews').upsert(
    {
      video_id: dbVideoId,
      status: 'pending',
      ai_raw: { ...raw, tagged_at: new Date().toISOString() },
      edited_tags: null,
      reviewed_at: null,
    },
    { onConflict: 'video_id' },
  );

  return existing ? 'updated' : 'inserted';
}

async function main() {
  const force = process.argv.includes('--force');
  const allIds = new Set<number>();
  for (const { query, perPage } of SEED_QUERIES) {
    try {
      const ids = await pexelsSearch(query, perPage);
      for (const id of ids) allIds.add(id);
      console.log(`  search "${query}" -> ${ids.length} ids`);
    } catch (e) {
      console.warn(`  search "${query}" failed:`, (e as Error).message);
    }
  }
  console.log(`Discovered ${allIds.size} unique Pexels videos.`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  for (const id of allIds) {
    try {
      const result = await ingestOne(id, force);
      if (result === 'inserted') inserted++;
      else if (result === 'updated') updated++;
      else skipped++;
      process.stdout.write(result === 'skipped' ? '.' : '+');
    } catch (e) {
      failed++;
      console.warn(`\n  video ${id} failed:`, (e as Error).message);
    }
  }
  console.log(`\nDone. inserted=${inserted} updated=${updated} skipped=${skipped} failed=${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
