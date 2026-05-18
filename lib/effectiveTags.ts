import { supabaseAdmin } from './supabase/admin';

export type EffectiveTagRow = { video_id: string; tag_slug: string; weight: number };

export async function effectiveTagsForVideos(
  videoIds: string[],
): Promise<EffectiveTagRow[]> {
  if (videoIds.length === 0) return [];
  const { data, error } = await supabaseAdmin()
    .from('v_effective_video_tags')
    .select('video_id, tag_slug, weight')
    .in('video_id', videoIds);
  if (error) throw error;
  return (data ?? []) as EffectiveTagRow[];
}

export async function effectiveTagsForVideo(
  videoId: string,
): Promise<EffectiveTagRow[]> {
  return effectiveTagsForVideos([videoId]);
}
