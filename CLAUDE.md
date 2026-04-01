# TravelBoard

Collaborative travel itinerary planner with a Gantt-style timeline. Multiple users edit the same board in real time.

## Stack

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS v4, react-router-dom
- **State/Sync:** Yjs CRDT via @syncedstore/core — all itinerary mutations go through `setItinerary` in `ItineraryContext`, which handles undo snapshots, Yjs proxy detachment (deep clone via JSON), orphan cleanup, and transport segment auto-sync
- **Backend:** Supabase (Postgres, Edge Functions, Realtime broadcast + presence channels)
- **Auth:** Per-board JWTs (no user accounts); optional board passwords. Tokens stored in sessionStorage
- **Edge Functions:** Deno runtime with `npm:` specifiers. Excluded from tsconfig

## Commands

```bash
bun install
bun run dev      # http://localhost:3000
bun run build
bun run lint     # tsc --noEmit (type-check only)
```

## Architecture

- **Routes:** `/` landing, `/b/:boardId` board view
- **Data model:** `Itinerary` has `Traveler[]`, each with `Segment[]` (city or transport). Attractions and checklists are keyed by city name
- **Sync flow:** Local Yjs doc changes broadcast to peers via Supabase Realtime channel, then persist incremental diffs to `board_documents` table via `apply-board-update` edge function (server-side Yjs merge with optimistic concurrency). DB reads only happen on initial load and tab-focus recovery (no polling). Only the change author persists — receivers apply broadcasts without re-writing to DB
- **Legacy migration:** Boards created before `board_documents` are auto-migrated on first load from `itinerary_versions`. Don't write new sync code against `itinerary_versions`
- **Transport segments** are auto-generated between consecutive city segments by `syncTravelSegments` — don't create them manually

## Rules

- **Dates:** NEVER use `new Date('YYYY-MM-DD')` — timezone bugs. Always use `parseISO` + `format` from date-fns
- **Tailwind v4:** Uses `@import "tailwindcss"` (not `@tailwind` directives)
- **Path alias:** `@/` points to project root (not `src/`)
- **City colors:** Deterministic by name (djb2 hash + linear probing) — don't assign manually
