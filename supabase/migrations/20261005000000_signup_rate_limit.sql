-- Spec 10: rate limit de signups por IP (IP hasheada, solo accesible via RPC)

create table public.signup_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index signup_attempts_ip_hash_created_at_idx
  on public.signup_attempts (ip_hash, created_at desc);

-- RLS activo y SIN policies: nadie accede directo con anon/authenticated.
alter table public.signup_attempts enable row level security;

create or replace function public.check_signup_rate(
  p_ip_hash text,
  p_limit int,
  p_window interval
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  delete from public.signup_attempts
   where created_at < now() - interval '24 hours';

  select count(*) into v_count
    from public.signup_attempts
   where ip_hash = p_ip_hash
     and created_at > now() - p_window;

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.signup_attempts (ip_hash) values (p_ip_hash);
  return true;
end;
$$;

revoke all on function public.check_signup_rate(text, int, interval) from public;
revoke execute on function public.check_signup_rate(text, int, interval) from anon, authenticated;
grant execute on function public.check_signup_rate(text, int, interval) to service_role;
