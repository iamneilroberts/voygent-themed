# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference Commands

```bash
# Development
npm run dev              # Start local dev server on port 8788
npm run build            # TypeScript compilation
npm run type-check       # Type check without emitting

# Database (local)
npm run db:migrate       # Apply migrations to local D1
npm run db:seed          # Seed templates to local D1

# Database (production - voygent-themed)
npm run db:migrate:prod  # Apply migrations to production
npm run db:seed:prod     # Seed templates to production

# Testing
npm test                 # Run unit tests (vitest)
npm run test:watch       # Run tests in watch mode
npm run test:e2e         # Run E2E tests (Playwright)
npm run test:e2e:headed  # E2E tests with browser visible
npm run test:e2e:ui      # E2E tests with Playwright UI
npm run test:e2e:debug   # Debug E2E tests

# Run specific E2E test
npx playwright test --grep "AS1"                    # By test name
npx playwright test tests/e2e/critical-path.spec.ts # By file
npx playwright test --project=desktop-chromium      # By viewport

# Deployment
npm run deploy           # Deploy to Cloudflare Pages
```

## Project Architecture

VoyGent V3 is a template-driven travel planning platform using a two-phase conversational workflow.

### Tech Stack
- **Platform**: Cloudflare Pages + Functions (port 8788)
- **Database**: D1 (SQLite) - `voygent-themed` for production
- **Frontend**: Vanilla HTML/CSS/JS in `public/`
- **Backend**: TypeScript in `functions/`
- **Framework**: Hono for API routing
- **Testing**: Vitest (unit), Playwright (E2E)

### Core Directory Structure
```
functions/
├── api/
│   ├── trips/          # Trip CRUD and conversation endpoints
│   │   ├── index.ts    # POST /api/trips - create trip
│   │   └── [id]/       # Trip-specific operations
│   │       ├── chat.ts            # POST - send message
│   │       ├── confirm-destinations.ts
│   │       ├── select.ts
│   │       └── handoff.ts
│   └── templates/      # Template CRUD
├── lib/
│   ├── db.ts           # DatabaseClient with typed queries
│   ├── ai-providers.ts # Z.AI/OpenRouter integration
│   ├── phase-gate.ts   # Enforces Phase 1→2 transition
│   ├── cost-tracker.ts # AI/API cost tracking
│   └── template-engine.ts
└── services/
    ├── research-service.ts   # Phase 1: web search
    ├── amadeus-client.ts     # Flights/hotels API
    ├── viator-client.ts      # Tours API
    └── trip-builder-service.ts

public/
├── index.html          # Homepage with template selection
├── chat.html           # Chat interface
├── css/
└── js/
    ├── chat.js         # Chat message handling
    └── api-client.js   # Frontend API wrapper

db/
├── migrations/         # D1 schema migrations
└── seeds/              # Template seed data

tests/
├── e2e/                # Playwright E2E tests
├── fixtures/           # Test fixtures and factories
└── helpers/            # Test utilities (api-client, polling)
```

### Two-Phase Workflow

**Phase 1 (Research)**: Web search only, no booking APIs
- Status: `researching` → `awaiting_confirmation`
- Uses Serper/Tavily for destination research
- AI synthesizes 2-4 destination recommendations

**Phase 2 (Trip Building)**: Only after user confirms destinations
- Status: `building_trip` → `options_ready`
- Calls Amadeus (flights/hotels) and Viator (tours)
- `phase-gate.ts` enforces this transition

### Key Database Tables

**`trip_templates`**: Defines all trip behavior via prompts
- `research_query_template`, `destination_criteria_prompt` (Phase 1)
- `intake_prompt`, `options_prompt` (Phase 2)
- Constraints: `trip_days_min/max`, `luxury_levels`, `activity_levels`

**`themed_trips`**: Stores conversation state
- `chat_history` (JSON), `status`, `progress_message`
- `research_destinations`, `destinations_confirmed`, `confirmed_destinations`
- `options_json`, `selected_option_index`

