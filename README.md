# Voygent Heritage MVP

Cloudflare Pages + Functions + D1 application for generating personalized heritage travel itineraries.

## Project Structure

```
├── functions/
│   ├── api/
│   │   ├── lib/
│   │   │   ├── provider.ts      # LLM provider routing (CHEAP/SMART)
│   │   │   ├── schemas.ts       # JSON Schema validation
│   │   │   ├── prompts.ts       # System prompts
│   │   │   ├── ocr.ts          # Image OCR processing
│   │   │   └── db.ts           # D1 database helpers
│   │   └── trips/
│   │       ├── index.ts        # POST /api/trips
│   │       └── [id]/
│   │           ├── index.ts    # GET/PATCH /api/trips/:id
│   │           ├── select.ts   # PATCH /api/trips/:id/select
│   │           └── ab.ts       # PATCH /api/trips/:id/ab
│   └── _middleware.ts          # CORS middleware
├── public/
│   ├── index.html             # Chat UI + Quick Tuner
│   └── app.js                 # Frontend logic
├── migrations/
│   └── 001_init.sql           # D1 schema
├── .specify/                  # Spec Kit files
├── prompts/                   # LLM prompts
├── schemas/                   # JSON schemas
├── wrangler.toml
└── package.json
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Database Configuration

The production database for voygent.app is:

```toml
[[d1_databases]]
binding = "DB"
database_name = "voygent-themed"
database_id = "62077781-9458-4206-a5c6-f38dc419e599"
```

This is already configured in `wrangler.toml`.

**📖 Full Schema Documentation**: See [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) for complete table structures, relationships, indexes, and example queries.

### 3. Run migrations

```bash
# Local development
npm run db:migrate

# Production
npm run db:migrate:prod
```

### 4. Set API keys

```bash
# OpenAI (preferred)
wrangler secret put OPENAI_API_KEY

# OR Anthropic
wrangler secret put ANTHROPIC_API_KEY
```

For local development, create `.dev.vars`:

```
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

### 5. Run locally

```bash
npm run dev
```

Visit `http://localhost:8788`

## API Endpoints

### POST /api/trips
Create new trip from intake (multipart form):
- `text`: Combined user input
- `urls`: Genealogy URLs
- `files`: Uploaded documents (OCR for images)
- `userId`: Optional user ID

Returns: `{ tripId, intake, options, status }`

### GET /api/trips/:id
Get trip details

Returns: `{ id, userId, template, title, intake, options, itinerary, variants, status }`

### GET /api/trips?userId=:userId
List trips for user

### PATCH /api/trips/:id
Update trip title/intake

Body: `{ title?, intake? }`

### PATCH /api/trips/:id/select
Select option (A/B/C/D)

Body: `{ optionKey: "A" }`

Returns: `{ tripId, selectedOption, itinerary, status }`

### PATCH /api/trips/:id/ab
Generate A/B variants

Body: `{ transport?, luxury?, activity?, accessibility? }`

Returns: `{ tripId, variantA, variantB, status }`

## Provider Routing

- **CHEAP** (< 600 tokens): `gpt-4o-mini` or `claude-3-haiku`
- **SMART** (≥ 600 tokens or complex): `gpt-4o` or `claude-3-5-sonnet`

Token budgets enforced:
- Intake normalization: 1000 tokens max
- Options generation: 900 tokens max (hard cap)
- A/B variants: 900 tokens max

## Deployment

```bash
npm run deploy
```

Don't forget to set secrets in Cloudflare dashboard!

## License

MIT
