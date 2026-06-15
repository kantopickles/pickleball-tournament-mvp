alter table tournaments
add column if not exists block_count integer not null default 1;

alter table participants
add column if not exists block_number integer not null default 1;
