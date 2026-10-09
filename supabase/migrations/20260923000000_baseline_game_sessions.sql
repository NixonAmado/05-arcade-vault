-- SPEC 11: baseline. Versiona game_sessions tal como existia antes de la spec 08
-- (create_game_sessions + add_game_id_to_game_sessions de Dev). Prod parte de BD vacia.

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  score integer not null check (score >= 0),
  wave_completed integer not null check (wave_completed >= 0),
  won boolean not null default false,
  duration_seconds integer not null check (duration_seconds >= 0),
  played_at timestamptz not null default now(),
  game_id text not null
);

create index game_sessions_nickname_idx on public.game_sessions (nickname);
create index game_sessions_score_idx on public.game_sessions (score desc);
create index game_sessions_game_id_idx on public.game_sessions (game_id);
create index game_sessions_game_id_score_idx on public.game_sessions (game_id, score desc);

alter table public.game_sessions enable row level security;

create policy "game_sessions_select_all"
  on public.game_sessions for select to anon, authenticated
  using (true);

-- Policy abierta original; la elimina 20261004000000_auth_profiles.sql.
create policy "game_sessions_insert_all"
  on public.game_sessions for insert to anon, authenticated
  with check (true);
