# Quickstart: VoyGent V3 Local Development

**Prerequisites**:
- Node.js 18+ (for Wrangler CLI)
- Git
- Text editor (VS Code recommended)
- Cloudflare account (free tier sufficient)

## 1. Clone and Install

```bash
cd /home/neil/dev/voygent-v3
npm install

# Install Wrangler globally if not already installed
npm install -g wrangler
```

**Dependencies** (`package.json` will include):
- `wrangler` - Cloudflare CLI for local dev and deployment
- `@cloudflare/workers-types` - TypeScript types for Cloudflare Workers
- `hono` - Lightweight web framework
- `vitest` - Unit testing
- `playwright` - E2E testing

## 2. Configure Environment

Create `.env` file with API keys (see `~/Documents/.env` for actual keys):

```bash
# .env (DO NOT commit to Git)
AMADEUS_API_KEY=your_key_here
AMADEUS_API_SECRET=your_secret_here
VIATOR_API_KEY=your_key_here
SERPER_API_KEY=your_key_here
ZAI_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here
```

**Note**: Keys are stored in `~/Documents/.env` per CLAUDE.md instructions.

## 3. Create D1 Database

```bash
# Create development database
wrangler d1 create voygent-v3-dev

# Note the database ID from output, add to wrangler.toml
```

Update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "voygent-v3-dev"
database_id = "YOUR_DATABASE_ID_HERE"
```

## 4. Run Database Migrations

```bash
# Apply migrations
wrangler d1 migrations apply voygent-v3-dev --local

# Seed templates
wrangler d1 execute voygent-v3-dev --file=db/seeds/0001_seed_templates.sql --local
```

## 5. Start Local Development Server

```bash
# Start Wrangler dev server (watches for changes)
wrangler pages dev public --binding DB=voygent-v3-dev

# Server runs at http://localhost:8788
```

**What this does**:
- Serves `public/` directory as static files
- Routes `functions/api/**` as API endpoints
- Hot-reloads on file changes
- Binds D1 database as `env.DB`

## 6. Verify Installation

**Test homepage**:
```bash
curl http://localhost:8788/
# Should return index.html with theme selection cards
```

**Test templates API**:
```bash
curl http://localhost:8788/api/templates
# Should return featured templates list
```

**Test trip creation**:
```bash
curl -X POST http://localhost:8788/api/trips \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "heritage-001",
    "initial_message": "Sullivan family from Cork, Ireland",
    "preferences": {
      "duration": "7-10 days",
      "travelers_adults": 2,
      "luxury_level": "Comfort",
      "departure_airport": "JFK"
    }
  }'

# Should return trip_id and status="researching"
```

## 7. Development Workflow

**Frontend changes** (`public/*.html`, `public/js/*.js`, `public/css/*.css`):
- Edit files → Save → Browser auto-refreshes

**Backend changes** (`functions/**/*.ts`):
- Edit files → Save → Wrangler automatically rebuilds

**Database schema changes**:
```bash
# Create new migration
wrangler d1 migrations create voygent-v3-dev "add_field_name"

# Edit generated migration file in db/migrations/

# Apply migration
wrangler d1 migrations apply voygent-v3-dev --local
```

## 8. Running Tests

**Unit tests** (Vitest):
```bash
npm run test
# Or watch mode:
npm run test:watch
```

**E2E tests** (Playwright):
```bash
# First time: install browsers
npx playwright install

# Run E2E tests
npm run test:e2e

# Run specific test
npx playwright test tests/e2e/chat-flow.spec.ts
```

**Manual testing checklist**:
1. Open http://localhost:8788
2. Click "Heritage & Ancestry" theme
3. Enter "Sullivan family from Cork, Ireland"
4. Verify AI researches and presents 2-4 destinations
5. Confirm destinations in chat
6. Verify trip options appear with pricing
7. Select trip option
8. View detailed itinerary
9. Test mobile responsiveness (DevTools mobile view)

## 9. Debugging

**View Wrangler logs**:
```bash
wrangler pages dev public --binding DB=voygent-v3-dev --log-level debug
```

**Inspect D1 database**:
```bash
# Query database directly
wrangler d1 execute voygent-v3-dev --command "SELECT * FROM trip_templates" --local

# Open SQLite console
wrangler d1 execute voygent-v3-dev --local
```

**Check AI provider costs** (admin telemetry):
```bash
curl http://localhost:8788/api/trips/{trip_id}/logs \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Shows full telemetry including costs, tokens, timing
```

## 10. Common Issues

**"Database not found"**:
- Run `wrangler d1 migrations apply voygent-v3-dev --local`
- Check `database_id` in `wrangler.toml` matches output from `wrangler d1 create`

**"Template not found"**:
- Run seed script: `wrangler d1 execute voygent-v3-dev --file=db/seeds/0001_seed_templates.sql --local`

**"API key invalid"**:
- Check `.env` file exists and has valid keys
- Reference `~/Documents/.env` for actual keys
- Restart Wrangler dev server after changing `.env`

**TypeScript errors**:
- Run `npm install` to ensure `@cloudflare/workers-types` is installed
- Check `tsconfig.json` has correct `types` configuration

**Port 8788 already in use**:
```bash
# Kill existing Wrangler process
pkill -f wrangler

# Or use different port
wrangler pages dev public --binding DB=voygent-v3-dev --port 8789
```

## 11. Deployment (Future)

**Production deployment** (when ready):
```bash
# Create production database
wrangler d1 create voygent-themed

# Apply migrations to production
wrangler d1 migrations apply voygent-themed

# Seed templates in production
wrangler d1 execute voygent-themed --file=db/seeds/0001_seed_templates.sql

# Deploy to Cloudflare Pages
wrangler pages deploy public

# Configure environment variables in Cloudflare dashboard
# (API keys should NOT be in wrangler.toml)
```

---

## Next Steps

1. Implement Phase 1 (User Story 1): Destination Research and Confirmation
   - Build `/api/trips` endpoint
   - Build `/api/trips/:id/chat` endpoint with web search integration
   - Build frontend chat interface (`public/chat.html`, `public/js/chat.js`)

2. Implement User Story 2: Preferences Panel
   - Build `public/js/preferences.js`
   - Integrate preferences with chat flow

3. Test MVP (User Stories 1 + 2) end-to-end

4. Implement Phase 2 (User Story 3): Trip Building
   - Integrate Amadeus APIs
   - Integrate Viator API
   - Build trip options generation

For detailed task breakdown, see `tasks.md` (generated via `/speckit.tasks`)
