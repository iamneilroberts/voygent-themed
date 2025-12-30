# Implementation Plan: VoyGent V3 Template-Driven Trip Planner

**Branch**: `001-voygent-v3-template` | **Date**: 2025-10-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/neil/dev/voygent-v3/specs/001-voygent-v3-template/spec.md`

## Summary

Build VoyGent V3 with template-driven architecture and two-phase conversational workflow. Users select trip themes, AI researches destinations via web search and presents recommendations in chat, user confirms destinations, then system calls booking APIs (Amadeus, Viator) to build 2-4 detailed trip options with real pricing. Key innovation: separate research phase prevents wasted API costs and improves user experience. All trip logic stored in database templates—zero hardcoded theme logic. Chat interface with expanded preferences panel, admin telemetry separate from user-facing progress, mobile-responsive design.

Primary technical approach: Cloudflare Pages + Functions (serverless TypeScript), D1 SQLite database, vanilla HTML/CSS/JS frontend, AI provider fallback chain (Z.AI → OpenRouter → backup), REST API with phase gate enforcement.

## Technical Context

**Language/Version**: TypeScript 5.x (Cloudflare Functions runtime), ES2022+ for frontend JavaScript
**Primary Dependencies**:
- Backend: `@cloudflare/workers-types`, `hono` (lightweight web framework for Cloudflare Workers)
- Frontend: No framework dependencies (vanilla JS), CSS Grid/Flexbox for layout
- External APIs: Amadeus SDK, Viator API client, Serper/Tavily search SDK, Z.AI/OpenRouter LLM clients

**Storage**: Cloudflare D1 (SQLite) - `voygent-themed` database (production), `voygent-v3-dev` (development)

**Testing**: Vitest for backend unit tests, Playwright for end-to-end tests (chat flows, mobile responsive), manual testing for AI quality

**Target Platform**: Cloudflare Pages (global edge deployment), supports modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+), mobile browsers iOS 13+ / Android 9+

**Project Type**: Web application (frontend + backend functions on same Cloudflare Pages deployment)

**Performance Goals**:
- Phase 1 research: <5 seconds from user input to destination recommendations
- Phase 2 trip building: <2 minutes from confirmation to trip options ready
- Chat response: <500ms for user input processing, streaming AI responses
- Mobile: 60fps scrolling, <3s initial page load on 4G

**Constraints**:
- AI cost: <$0.50 average per trip (enforced via provider selection and token limits)
- API rate limits: Amadeus 10 req/s, Viator 5 req/s (implement request queuing)
- D1 database: 100k rows per table (sufficient for 10k+ trips), 5GB storage limit
- Cloudflare Functions: 50ms CPU time per request (use async/await for I/O, offload heavy computation to AI)
- Mobile: 16px minimum font size, 44x44px minimum touch targets, no horizontal scroll

**Scale/Scope**:
- Initial launch: 100 concurrent users, 1k trips/month
- 6-month target: 1k concurrent users, 10k trips/month
- Database: 2 tables (trip_templates ~10-20 rows, themed_trips growing)
- Frontend: ~10 HTML pages/components, ~15 JS modules
- Backend: ~20 API endpoints, ~30 service modules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Constitution Compliance Status: ✅ PASS (All Principles Satisfied)

| Principle | Requirement | Plan Compliance | Evidence |
|-----------|-------------|-----------------|----------|
| **I. Template-Driven Architecture** | ALL trip logic in database templates, NO hardcoded theme logic | ✅ COMPLIANT | `trip_templates` table stores all prompts (research_query_template, destination_criteria_prompt, options_prompt) and constraints. Code reads from templates at runtime. FR-031, FR-032, FR-033 enforce template loading. |
| **II. Two-Phase Workflow** | Phase 1 research (web search only) → user confirms → Phase 2 trip building (booking APIs) | ✅ COMPLIANT | Status field tracking ('researching' → 'awaiting_confirmation' → 'building_trip'). FR-010 prohibits booking APIs in Phase 1. FR-011 validates `destinations_confirmed = true` before Phase 2. Phase gate enforced in API middleware. |
| **III. Chat-Based Interface** | Conversational chat (not forms), rich content, expanded preferences panel | ✅ COMPLIANT | Full-page chat interface (FR-019), preferences panel expanded by default (FR-020), natural language input/output, AI streaming responses. No form-based trip submission. |
| **IV. Two-Tier Progress Feedback** | User-facing: friendly messages (no tech details). Admin: full telemetry (models, costs, tokens) | ✅ COMPLIANT | User progress messages (FR-022) show "Researching...", "Finding flights..." without model names/costs. Admin telemetry (FR-023) behind `user.role='admin'` AND `diagnostics_enabled=true` with full technical details. Logging service routes to correct tier. |
| **V. API Cost Optimization** | AI provider fallback (cheapest first), <$0.50 target per trip, cost tracking | ✅ COMPLIANT | Provider selection chain: Z.AI llama-3.3-70b (cheapest) → OpenRouter → fallback. Cost logged per API call, tracked in `ai_cost_usd` field (admin telemetry). Success criteria SC-004 measures <$0.50 average. Token limits prevent runaway costs. |
| **VI. Mobile-First Responsive** | All UI works on mobile (320px-768px), touch-friendly, readable text | ✅ COMPLIANT | CSS media queries for mobile breakpoints, 16px base font, 44x44px touch targets (FR-020, User Story 5). Testing on 5 mobile devices (SC-006). Flexbox/Grid layout stacks vertically on mobile. |

### Technical Stack Compliance: ✅ PASS (Constitution-Mandated Stack)

| Stack Component | Constitution Requirement | Plan Implementation | Status |
|-----------------|-------------------------|---------------------|--------|
| **Platform** | Cloudflare Pages + Functions (serverless TypeScript) | Cloudflare Pages deployment, TypeScript 5.x in Functions | ✅ |
| **Database** | D1 (SQLite) | D1 database: `voygent-themed` (prod), `voygent-v3-dev` (dev) | ✅ |
| **Frontend** | Vanilla HTML/CSS/JavaScript (NO React, Vue) | Vanilla JS (ES2022+), CSS Grid/Flexbox, no frameworks | ✅ |
| **Backend** | TypeScript in Cloudflare Functions | TypeScript 5.x with Hono web framework (Cloudflare-optimized) | ✅ |
| **APIs** | Amadeus (flights/hotels), Viator (tours), Serper/Tavily (search) | Amadeus SDK, Viator API client, Serper/Tavily search | ✅ |

### Database Schema Compliance: ✅ PASS (Required Fields Present)

| Required Field (Constitution §2.2) | Table | Purpose | Spec Reference |
|------------------------------------|-------|---------|----------------|
| `chat_history` (JSON) | `themed_trips` | Full conversation log | FR-025 |
| `research_destinations` (JSON) | `themed_trips` | Phase 1 research results | FR-009 |
| `destinations_confirmed` (boolean) | `themed_trips` | Phase gate | FR-011 |
| `confirmed_destinations` (JSON) | `themed_trips` | User-confirmed list | FR-009 |
| `status` (enum) | `themed_trips` | Current state tracking | FR-026 |

### Backend Endpoints Compliance: ✅ PASS (Required Endpoints Defined)

| Required Endpoint (Constitution §3.2) | Spec Reference | Purpose |
|---------------------------------------|----------------|---------|
| `POST /api/trips` | FR-001, User Story 1 | Start conversation, create trip |
| `POST /api/trips/:id/chat` | FR-002, FR-008 | Send user message, get AI response |
| `GET /api/trips/:id` | FR-028 | Get trip state (progress polling) |
| `GET /api/trips/:id/logs` | FR-023 | Stream logs (admin-only) |
| `POST /api/trips/:id/confirm-destinations` | FR-011 | User confirms → trigger Phase 2 |
| `POST /api/trips/:id/select` | FR-018 | User selects trip option |
| `POST /api/trips/:id/handoff` | FR-029, FR-030 | Generate agent handoff doc |

**Gate Result**: ✅ PASS - All constitutional requirements satisfied. No violations. Proceed to Phase 0 research.

## Project Structure

### Documentation (this feature)

```
specs/001-voygent-v3-template/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (technology best practices, patterns)
├── data-model.md        # Phase 1 output (database schema details)
├── quickstart.md        # Phase 1 output (local development setup)
├── contracts/           # Phase 1 output (API endpoint specifications)
│   ├── trips.yaml       # Trip management endpoints (POST /api/trips, etc.)
│   ├── chat.yaml        # Chat conversation endpoints
│   ├── templates.yaml   # Template retrieval endpoints
│   └── admin.yaml       # Admin telemetry endpoints
└── checklists/
    └── requirements.md  # Specification quality validation (completed)
