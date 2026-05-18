import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCode, persistTokens } from '@/lib/spotify';
import { DEMO_USER_ID } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error');
  if (err) {
    return NextResponse.redirect(new URL(`/recs/music?spotify_error=${encodeURIComponent(err)}`, req.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL('/recs/music?spotify_error=missing_code', req.url));
  }
  const c = await cookies();
  const verifier = c.get('spotify_pkce_verifier')?.value;
  const expectedState = c.get('spotify_oauth_state')?.value;
  if (!verifier || state !== expectedState) {
    return NextResponse.redirect(new URL('/recs/music?spotify_error=bad_state', req.url));
  }

  const tokens = await exchangeCode(code, verifier);
  await persistTokens(DEMO_USER_ID, tokens);

  const res = NextResponse.redirect(new URL('/recs/music', req.url));
  res.cookies.delete('spotify_pkce_verifier');
  res.cookies.delete('spotify_oauth_state');
  return res;
}
