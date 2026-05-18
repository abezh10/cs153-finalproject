import 'dotenv/config';
import { supabaseAdmin } from '../lib/supabase/admin';
import { TAXONOMY } from '../lib/taxonomy';

async function main() {
  const db = supabaseAdmin();
  const rows = TAXONOMY.map((t) => ({
    slug: t.slug,
    label: t.label,
    category: t.category,
  }));
  const { error } = await db.from('tags').upsert(rows, { onConflict: 'slug' });
  if (error) throw error;
  console.log(`Upserted ${rows.length} tags.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
