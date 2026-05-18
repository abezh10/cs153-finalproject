import { NextResponse } from 'next/server';
import { checkDevTokenOrNotFound } from '@/lib/dev-auth';

export const dynamic = 'force-dynamic';

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY',
  'PEXELS_API_KEY',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SPOTIFY_REDIRECT_URI',
  'DEMO_USER_ID',
  'DEV_TOOLS_TOKEN',
];

export async function GET(req: Request) {
  checkDevTokenOrNotFound(req);
  const status = REQUIRED.map((name) => ({
    name,
    set: process.env[name] !== undefined && process.env[name] !== '',
  }));
  return NextResponse.json({ env: status });
}
