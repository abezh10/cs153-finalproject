import { NextResponse } from 'next/server';
import { recomputeProfile } from '@/lib/profile';
import { supabaseAdmin, DEMO_USER_ID } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from('interest_profile')
    .select('user_id, tag_weights, llm_summary, updated_at')
    .eq('user_id', DEMO_USER_ID)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST() {
  try {
    const out = await recomputeProfile();
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
