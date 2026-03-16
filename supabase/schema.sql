-- TravelBoard Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- Table: boards (one per shared trip link)
create table boards (
  id uuid primary key default gen_random_uuid(),
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

-- RLS policies (open access — security via unguessable board UUID in URL)
alter table boards enable row level security;
alter table itinerary_versions enable row level security;

create policy "Public access boards" on boards for all using (true) with check (true);
create policy "Public access versions" on itinerary_versions for all using (true) with check (true);

-- Enable Realtime on itinerary_versions
alter publication supabase_realtime add table itinerary_versions;
