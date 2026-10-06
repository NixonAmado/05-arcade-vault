-- SPEC 08: autenticación. profiles + game_sessions ligada a usuario.

-- 1. profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);

create unique index profiles_username_key on public.profiles (upper(username));

alter table public.profiles enable row level security;

create policy "profiles_select_all"
  on public.profiles for select
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- 2. Trigger: auth.users insert -> crea profile si viene un username válido en user_metadata.
-- Si falta o es inválido no crea nada (el usuario pasa por /bienvenida).
-- Una colisión de username hace fallar el registro (índice único).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uname text := upper(new.raw_user_meta_data ->> 'username');
begin
  if uname ~ '^[A-Z0-9_]{3,10}$' then
    insert into public.profiles (id, username) values (new.id, uname);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Trigger: al renombrar, sincroniza game_sessions.nickname del usuario.
create function public.sync_game_sessions_nickname()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.game_sessions
    set nickname = new.username
    where user_id = new.id;
  return new;
end;
$$;

create trigger on_profile_username_changed
  after update of username on public.profiles
  for each row
  when (old.username is distinct from new.username)
  execute function public.sync_game_sessions_nickname();

-- Las funciones de trigger no deben ser invocables vía API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_game_sessions_nickname() from public, anon, authenticated;

-- 4. game_sessions ligada a usuario (se borran las filas previas, decisión del usuario).
delete from public.game_sessions;

alter table public.game_sessions
  add column user_id uuid not null default auth.uid()
  references auth.users(id) on delete cascade;

create index game_sessions_user_id_idx on public.game_sessions (user_id);

drop policy "game_sessions_insert_all" on public.game_sessions;

create policy "game_sessions_insert_own"
  on public.game_sessions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and nickname = (select username from public.profiles where id = (select auth.uid()))
  );
