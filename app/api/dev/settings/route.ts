import { NextResponse } from 'next/server';
import { checkDevTokenOrNotFound } from '@/lib/dev-auth';
import { getSettings, patchSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  checkDevTokenOrNotFound(req);
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PATCH(req: Request) {
  checkDevTokenOrNotFound(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  try {
    const updated = await patchSettings(body);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
