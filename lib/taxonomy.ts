export type TagCategory = 'cuisine' | 'music' | 'aesthetic' | 'activity' | 'mood';

export type Tag = {
  slug: string;
  label: string;
  category: TagCategory;
  spotify_queries?: string[];
};

export const TAXONOMY: Tag[] = [
  // cuisine
  { slug: 'pasta', label: 'Pasta', category: 'cuisine' },
  { slug: 'sushi', label: 'Sushi', category: 'cuisine' },
  { slug: 'dessert', label: 'Dessert & Baking', category: 'cuisine' },
  { slug: 'street-food', label: 'Street Food', category: 'cuisine' },
  { slug: 'coffee', label: 'Coffee', category: 'cuisine' },
  { slug: 'cocktails', label: 'Cocktails', category: 'cuisine' },
  { slug: 'plant-based', label: 'Plant-Based', category: 'cuisine' },
  { slug: 'bbq-grill', label: 'BBQ & Grill', category: 'cuisine' },

  // music
  { slug: 'lofi', label: 'Lo-Fi', category: 'music', spotify_queries: ['lofi beats', 'chillhop', 'lofi study'] },
  { slug: 'indie-folk', label: 'Indie Folk', category: 'music', spotify_queries: ['indie folk acoustic', 'folk singer-songwriter'] },
  { slug: 'electronic', label: 'Electronic', category: 'music', spotify_queries: ['electronic chill', 'downtempo electronic'] },
  { slug: 'edm', label: 'EDM', category: 'music', spotify_queries: ['edm festival', 'big room house'] },
  { slug: 'hip-hop', label: 'Hip-Hop', category: 'music', spotify_queries: ['hip hop 2020s', 'rap chill'] },
  { slug: 'jazz', label: 'Jazz', category: 'music', spotify_queries: ['modern jazz', 'jazz cafe'] },
  { slug: 'classical', label: 'Classical', category: 'music', spotify_queries: ['classical piano', 'orchestral'] },
  { slug: 'pop', label: 'Pop', category: 'music', spotify_queries: ['pop hits', 'indie pop'] },

  // aesthetic
  { slug: 'cozy', label: 'Cozy', category: 'aesthetic' },
  { slug: 'minimalist', label: 'Minimalist', category: 'aesthetic' },
  { slug: 'maximalist', label: 'Maximalist', category: 'aesthetic' },
  { slug: 'urban', label: 'Urban', category: 'aesthetic' },
  { slug: 'rural-pastoral', label: 'Rural & Pastoral', category: 'aesthetic' },
  { slug: 'neon-night', label: 'Neon Night', category: 'aesthetic' },
  { slug: 'natural-light', label: 'Natural Light', category: 'aesthetic' },
  { slug: 'vintage', label: 'Vintage', category: 'aesthetic' },

  // activity
  { slug: 'cooking', label: 'Cooking', category: 'activity' },
  { slug: 'workout', label: 'Workout', category: 'activity' },
  { slug: 'yoga', label: 'Yoga & Stretching', category: 'activity' },
  { slug: 'travel', label: 'Travel', category: 'activity' },
  { slug: 'hiking', label: 'Hiking & Outdoors', category: 'activity' },
  { slug: 'crafts', label: 'Crafts & DIY', category: 'activity' },
  { slug: 'reading', label: 'Reading', category: 'activity' },
  { slug: 'gaming', label: 'Gaming', category: 'activity' },
  { slug: 'gardening', label: 'Gardening', category: 'activity' },

  // mood
  { slug: 'chill', label: 'Chill', category: 'mood' },
  { slug: 'energetic', label: 'Energetic', category: 'mood' },
  { slug: 'romantic', label: 'Romantic', category: 'mood' },
  { slug: 'melancholy', label: 'Melancholy', category: 'mood' },
  { slug: 'playful', label: 'Playful', category: 'mood' },
  { slug: 'focused', label: 'Focused', category: 'mood' },
];

export const TAG_SLUGS = new Set(TAXONOMY.map((t) => t.slug));
export const TAG_BY_SLUG: Record<string, Tag> = Object.fromEntries(
  TAXONOMY.map((t) => [t.slug, t]),
);

export function isValidSlug(slug: string): boolean {
  return TAG_SLUGS.has(slug);
}

export function labelFor(slug: string): string {
  return TAG_BY_SLUG[slug]?.label ?? slug;
}
