import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { supabaseAdmin } from '../lib/supabase/admin';

async function main() {
  const path = join(process.cwd(), 'supabase', 'migrations', '0001_init.sql');
  const sql = readFileSync(path, 'utf8');
  // supabase-js does not expose raw SQL; use the postgres-meta REST API.
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) {
    console.error(
      'exec_sql RPC unavailable. Apply this SQL manually via the Supabase dashboard SQL editor, or via the Supabase MCP `apply_migration` tool:',
    );
    console.log('---\n' + sql + '\n---');
    void supabaseAdmin(); // ensure env vars validated
    process.exit(1);
  }
  console.log('Migration applied.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
