# TravelBoard

## Run locally

Requirements:
- `bun`
- `supabase` CLI
- Docker

Install dependencies:

```bash
bun install
```

Start local Supabase:

```bash
supabase start
supabase db push --local
```

Create `supabase/functions/.env`:

```env
TRAVELBOARD_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
```

Run the Edge Functions:

```bash
supabase functions serve --env-file supabase/functions/.env --no-verify-jwt
```

Run the app:

```bash
bun run dev
```

Open:

```text
http://localhost:5173
```
