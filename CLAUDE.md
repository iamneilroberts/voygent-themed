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

1. **AI-Powered Context Extraction** - Template placeholders are now extracted using AI:
   - `functions/lib/template-engine.ts`: Added `extractPlaceholders()` and `buildContextExtractionPrompt()`
   - `functions/services/research-service.ts`: Added `extractContextWithAI()` method
   - Each template's placeholders (e.g., `{surname}`, `{region}`, `{show_name}`) are identified and AI extracts values from user input
   - Logged as `context_extraction` telemetry event

2. **Geographic Region Enforcement** - Destination synthesis now respects user's specified region:
   - Added `CRITICAL GEOGRAPHIC CONSTRAINT` to synthesis prompt when region is extracted
   - Prevents AI from suggesting US locations when user asks about Ireland, etc.
   - System prompt dynamically includes region focus

3. **Debug Telemetry Panel** - Replaced sidebar destinations panel with telemetry:
   - `public/chat.html`: New telemetry panel structure
   - `public/js/chat.js`: Functions `displayTelemetryLogs()`, `formatTelemetryDetails()`, `addTelemetryEntry()`
   - `public/css/chat.css`: Color-coded telemetry entries by event type
   - Shows: AI calls, search queries, context extraction, costs, tokens
   - Events: `search_queries`, `search_results`, `context_extraction`, `destination_synthesis`, `chat_response`

4. **Clickable Source Links** - Research summary sources are now hyperlinks:
   - `public/js/chat.js`: Updated `displayResearchSummary()` to use markdown links
   - `formatMessageContent()` now converts `[text](url)` to HTML `<a>` tags

5. **Intake Form Fields Fix** - Trip Details section now populates correctly:
   - `functions/api/templates/index.ts`: Added `required_fields`, `optional_fields`, `search_help_text` to response
   - `public/js/intake-form.js`: Fixed `parseFields()` to handle both arrays and JSON strings
   - Shows: Trip Duration, Departure Airport, and optional fields (travelers, budget, activity level, dates)

6. **Enhanced Error Logging** - Better debugging for confirm destinations:
   - `functions/api/trips/[id]/confirm-destinations.ts`: Detailed error messages with stack traces
   - Logs to telemetry on errors

7. **Chat Telemetry** - All AI calls in chat handler now log telemetry:
   - `functions/api/trips/[id]/chat.ts`: Added telemetry for destination questions and general chat

### Deployment
- **Preview URL**: https://002-end-to-end.voygent-v3.pages.dev (branch preview)
- **Production**: https://voygent.app (main branch - needs merge)
- **Deploy command**: `CLOUDFLARE_API_TOKEN=tBembNqogoxi6cIyJxQB82n4nSKlXhFu4cccmIOF npx wrangler pages deploy public --branch=002-end-to-end`

### Known Working
- Intake form modal with dynamic fields
- AI context extraction for template placeholders
- Region-constrained destination synthesis (Ireland, not US counties)
- Telemetry panel showing API calls and costs
- Clickable source links in research summary

### Next Tasks (Priority Order)
1. **Test "Build Trip" button** - Currently fails with error, needs debugging
   - Error happens in `confirm-destinations.ts` - check validation logic
   - May be mismatch between `research_destinations` names and `confirmed_destinations`
2. **End-to-end flow test** - Complete a full trip from intake to destination confirmation
3. **Phase 2 trip building** - Test Amadeus/Viator integration after destination confirmation
4. **Merge to main** - Once stable, merge 002-end-to-end branch to main for production

### Known Issues
- **Build Trip Error**: "Failed to confirm destinations" - needs investigation
  - Validation at line 62-77 in confirm-destinations.ts checks destination names match
  - Frontend sends `research_destinations.map(d => d.name)` as confirmed destinations
  - Better error logging added - check telemetry for `confirm_error` event
- Duplicate Heritage template exists (heritage-001 and heritage-ancestry-001) - clean up in seeds
- Production (main branch) doesn't have latest changes - need to merge 002-end-to-end
