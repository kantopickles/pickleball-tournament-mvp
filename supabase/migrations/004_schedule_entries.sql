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
