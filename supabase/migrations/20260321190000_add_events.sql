alter table itinerary_versions
add column if not exists events jsonb not null default '{}';
