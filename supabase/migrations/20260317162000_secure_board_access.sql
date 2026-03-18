create extension if not exists pgcrypto with schema extensions;

alter table public.boards
  add column if not exists password_hash text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'boards'
      and column_name = 'password'
  ) then
    execute $sql$
      update public.boards
      set password_hash = extensions.crypt(password, extensions.gen_salt('bf', 12))
      where password is not null
        and password_hash is null
    $sql$;

    alter table public.boards
      drop column password;
  end if;
end $$;

create or replace function public.request_jwt_claims()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb
$$;

create or replace function public.current_board_id()
returns uuid
language sql
stable
as $$
  select nullif(public.request_jwt_claims() ->> 'board_id', '')::uuid
$$;

create or replace function public.has_board_access(target_board_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.request_jwt_claims() ->> 'board_access' = 'true'
    and public.current_board_id() = target_board_id
$$;

drop policy if exists "Public access boards" on public.boards;
drop policy if exists "Public access versions" on public.itinerary_versions;
drop policy if exists "Board token can read versions" on public.itinerary_versions;
drop policy if exists "Board token can insert versions" on public.itinerary_versions;
drop policy if exists "Board token can update versions" on public.itinerary_versions;
drop policy if exists "Board token can delete versions" on public.itinerary_versions;

create policy "Board token can read versions"
on public.itinerary_versions
for select
using (public.has_board_access(board_id));

create policy "Board token can insert versions"
on public.itinerary_versions
for insert
with check (public.has_board_access(board_id));

create policy "Board token can update versions"
on public.itinerary_versions
for update
using (public.has_board_access(board_id))
with check (public.has_board_access(board_id));

create policy "Board token can delete versions"
on public.itinerary_versions
for delete
using (public.has_board_access(board_id));
