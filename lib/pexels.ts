import { supabaseAdmin } from './supabase/admin';

type PexelsPhoto = {
  id: number;
  src: { medium: string; large: string; original: string };
  alt: string;
};

type PexelsPhotoSearchResp = { photos: PexelsPhoto[] };

type PexelsVideoFile = { link: string; quality: string; width: number; height: number; file_type: string };
type PexelsVideo = {
  id: number;
  duration: number; // seconds
  image: string;
  url: string;
  video_files: PexelsVideoFile[];
};

function apiKey(): string {
  const k = process.env.PEXELS_API_KEY;
  if (!k) throw new Error('PEXELS_API_KEY not set');
  return k;
}

export async function pexelsPhotoSearchCached(query: string): Promise<string> {
  const db = supabaseAdmin();
  const { data: cached } = await db
    .from('mock_rec_image_cache')
    .select('image_url')
    .eq('query', query)
    .maybeSingle();
  if (cached?.image_url) return cached.image_url;

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`;
  const res = await fetch(url, { headers: { Authorization: apiKey() } });
  if (!res.ok) throw new Error(`Pexels photo search failed: ${res.status}`);
  const body = (await res.json()) as PexelsPhotoSearchResp;
  const photo = body.photos[0];
  if (!photo) {
    // Cache a neutral placeholder so we don't retry the same empty query.
    const placeholder = 'https://images.pexels.com/photos/3811/flight-sky-earth-space.jpg?auto=compress&w=400&h=400';
    await db.from('mock_rec_image_cache').upsert({ query, image_url: placeholder });
    return placeholder;
  }
  await db.from('mock_rec_image_cache').upsert({ query, image_url: photo.src.medium });
  return photo.src.medium;
}

export async function pexelsGetVideo(id: number): Promise<{
  url: string;
  thumbnail: string;
  durationMs: number;
  title: string;
}> {
  const res = await fetch(`https://api.pexels.com/videos/videos/${id}`, {
    headers: { Authorization: apiKey() },
  });
  if (!res.ok) throw new Error(`Pexels video fetch failed: ${res.status}`);
  const v = (await res.json()) as PexelsVideo;
  // Pick the smallest video file ≥ 480p for fast streaming.
  const sorted = [...v.video_files].sort((a, b) => a.width - b.width);
  const file =
    sorted.find((f) => f.width >= 540 && f.file_type === 'video/mp4') ??
    sorted.find((f) => f.file_type === 'video/mp4') ??
    sorted[0];
  return {
    url: file.link,
    thumbnail: v.image,
    durationMs: Math.max(1, Math.round(v.duration * 1000)),
    title: v.url.split('/').filter(Boolean).slice(-1)[0]?.replace(/-/g, ' ') ?? `Pexels ${v.id}`,
  };
}
