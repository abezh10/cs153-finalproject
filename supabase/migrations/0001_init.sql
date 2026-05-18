create extension if not exists "uuid-ossp";

create table users (
  id uuid primary key default uuid_generate_v4(),
  display_name text not null,
  created_at timestamptz not null default now()
);

create table videos (
  id uuid primary key default uuid_generate_v4(),
  url text not null unique,
  thumbnail_url text,
  title text,
  duration_ms int not null,
  source text not null default 'pexels',
  created_at timestamptz not null default now()
);

create table tags (
  id serial primary key,
  slug text unique not null,
  label text not null,
  category text not null check (category in ('cuisine','music','aesthetic','activity','mood'))
);

create table video_tags (
  video_id uuid references videos(id) on delete cascade,
  tag_id int references tags(id),
  weight real not null check (weight between 0 and 1),
  primary key (video_id, tag_id)
);

create table engagements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id),
  video_id uuid references videos(id),
  watch_ms int not null,
  completion_pct real not null,
  liked boolean not null default false,
  disliked boolean not null default false,
  replays int not null default 0,
  created_at timestamptz not null default now()
);
create index engagements_user_created_idx on engagements(user_id, created_at desc);

create table interest_profile (
  user_id uuid primary key references users(id),
  tag_weights jsonb not null default '{}'::jsonb,
  llm_summary text,
  updated_at timestamptz not null default now()
);

create table spotify_tokens (
  user_id uuid primary key references users(id),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null
);

create table mock_rec_image_cache (
  query text primary key,
  image_url text not null,
  fetched_at timestamptz not null default now()
);

create table video_tag_reviews (
  video_id uuid primary key references videos(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','edited')),
  ai_raw jsonb not null,
  edited_tags jsonb,
  reviewed_at timestamptz,
  notes text
);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into settings (key, value) values ('current', '{
  "models": {
    "ingest_tagger":    {"provider":"anthropic","model":"claude-opus-4-7"},
    "profile_summary":  {"provider":"google","model":"gemini-2.5-flash"},
    "spotify_rerank":   {"provider":"google","model":"gemini-2.5-flash"},
    "mock_recs":        {"provider":"google","model":"gemini-2.5-flash"}
  },
  "ranking": {"epsilon": 0.7},
  "scoring": {
    "like": 2.0, "completion": 1.5, "replay": 1.0,
    "dislike": -2.0, "skip": -1.5,
    "decay_half_life_days": 7
  },
  "feed": {"batch_size": 5, "exclude_last_n_seen": 50},
  "recs": {"music_candidates_per_query": 10, "music_final": 8, "mock_cards": 6},
  "exclude_rejected_videos_from_feed": true
}'::jsonb);

-- Resolves a video's *effective* tags, honoring human review:
--   status='rejected' -> no rows
--   status='edited'   -> rows from edited_tags JSONB
--   else (pending/approved/no review) -> rows from video_tags
create view v_effective_video_tags as
  select v.id as video_id, t.slug as tag_slug, vt.weight as weight
    from videos v
    join video_tags vt on vt.video_id = v.id
    join tags t on t.id = vt.tag_id
    left join video_tag_reviews r on r.video_id = v.id
   where r.status is null or r.status in ('pending','approved')
  union all
  select v.id as video_id,
         (e->>'slug')::text as tag_slug,
         coalesce((e->>'weight')::real, 1.0) as weight
    from videos v
    join video_tag_reviews r on r.video_id = v.id
    cross join lateral jsonb_array_elements(coalesce(r.edited_tags, '[]'::jsonb)) e
   where r.status = 'edited';

insert into users (id, display_name) values
  ('00000000-0000-0000-0000-000000000001', 'demo');
insert into interest_profile (user_id) values
  ('00000000-0000-0000-0000-000000000001');
