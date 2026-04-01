-- Single-row Yjs document store per board.
-- Replaces the pattern of persisting full JSON rows to itinerary_versions for sync.
-- Clients now send incremental Yjs diffs via the apply-board-update edge function,
-- and this table stores the merged result with a monotonic revision counter.

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

-- Enable Realtime so clients receive revision-change notifications
-- instead of polling every 10 seconds
alter publication supabase_realtime add table board_documents;

-- itinerary_versions remains for legacy reads / admin queries;
-- clients no longer write to it for sync purposes.
