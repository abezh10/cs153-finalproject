import { NextResponse } from 'next/server';
import { authorizeUrl, createPkcePair } from '@/lib/spotify';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { verifier, challenge } = await createPkcePair();
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authorizeUrl(challenge, state));
  res.cookies.set('spotify_pkce_verifier', verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  res.cookies.set('spotify_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
