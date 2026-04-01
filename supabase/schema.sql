-- TravelBoard Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- Table: boards (one per shared trip link)
create table boards (
  id uuid primary key default gen_random_uuid(),
  password_hash text,
  short_code text unique,
  created_at timestamptz default now()
);

-- Table: itinerary_versions (each version of a trip plan)
create table itinerary_versions (
  id uuid primary key,
  board_id uuid not null references boards(id) on delete cascade,
  version_index int not null default 0,
  name text not null default 'Roteiro',
  start_date text not null,
  end_date text not null,
  travelers jsonb not null default '[]',
  attractions jsonb not null default '{}',
  checklists jsonb not null default '{}',
  session_id text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Index for fast lookups by board
create index idx_versions_board_id on itinerary_versions(board_id);

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

alter table boards enable row level security;
alter table itinerary_versions enable row level security;

create policy "Board token can read versions"
on itinerary_versions for select
using (public.has_board_access(board_id));

create policy "Board token can insert versions"
on itinerary_versions for insert
with check (public.has_board_access(board_id));

create policy "Board token can update versions"
on itinerary_versions for update
using (public.has_board_access(board_id))
with check (public.has_board_access(board_id));

create policy "Board token can delete versions"
on itinerary_versions for delete
using (public.has_board_access(board_id));

-- Table: board_documents (single Yjs doc per board for efficient sync)
create table board_documents (
  board_id uuid primary key references boards(id) on delete cascade,
  yjs_state text not null default '',
  revision bigint not null default 0,
  updated_at timestamptz default now()
);

alter table board_documents enable row level security;

create policy "Board token can read documents"
on board_documents for select
using (public.has_board_access(board_id));

-- Enable Realtime
alter publication supabase_realtime add table itinerary_versions;
alter publication supabase_realtime add table board_documents;
