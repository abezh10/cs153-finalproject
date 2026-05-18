import { NextResponse } from 'next/server';
import { searchAndRerank } from '@/lib/spotify';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const recs = await searchAndRerank();
    return NextResponse.json({ recs });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