```

### Source Code (repository root)

```
# Web application structure (Cloudflare Pages + Functions)

# Frontend (served by Cloudflare Pages)
public/
├── index.html                # Homepage with theme selection cards
├── chat.html                 # Trip planner chat interface
├── css/
│   ├── main.css             # Global styles, typography, layout
│   ├── chat.css             # Chat interface styles
│   ├── preferences.css      # Preferences panel styles
│   └── mobile.css           # Mobile-specific overrides (media queries)
├── js/
│   ├── main.js              # Homepage logic, theme selection
│   ├── chat.js              # Chat message handling, AI streaming responses
│   ├── preferences.js       # Preferences panel (duration, travelers, etc.)
│   ├── trip-builder.js      # Trip options display, itinerary rendering
│   ├── api-client.js        # Fetch wrapper for /api/* endpoints
│   └── utils.js             # Shared utilities (date formatting, etc.)
└── assets/
    ├── icons/               # Theme icons (heritage.svg, wine.svg, etc.)
    └── images/              # Destination placeholder images

# Backend (Cloudflare Functions)
functions/
├── api/
│   ├── trips/
│   │   ├── index.ts                    # POST /api/trips (create trip)
│   │   └── [id]/
│   │       ├── chat.ts                 # POST /api/trips/:id/chat
│   │       ├── index.ts                # GET /api/trips/:id (get state)
│   │       ├── confirm-destinations.ts # POST /api/trips/:id/confirm-destinations
│   │       ├── select.ts               # POST /api/trips/:id/select
│   │       ├── handoff.ts              # POST /api/trips/:id/handoff
│   │       └── logs.ts                 # GET /api/trips/:id/logs (admin only)
│   └── templates/
│       ├── index.ts                    # GET /api/templates (list featured)
│       └── [id].ts                     # GET /api/templates/:id
├── lib/
│   ├── db.ts                # D1 database client, query builders
│   ├── ai-providers.ts      # AI provider selection (Z.AI, OpenRouter, fallback chain)
│   ├── logger.ts            # Logging service (user-facing vs admin telemetry routing)
│   ├── template-engine.ts   # Template field interpolation ({surname}, {region}, etc.)
│   ├── phase-gate.ts        # Phase transition validation (destinations_confirmed check)
│   └── cost-tracker.ts      # AI/API cost accumulation per trip
├── services/
│   ├── research-service.ts  # Phase 1: web search, destination synthesis
│   ├── trip-builder-service.ts # Phase 2: flight/hotel/tour search, itinerary generation
│   ├── amadeus-client.ts    # Amadeus API integration (flights, hotels)
│   ├── viator-client.ts     # Viator API integration (tours, activities)
│   └── search-client.ts     # Serper/Tavily web search integration
└── middleware/
    ├── auth.ts              # Admin role check (for /logs endpoint)
    ├── cors.ts              # CORS headers for API responses
    └── error-handler.ts     # Global error handling, friendly user messages

