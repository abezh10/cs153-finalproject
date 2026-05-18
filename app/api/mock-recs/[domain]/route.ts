import { NextResponse } from 'next/server';
import { callModel } from '@/lib/llm';
import { pexelsPhotoSearchCached } from '@/lib/pexels';
import { getSettings } from '@/lib/settings';
import { supabaseAdmin, DEMO_USER_ID } from '@/lib/supabase/admin';
import { TAG_BY_SLUG, TAXONOMY } from '@/lib/taxonomy';

export const dynamic = 'force-dynamic';

const DOMAIN_PROMPTS: Record<string, { context: string; vendorHint: string }> = {
  food: {
    context:
      "You generate mock DoorDash-style food recommendations. Each card represents a restaurant or specific dish 'near you'.",
    vendorHint: 'Restaurant or food vendor name (e.g., "Niko Niko Sushi", "Bear Hug Bakery").',
  },
  shopping: {
    context:
      "You generate mock Etsy-style shopping cards. Each card is a single product the viewer might want.",
    vendorHint: 'Shop or brand name (e.g., "Hollow Pine Goods", "Atelier Mira").',
  },
};

type RecCard = {
  title: string;
  vendor: string;
  price: string;
  blurb: string;
  why_tags: string[];
  image_query: string;
};

type RecsResp = { cards: RecCard[] };

export async function POST(_req: Request, ctx: { params: Promise<{ domain: string }> }) {
  const { domain } = await ctx.params;
  const cfg = DOMAIN_PROMPTS[domain];
  if (!cfg) return NextResponse.json({ error: 'unknown domain' }, { status: 404 });

  const settings = await getSettings();
  const db = supabaseAdmin();
  const { data: prof } = await db
    .from('interest_profile')
    .select('tag_weights, llm_summary')
    .eq('user_id', DEMO_USER_ID)
    .single();
  const tagWeights = (prof?.tag_weights ?? {}) as Record<string, number>;
  const summary = (prof?.llm_summary ?? '') as string;

  const topTags = Object.entries(tagWeights)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([slug, w]) => ({
      slug,
      label: TAG_BY_SLUG[slug]?.label ?? slug,
      category: TAG_BY_SLUG[slug]?.category,
      weight: w,
    }));

  const N = settings.recs.mock_cards;
  const slugList = TAXONOMY.map((t) => t.slug).join(', ');

  const system = `${cfg.context}
Produce exactly ${N} cards. Each card MUST include:
- title: a short product/dish name
- vendor: ${cfg.vendorHint}
- price: a string like "$12" or "$24.50"
- blurb: one sentence, friendly, ≤ 25 words
- why_tags: 1-3 slugs from this list that justify the recommendation — choose from the user's top tags, never invent: ${slugList}
- image_query: 2-4 lowercase words for stock-photo search, no punctuation
Avoid duplicate titles or vendors.`;

  const user = JSON.stringify({
    profile_summary: summary,
    top_tags: topTags,
    domain,
    count: N,
  });

  let recs: RecsResp;
  try {
    recs = await callModel<RecsResp>('mock_recs', {
      system,
      user,
      schemaName: 'generate_cards',
      schemaDescription: `Generate ${N} mock ${domain} recommendation cards.`,
      jsonSchema: {
        type: 'object',
        required: ['cards'],
        properties: {
          cards: {
            type: 'array',
            items: {
              type: 'object',
              required: ['title', 'vendor', 'price', 'blurb', 'why_tags', 'image_query'],
              properties: {
                title: { type: 'string' },
                vendor: { type: 'string' },
                price: { type: 'string' },
                blurb: { type: 'string' },
                why_tags: { type: 'array', items: { type: 'string' } },
                image_query: { type: 'string' },
              },
            },
          },
        },
      },
      cacheSystem: true,
      maxTokens: 2000,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const validSlugs = new Set(TAXONOMY.map((t) => t.slug));
  const cardsWithImages = await Promise.all(
    (recs.cards ?? []).slice(0, N).map(async (c) => ({
      ...c,
      why_tags: (c.why_tags ?? []).filter((s) => validSlugs.has(s)),
      image_url: await pexelsPhotoSearchCached(c.image_query),
    })),
  );

  return NextResponse.json({ cards: cardsWithImages });
}
