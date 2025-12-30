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

### Recently Completed (This Session)

1. **Dynamic Amadeus Location API with D1 Caching** - Airport/city codes now fetched dynamically:
   - `db/migrations/0004_create_location_cache.sql`: New table for caching location lookups
   - `functions/services/amadeus-client.ts`: Added `searchLocation()` method for Amadeus Location API
   - Implements cache-first strategy: check D1 cache → API call if miss → store result
   - Supports both AIRPORT and CITY lookups with fallback between them
   - Eliminates hardcoded airport codes - works for any destination worldwide

2. **AI Prompt Destination Constraints** - Fixed AI hallucinating wrong destinations:
   - **Problem**: AI was generating German/Austrian cities for Scotland trips
   - **Root cause**: Template `options_prompt` didn't include `{destinations}` placeholder
   - `functions/services/trip-builder-service.ts`: Added explicit destination list and constraints to prompt:
     - `CONFIRMED DESTINATIONS (You MUST use these exact locations):`
     - `CRITICAL REQUIREMENTS:` with rules to only use confirmed destinations
   - Telemetry now logs destinations passed to AI for debugging

3. **Enhanced Trip Options Display** - Better UI for comparing options:
   - `public/js/chat.js`: Updated `createTripOptionCard()` function
   - Shows route header (e.g., "Inverness → Dingwall → Stornoway")
   - Hotel names with city, nights, and star ratings (★★★★)
   - Tour names with city, duration, and price
   - `public/css/chat.css`: New styles for option items

4. **Fixed Infinite Polling Loop** - Option selection now works:
   - **Problem**: Clicking "Select This Option" caused infinite polling
   - **Root cause**: `option_selected` status wasn't handled in `loadTripState()`
   - `public/js/chat.js`: Added handler for `option_selected` status, stops polling
   - Added `showHandoffOption()` function to display handoff UI after selection

5. **Allow Option Re-selection** - Users can change their mind:
   - **Problem**: "Trip option already selected" error when choosing different option
   - `functions/lib/phase-gate.ts`: Removed blocking check in `checkOptionSelectionEligibility()`
   - Users can now re-select options until handoff is complete

### Previously Completed

1. **Phase 2 Trip Building Fixed** - The "Build Trip" button now works end-to-end
2. **Viator API Integration** - Added Viator sandbox API key for tours
3. **Graceful API Client Fallback** - Amadeus/Viator clients optional
4. **AI-Powered Context Extraction** - Template placeholders extracted using AI
5. **Geographic Region Enforcement** - Destinations respect user's specified region
6. **Debug Telemetry Panel** - Shows AI calls, costs, tokens in sidebar
7. **Clickable Source Links** - Research sources are hyperlinks
8. **Intake Form Fields Fix** - Dynamic fields populate correctly

### Deployment
- **Preview URL**: https://002-end-to-end.voygent-v3.pages.dev (branch preview)
- **Production**: https://voygent.app (main branch - needs merge)
- **Deploy command**: `CLOUDFLARE_API_TOKEN=tBembNqogoxi6cIyJxQB82n4nSKlXhFu4cccmIOF npx wrangler pages deploy public --branch=002-end-to-end`

### Known Working (Full E2E Flow)
- Template selection and intake form
- AI context extraction for template placeholders
- Region-constrained destination synthesis
- Research summary with clickable source links
- Destination confirmation and Phase 2 trigger
- Trip options generation with correct destinations
- Enhanced options display (hotels with ratings, tours with prices)
- Option selection and re-selection
- Telemetry panel showing all API calls and costs

### Suggested Improvements (Priority Order)

#### High Priority - Core Flow
1. **Test handoff flow** - Verify `/api/trips/:id/handoff` endpoint works
2. **Real Amadeus/Viator data** - Currently using sandbox/test APIs; test with production keys
3. **Apply location_cache migration to production** - Run `npm run db:migrate:prod`
4. **Merge to main** - Deploy to production once stable

#### Medium Priority - UX Improvements
5. **Add loading states during Phase 2** - Show skeleton cards while options generate
6. **Improve error handling UI** - Show user-friendly errors instead of "Trip building failed"
7. **Add "Edit Destinations" option** - Let users modify destinations before building
8. **Show actual booking links** - Hotels/tours should link to real booking pages when available
9. **Add trip summary/export** - PDF or email summary of selected trip option
10. **Mobile responsive design** - Current UI needs mobile optimization

#### Lower Priority - Features
11. **User accounts** - Save trips, preferences, search history
12. **Multi-traveler support** - Share trip with travel companions
13. **Price alerts** - Notify when flight/hotel prices change
14. **Calendar integration** - Export itinerary to Google/Apple Calendar
15. **Chat continuation** - Allow follow-up questions about trip options

### Known Issues
- Duplicate Heritage template exists (heritage-001 and heritage-ancestry-001) - clean up in seeds
- Production (main branch) doesn't have latest changes - need to merge 002-end-to-end
- Amadeus test API may have limited data for some destinations
- Viator sandbox returns limited tour results