# Database migrations
db/
├── migrations/
│   ├── 0001_init_trip_templates.sql     # Create trip_templates table
│   └── 0002_init_themed_trips.sql       # Create themed_trips table
└── seeds/
    └── 0001_seed_templates.sql          # Insert 5 featured themes + "Plan My Trip"

# Configuration
wrangler.toml                # Cloudflare Pages config (D1 bindings, env vars)
tsconfig.json                # TypeScript compiler config
package.json                 # Dependencies, scripts
.env.example                 # Example environment variables (API keys)
```

**Structure Decision**: Web application structure chosen (Option 2 from template) because VoyGent V3 has distinct frontend (static HTML/JS) and backend (TypeScript Cloudflare Functions) concerns. Frontend is served by Cloudflare Pages CDN, backend runs as serverless Functions. No monorepo needed (no iOS/Android apps). Single deployment target (Cloudflare Pages) hosts both frontend and backend.

**Key Structure Notes**:
- **No `src/` directory**: Cloudflare Pages expects `public/` for frontend and `functions/` for backend at repo root
- **Functions routing**: Cloudflare auto-routes `functions/api/trips/index.ts` to `POST /api/trips`, `functions/api/trips/[id]/chat.ts` to `POST /api/trips/:id/chat`
- **No separate `backend/` and `frontend/` directories**: Cloudflare Pages convention is flat structure with `public/` and `functions/` peers
- **Database migrations**: Managed via `wrangler d1 migrations` command, applied before deployment
- **No test directories yet**: Tests will be added in Phase 2 (tasks generation) per user story priorities

## Complexity Tracking

*No constitution violations detected. This section is empty per template instructions ("Fill ONLY if Constitution Check has violations that must be justified").*

---

**Phase 0 (Research) and Phase 1 (Design) outputs will be generated next as separate files in this directory.**
