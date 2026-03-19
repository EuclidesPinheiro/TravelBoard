# TravelBoard

Visual travel itinerary planner (Gantt-style timeline) for group trips. React SPA with localStorage persistence.

## Stack

- React 19 + TypeScript, Vite 6, Tailwind CSS v4, Motion, Lucide React, date-fns, uuid, html2canvas

## Commands

```bash
bun install
bun run dev      # http://localhost:3000
bun run build
bun run preview
bun run lint     # TypeScript type-check
bun run clean    # remove dist/
```

## Important Rules

- NEVER use `new Date('YYYY-MM-DD')` for display — causes timezone bugs. Always use `parseISO` + `format` from date-fns.
- Tailwind v4 uses `@import "tailwindcss"` (not `@tailwind` directives).
- `@/` alias in tsconfig points to project root.
- City colors are deterministic by name (djb2 hash + linear probing).
- localStorage keys: `travelboard_versions`, `travelboard_active_version`.
