import { callModel } from './llm';
import { getSettings } from './settings';
import { supabaseAdmin, DEMO_USER_ID } from './supabase/admin';
import { TAG_BY_SLUG } from './taxonomy';

export const SPOTIFY_SCOPES = 'user-top-read';

function clientId(): string {
  const v = process.env.SPOTIFY_CLIENT_ID;
  if (!v) throw new Error('SPOTIFY_CLIENT_ID not set');
  return v;
}
function clientSecret(): string {
  const v = process.env.SPOTIFY_CLIENT_SECRET;
  if (!v) throw new Error('SPOTIFY_CLIENT_SECRET not set');
  return v;
}
function redirectUri(): string {
  const v = process.env.SPOTIFY_REDIRECT_URI;
  if (!v) throw new Error('SPOTIFY_REDIRECT_URI not set');
  return v;
}

function base64urlEncode(buf: ArrayBuffer): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  const verifier = base64urlEncode(arr.buffer);
  const challengeBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64urlEncode(challengeBuf) };
}

export function authorizeUrl(challenge: string, state: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: clientId(),
    scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  });
  return `https://accounts.spotify.com/authorize?${p.toString()}`;
}

type TokenResp = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

export async function exchangeCode(code: string, verifier: string): Promise<TokenResp> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    client_id: clientId(),
    code_verifier: verifier,
  });
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64'),
    },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as TokenResp;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResp> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId(),
  });
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64'),
    },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token refresh failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as TokenResp;
}

export async function persistTokens(userId: string, t: TokenResp, existingRefresh?: string) {
  const expires_at = new Date(Date.now() + (t.expires_in - 30) * 1000).toISOString();
  const refresh_token = t.refresh_token ?? existingRefresh;
  if (!refresh_token) throw new Error('No refresh token to persist');
  const { error } = await supabaseAdmin()
    .from('spotify_tokens')
    .upsert({
      user_id: userId,
      access_token: t.access_token,
      refresh_token,
      expires_at,
    });
  if (error) throw error;
}

export async function getAccessToken(userId: string = DEMO_USER_ID): Promise<string | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('spotify_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() > Date.now()) return data.access_token;
  const refreshed = await refreshAccessToken(data.refresh_token);
  await persistTokens(userId, refreshed, data.refresh_token);
  return refreshed.access_token;
}

type Track = {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: { name: string; images: { url: string }[] };
};

async function spotifyGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export function tagsToQueries(tagWeights: Record<string, number>): string[] {
  const positives = Object.entries(tagWeights).filter(([, w]) => w > 0);
  const musicTags = positives
    .filter(([slug]) => TAG_BY_SLUG[slug]?.category === 'music')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const moodOrAesthetic = positives
    .filter(
      ([slug]) =>
        TAG_BY_SLUG[slug]?.category === 'mood' ||
        TAG_BY_SLUG[slug]?.category === 'aesthetic',
    )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([slug]) => TAG_BY_SLUG[slug].label.toLowerCase());

  const queries: string[] = [];
  for (const [slug] of musicTags) {
    const tag = TAG_BY_SLUG[slug];
    const seed = tag.spotify_queries?.[0];
    if (seed) queries.push(seed);
    if (moodOrAesthetic[0]) queries.push(`${moodOrAesthetic[0]} ${tag.label.toLowerCase()}`);
  }
  if (queries.length === 0 && moodOrAesthetic.length > 0) {
    queries.push(`${moodOrAesthetic.join(' ')} music`);
  }
  if (queries.length === 0) queries.push('new music friday');
  return Array.from(new Set(queries)).slice(0, 5);
}

export type MusicRec = { track: Track; why: string };

export async function searchAndRerank(userId: string = DEMO_USER_ID): Promise<MusicRec[]> {
  const token = await getAccessToken(userId);
  if (!token) throw new Error('Spotify not connected');
  const settings = await getSettings();
  const db = supabaseAdmin();

  const { data: prof } = await db
    .from('interest_profile')
    .select('tag_weights, llm_summary')
    .eq('user_id', userId)
    .single();
  const tagWeights = (prof?.tag_weights ?? {}) as Record<string, number>;
  const summary = (prof?.llm_summary ?? '') as string;

  const queries = tagsToQueries(tagWeights);
  const [topTracksResp, topArtistsResp] = await Promise.all([
    spotifyGet<{ items: Track[] }>(token, '/me/top/tracks?limit=20&time_range=short_term').catch(
      () => ({ items: [] as Track[] }),
    ),
    spotifyGet<{ items: { id: string; name: string }[] }>(
      token,
      '/me/top/artists?limit=10&time_range=short_term',
    ).catch(() => ({ items: [] })),
  ]);
  const topArtistIds = new Set(topArtistsResp.items.map((a) => a.id));

  const searchResults: Track[] = [];
  for (const q of queries) {
    const r = await spotifyGet<{ tracks: { items: Track[] } }>(
      token,
      `/search?type=track&limit=${settings.recs.music_candidates_per_query}&q=${encodeURIComponent(q)}`,
    );
    searchResults.push(...r.tracks.items);
  }

  const seen = new Set<string>();
  const candidates: Track[] = [];
  for (const t of [...topTracksResp.items, ...searchResults]) {
    if (!t || seen.has(t.id)) continue;
    if (t.artists.some((a) => topArtistIds.has(a.id))) continue;
    seen.add(t.id);
    candidates.push(t);
    if (candidates.length >= 60) break;
  }

  if (candidates.length === 0) return [];

  const finalN = settings.recs.music_final;
  const rerank = await callModel<{ picks: { id: string; why: string }[] }>('spotify_rerank', {
    system:
      'You rerank Spotify tracks to match a viewer\'s taste profile derived from their video-feed activity. ' +
      `Return exactly ${finalN} picks from the provided candidates. Each "why" must be one short sentence ` +
      'naming the specific tag(s) from the profile that justify the pick.',
    user: JSON.stringify({
      profile_summary: summary,
      tag_weights: tagWeights,
      candidates: candidates.map((t) => ({
        id: t.id,
        name: t.name,
        artists: t.artists.map((a) => a.name),
        album: t.album.name,
      })),
    }),
    schemaName: 'rerank_tracks',
    schemaDescription: 'Pick the best tracks for this profile.',
    jsonSchema: {
      type: 'object',
      required: ['picks'],
      properties: {
        picks: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'why'],
            properties: {
              id: { type: 'string' },
              why: { type: 'string' },
            },
          },
        },
      },
    },
    maxTokens: 1500,
  });

  const byId = new Map(candidates.map((t) => [t.id, t]));
  const picks: MusicRec[] = [];
  for (const p of rerank.picks) {
    const t = byId.get(p.id);
    if (t) picks.push({ track: t, why: p.why });
    if (picks.length >= finalN) break;
  }
  return picks;
}
