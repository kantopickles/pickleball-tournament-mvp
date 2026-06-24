create extension if not exists "pgcrypto";

create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  format text not null check (format in ('round_robin', 'league', 'tournament')),
  block_count integer not null default 1,
  match_game_count integer not null default 1,
  cover_image_url text,
  admin_pin_hash text not null,
  participant_pin_hash text not null,
  created_at timestamptz not null default now()
);

alter table tournaments add column if not exists cover_image_url text;

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  pin_hash text not null,
  seed integer not null default 0,
  block_number integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round integer not null,
  position integer not null,
  participant1_id uuid references participants(id) on delete set null,
  participant2_id uuid references participants(id) on delete set null,
  participant1_score integer,
  participant2_score integer,
  game_scores jsonb,
  winner_id uuid references participants(id) on delete set null,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, round, position)
);

create table if not exists schedule_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  sequence integer not null,
  court_name text not null default 'Aコート',
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, match_id),
  unique (tournament_id, sequence)
);

alter table tournaments enable row level security;
alter table participants enable row level security;
alter table matches enable row level security;
alter table schedule_entries enable row level security;

-- MVPはNext.jsのサーバーAPIがservice role keyで読み書きします。
-- ブラウザからSupabase表へ直接アクセスさせないため、RLSポリシーは作りません。
