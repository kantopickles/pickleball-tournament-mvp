alter table tournaments
add column if not exists match_game_count integer not null default 1;

alter table matches
add column if not exists game_scores jsonb;