### API Endpoints

```
POST /api/trips                    # Create trip with initial message
GET  /api/trips/:id                # Get trip state (for polling)
POST /api/trips/:id/chat           # Send user message
POST /api/trips/:id/confirm-destinations
POST /api/trips/:id/select
POST /api/trips/:id/handoff
GET  /api/templates                # List active templates
GET  /api/templates/:id
```

### E2E Test Structure

Tests in `tests/e2e/critical-path.spec.ts` follow the user journey:
- AS1: Create trip with template selection
- AS2: View destination recommendations
- AS3: Confirm destinations with preferences
- AS4: Trip building completes
- AS5: View generated trip options
- AS6: Select trip option

Test fixtures use `fishery` for factories. Polling helpers handle async state transitions.

## Critical Design Rules

1. **Template-driven**: ALL trip logic comes from `trip_templates` table, zero hardcoded theme logic
2. **Phase gate**: Never call Amadeus/Viator until `destinations_confirmed = true`
3. **User-facing progress**: Friendly messages only, no model names/tokens/costs
4. **Admin telemetry**: Full technical logs only when `user.role = 'admin'`
5. **Preferences panel**: Must be expanded by default in UI

## Environment

API keys are configured in `wrangler.toml` for dev. Production uses Cloudflare Secrets.
Reference `/home/neil/Documents/.env` for API key values.

Dev database: `voygent-v3-dev` (ID in wrangler.toml)
Production database: `voygent-themed` (ID: 62077781-9458-4206-a5c6-f38dc419e599)

## Current Status (2024-12-29)

### Recently Completed
1. **Multiple Trip Templates** - Added 6 themed templates:
   - Heritage & Ancestry (🌳)
   - TV & Movie Locations (🎬)
   - Historical Sites (⚔️)
   - Culinary Experiences (🍽️)
   - Adventure & Outdoor (🏔️)
   - Romance & Honeymoon (💑)

2. **Enhanced Intake Form** - Modal-based form with:
   - Theme-specific main query textarea
   - Dynamic required/optional fields based on template configuration
   - Fields: duration, departure_airport, travelers, luxury_level, activity_level, departure_date, dietary_restrictions, occasion, interests, fitness_level, experience_level
   - Files: `public/index.html`, `public/js/intake-form.js`, `public/js/main.js`

3. **Research Summary Feature** - Shows AI research findings before destination recommendations:
   - Migration: `db/migrations/0003_add_research_summary.sql`
   - Backend: `functions/services/research-service.ts` generates summary from web searches
   - API: `functions/api/trips/[id]/index.ts` returns `research_summary` field
   - Frontend: `public/js/chat.js` displays summary with sources before destinations
   - Styled with distinct visual treatment in `public/css/chat.css`

### Deployment
- **Live at**: https://voygent.app (CNAME → voygent-v3.pages.dev)
- **Deploy command**: `CLOUDFLARE_API_TOKEN=<pages-token> npx wrangler pages deploy public`
- Database migrations applied to both local and production

### Next Tasks
1. **Test full user flow** - Create a trip through the new intake form, verify research summary displays correctly
2. **Geographic context improvements** - Currently relies on AI interpretation; consider adding explicit region/country field to intake form
3. **Chat history persistence** - Ensure chat messages are properly stored and restored on page reload
4. **Preferences panel sync** - Sync intake form preferences to the sidebar preferences panel in chat view
5. **Phase 2 trip building** - Test Amadeus/Viator integration after destination confirmation
6. **Error handling** - Add user-friendly error messages for API failures
7. **Mobile responsiveness** - Test and refine mobile layout for intake form modal

### Known Issues
- Duplicate Heritage template exists (heritage-001 and heritage-ancestry-001) - clean up in seeds
- Cloudflare API token for Pages needs specific permissions (use CLOUDFLARE_PAGES_API_TOKEN)
