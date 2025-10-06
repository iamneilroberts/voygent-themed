# Voygent • Heritage Trip MVP — Plan

## Architecture
Two supported targets; code should be adapter-based.

### A) Cloudflare Pages + Functions + D1 (recommended)
- **Frontend**: Static HTML/JS (chat UI + quick intake widgets).
- **API**: Pages Functions under `/api/*`.
- **DB**: Cloudflare **D1** (SQLite at edge).
- **File uploads**: Small files via multipart to Functions; for larger, presigned **R2** URLs.
- **Provider router**:
  - CHEAP: OpenAI `gpt-4o-mini` or Anthropic `claude-3-haiku` for intake/validation.
  - SMART: OpenAI `gpt-4o` or Anthropic `claude-3-sonnet` for dense expansions only.

### B) Render + Node/Express + Postgres (alternate)
- Same endpoints; swap D1 with Postgres.
- Single Docker image; serve `frontend/` statics.

## Endpoints (identical on both targets)
- `POST /api/trips` → parse intake (files/links/text) → store → generate `options[<=4]`.
- `PATCH /api/trips/:id/select` → choose `optionKey` (e.g., `A`/`B`/`C`/`D`) → return concise itinerary draft.
- `PATCH /api/trips/:id/ab` → preferences `{transport,luxury,activity,access}` → generate **variantA** & **variantB** (2 styles).
- `GET /api/trips/:id` → full record; `GET /api/trips?userId=…` → list.
- `PATCH /api/trips/:id` → update title/intake; re‑draft optional.

## Data (D1/Postgres)
- `trips(id, user_id, template, title, intake_json, options_json, itinerary_json, variants_json, status, created_at, updated_at)`
- `messages(id, trip_id, role, content, tokens_in, tokens_out, cost_usd, created_at)`

## Schemas (see /schemas)
- `intake.v1.json` — normalized data from all inputs.
- `option.v1.json` — one option’s structure.
- `itinerary.v1.json` — selected itinerary with budget bands & validation.

## Provider Cost Policy
- Intake normalization → CHEAP (short).
- Options (<=4) → CHEAP (terse), hard cap 900 tokens output.
- Itinerary expand → CHEAP unless long/complex; then SMART with 600–900 token cap.
- Validation → CHEAP (<= 600 tokens), link to sources when possible.

## Validation Strategy
- 3 checks: distance sanity, opening patterns, access notes → return `checks[]` with ok/fix/url.
- No definitive claims; use “typical hours” and ask user to confirm final bookings.

## Security & Abuse
- Basic rate-limit per IP (Pages: durable KV counter or D1 counter).
- Turnstile on share link generation (optional).
- Strip EXIF & PII from uploaded images before model calls.

## Rollout
- Phase 1: Intake → Options (<=4) → Select → A/B.
- Phase 2: Share copy & Handoff payload for pros.
- Phase 3: Add more templates (Honeymoon / School Break) behind flags.
