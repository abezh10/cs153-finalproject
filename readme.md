**CS153 Final Project Spring 2026**

Abraham Zhong

An Interest-Profile Platform: a Reels-style video feed that builds a portable
preference profile from engagement, then applies it to music (real Spotify),
food, and shopping (LLM-mocked).

## Setup

1. `pnpm install`
2. Copy `.env.local.example` to `.env.local` and fill in keys.
3. Apply `supabase/migrations/0001_init.sql` via the Supabase SQL editor
   (or `pnpm migrate` if your project has an `exec_sql` RPC).
4. `pnpm seed:tags` then `pnpm ingest` to populate the video pool.
5. `pnpm dev` and open `http://localhost:3000`.

## Dev tools

`/dev?dev=<DEV_TOOLS_TOKEN>` — settings, env status, manual triggers.
`/dev/videos?dev=<DEV_TOOLS_TOKEN>` — video tag review queue (approve / edit / reject / retag).

Without the token, all `/dev/*` routes return 404.
