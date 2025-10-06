# Implementation Plan: Web Search Integration with Genealogy Context & Provider APIs

**Branch**: `001-web-search-integration` | **Date**: 2025-10-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-web-search-integration/spec.md`

## Execution Flow (/plan command scope)
```
1. ✓ Load feature spec from Input path
2. ✓ Fill Technical Context (no NEEDS CLARIFICATION - all resolved)
3. ✓ Fill Constitution Check section
4. ✓ Evaluate Constitution Check - PASS (aligns with critical path)
5. → Execute Phase 0 → research.md
6. → Execute Phase 1 → contracts, data-model.md, quickstart.md
7. → Re-evaluate Constitution Check
8. → Plan Phase 2 approach
9. STOP - Ready for /tasks command
```

## Summary
Enhance the Family Heritage trip planning flow with genealogy document parsing, web search for ancestral context, hotel/flight API integration (Amadeus primary, Kiwi/Serper fallbacks), cost estimation with commission headroom, and professional handoff JSON. Critical path: Intake → Options(≤4) → Select → A/B → Cost Estimate → Save Trip ID.

## Technical Context
**Language/Version**: TypeScript (Cloudflare Workers runtime)
**Primary Dependencies**: Cloudflare Functions, D1 (SQLite), Amadeus Self-Service APIs, Kiwi Tequila API, Serper.dev, Tavily Search, Google Places
**Storage**: Cloudflare D1 (tables: heritage_trips, heritage_messages, cache_providers)
**Testing**: Manual contract tests (curl), integration tests via smoke test script
**Target Platform**: Cloudflare Pages + Functions (edge runtime)
**Project Type**: Web application (frontend: /public, backend: /functions/api)
**Performance Goals**: <10s per provider call, <30s total trip generation
**Constraints**: No eval() (edge runtime), 24h cache TTL (flights/hotels), 7-day TTL (search), 10-15% commission headroom
**Scale/Scope**: MVP - single user flow, 4 trip options max, 2-3 hotels per city, 10 search results max

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Check (Pre-Phase 0)

**Critical Path Alignment**:
- ✅ Ships core flow: Intake → Options(≤4) → Select → A/B → Cost Estimate → Save Trip ID
- ✅ Genealogy parsing enhances intake (on critical path)
- ✅ Hotel/flight enrichment improves A/B variants (on critical path)
- ✅ Cost estimation required for Save Trip ID (on critical path)

**Cheap-First Policy**:
- ✅ Uses gpt-4o-mini or claude-3-haiku for intake/options (<600 tokens)
- ✅ Switches to SMART models only for complex expansion (≥600 tokens)
- ✅ Caching reduces provider API calls (24h/7d TTL)

**No Inventory Claims**:
- ✅ Hotel examples labeled "availability not guaranteed"
- ✅ Airfare shown as ranges, not exact prices
- ✅ Cost estimates include "final quote by travel pro" disclaimer
- ✅ Uses "budget bands" and "typical" language

**Reproducibility**:
- ✅ Same build locally (wrangler dev) and prod (Pages deploy)
- ✅ D1 schema migrations (001_init.sql, 002_heritage_tables.sql)
- ✅ Environment parity (.dev.vars for local, secrets for prod)

**Status**: ✅ PASS - All constitutional principles satisfied

---

### Post-Phase 1 Re-Check

**Critical Path Alignment** (verified against data-model.md + contracts/):
- ✅ All entities support critical path flow (see data-model.md "Critical Path Alignment" section)
- ✅ Genealogy Context enriches Intake (FR-001 to FR-008)
- ✅ Hotel Listing + Flight Offer enrich A/B variants (FR-009 to FR-018, FR-023 to FR-024)
- ✅ Cost Estimate required before Save Trip ID (FR-025 to FR-028)
- ✅ Pro Handoff generated after Save (FR-031 to FR-034, not blocking critical path)
- ✅ Provider Cache speeds all calls but doesn't block flow (FR-013, FR-014, FR-021)

**Cheap-First Policy** (verified against endpoints):
- ✅ Provider API calls use external services, not LLM (Amadeus, Kiwi, Serper, Tavily)
- ✅ Cost estimation is local math calculation, no LLM needed (estimate-cost.openapi.yml)
- ✅ Only genealogy parsing and enrichment prompts use LLM (will use CHEAP models)
- ✅ Cache prevents repeated API calls (24h for flights/hotels, 7d for search)

**No Inventory Claims** (verified against contracts/):
- ✅ Hotel Listing schema includes required `availability_disclaimer` field (providers-hotels.openapi.yml)
- ✅ Flight Offer uses price ranges [low, median, high], not exact prices (providers-flights.openapi.yml)
- ✅ Cost Estimate schema includes required `disclaimer` field: "final quote by travel professional" (estimate-cost.openapi.yml)
- ✅ All example responses use disclaimer language (quickstart.md)
- ✅ Data model validation rules enforce disclaimers (data-model.md)

**Reproducibility** (verified against project structure):
- ✅ New migration file: 003_cache_providers.sql (deterministic schema)
- ✅ All provider API clients configurable via ~/Documents/.env (quickstart.md)
- ✅ Same endpoints work locally (localhost:8788) and prod (Pages URL)
- ✅ Contracts define exact request/response formats (4 OpenAPI specs in /contracts/)
- ✅ No environment-specific logic in design

**New Risks Identified**:
- ⚠️ External API dependencies (Amadeus, Kiwi, Serper, Tavily) could fail → Mitigated by fallback providers
- ⚠️ 10s timeout threshold could be tight for chained calls → Mitigated by caching
- ⚠️ Commission calculation (10-15%) must be transparent → Enforced in Cost Estimate schema

**Status**: ✅ PASS - All constitutional principles satisfied after Phase 1 design

**Design Quality**:
- ✅ 9 entities fully documented with validation rules
- ✅ 4 OpenAPI contracts with error handling and examples
- ✅ Quickstart with 8 integration test scenarios + cache verification
- ✅ All 40 functional requirements mapped to endpoints and entities
- ✅ Cross-entity constraints documented (data-model.md)

**Ready for Phase 2**: ✅ Yes - Proceed to task generation

## Project Structure

### Documentation (this feature)
```
specs/001-web-search-integration/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── providers-flights.openapi.yml
│   ├── providers-hotels.openapi.yml
│   ├── providers-search.openapi.yml
│   └── estimate-cost.openapi.yml
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
functions/
├── api/
│   ├── lib/
│   │   ├── provider.ts          # Existing: LLM provider routing
│   │   ├── schemas.ts           # Existing: Manual validation
│   │   ├── prompts.ts           # Existing: System prompts
│   │   ├── ocr.ts              # Existing: Placeholder OCR
│   │   ├── db.ts               # Existing: D1 helpers
│   │   ├── genealogy.ts        # NEW: Genealogy parsing
│   │   ├── search.ts           # NEW: Web search (Serper/Tavily)
│   │   ├── amadeus.ts          # NEW: Amadeus API client
│   │   ├── kiwi.ts             # NEW: Kiwi Tequila client
│   │   ├── cache.ts            # NEW: D1 cache layer
│   │   └── cost-estimator.ts   # NEW: Cost calculation logic
│   ├── trips/
│   │   ├── index.ts            # MODIFY: Add genealogy parsing
│   │   └── [id]/
│   │       ├── index.ts        # Existing: GET/PATCH
│   │       ├── select.ts       # MODIFY: Add hotel enrichment
│   │       └── ab.ts           # MODIFY: Add flight/cost data
│   ├── providers/
│   │   ├── flights.ts          # NEW: GET /providers/flights
│   │   ├── hotels.ts           # NEW: GET /providers/hotels
│   │   └── search.ts           # NEW: GET /providers/search
│   ├── estimate/
│   │   └── cost.ts             # NEW: POST /api/estimate/cost
│   └── handoff/
│       └── [id].ts             # NEW: GET /api/handoff/:id (pro JSON)
└── _middleware.ts              # Existing: CORS

public/
├── index.html                  # MODIFY: Add hotel selection UI, cost display
└── app.js                      # MODIFY: Add hotel tracking, cost fetch

prompts/
├── genealogy.intake.enricher.txt      # NEW
├── hotels.options.enricher.txt        # NEW (already drafted)
├── flights.airfare.estimator.txt      # NEW
├── cost.estimator.txt                 # NEW
├── search.general.query.txt           # NEW
├── search.general.summarizer.txt      # NEW
└── heritage.quote.handoff.txt         # MODIFY: Add hotels/airfare

migrations/
└── 003_cache_providers.sql    # NEW: cache_providers table

schemas/
├── cost-estimate.v1.json      # NEW
├── hotel-listing.v1.json      # NEW
└── flight-offer.v1.json       # NEW
```

**Structure Decision**: Web application - Cloudflare Functions backend (/functions/api) with static frontend (/public). Existing structure extended with new provider endpoints, cache layer, and enrichment logic.

## Phase 0: Outline & Research

**Research Tasks**:
1. Amadeus Self-Service API authentication & rate limits
2. Kiwi Tequila API flight search parameters & response format
3. Serper.dev Google Hotels search & result structure
4. Google Places API enrichment for hotel details
5. Tavily Search API fallback configuration
6. D1 cache patterns for 24h/7-day TTL enforcement
7. Genealogy URL parsing (Ancestry, FamilySearch, MyHeritage, WikiTree)
8. OCR alternatives for Cloudflare Workers (Cloudflare AI Workers vs. external)
9. Commission headroom calculation strategies (10-15% top-of-range)
10. Pro handoff JSON format requirements

**Output**: research.md with decisions, rationales, and alternatives for each technology choice

---

**Output**: research.md created ✓

---

## Phase 1: Design & Contracts

**Prerequisites**: research.md complete ✓

**Tasks**:
1. Extract entities from feature spec → data-model.md ✓
2. Generate API contracts from functional requirements → /contracts/ ✓
3. Create quickstart with curl examples → quickstart.md ✓
4. Re-evaluate Constitution Check ✓

**Output**: data-model.md, 4 OpenAPI contracts, quickstart.md ✓

---

## Phase 2: Implementation Planning

**Prerequisites**: Phase 0 + Phase 1 complete ✓

**Approach**:

The `/tasks` command will generate actionable tasks by analyzing:
- **Functional Requirements** (FR-001 to FR-040 from spec.md)
- **Data Model** (9 entities with validation rules)
- **API Contracts** (4 OpenAPI specs with request/response schemas)
- **Existing Codebase** (functions/api/, public/, prompts/, schemas/)

**Implementation Strategy**:

1. **Database Layer** (Foundation):
   - Create migration 003_cache_providers.sql
   - Add cache helper functions to lib/cache.ts
   - Test cache CRUD operations + TTL enforcement

2. **Provider Clients** (External APIs):
   - Implement lib/amadeus.ts (OAuth2 + flight/hotel search)
   - Implement lib/kiwi.ts (API key auth + flight search)
   - Implement lib/serper.ts (Serper.dev search wrapper)
   - Implement lib/tavily.ts (Tavily search wrapper)
   - Implement lib/google-places.ts (hotel enrichment)
   - Each client uses lib/cache.ts for 24h/7d caching

3. **Genealogy Extraction** (Critical Path):
   - Enhance lib/ocr.ts with Cloudflare AI Workers (@cf/meta/llama-ocr)
   - Create lib/genealogy.ts (URL parsing for FamilySearch, WikiTree)
   - Add prompts/genealogy.intake.enricher.txt
   - Modify functions/api/trips/index.ts to parse genealogy_url and genealogy_file

4. **Provider Endpoints** (New APIs):
   - Create functions/api/providers/flights.ts (maps to providers-flights.openapi.yml)
   - Create functions/api/providers/hotels.ts (maps to providers-hotels.openapi.yml)
   - Create functions/api/providers/search.ts (maps to providers-search.openapi.yml)
   - Each endpoint: validate params → check cache → call provider → store cache → return JSON

5. **Cost Estimation** (Business Logic):
   - Create lib/cost-estimator.ts (commission headroom calculation)
   - Create functions/api/estimate/cost.ts (maps to estimate-cost.openapi.yml)
   - Add prompts/cost.estimator.txt (optional LLM enrichment)
   - Store result in heritage_trips.variants_json.cost_estimate

6. **Trip Flow Enhancements** (Existing Endpoints):
   - Modify functions/api/trips/[id]/select.ts to call /providers/hotels after selection
   - Create functions/api/trips/[id]/ab.ts to generate A/B variants with /providers/flights
   - Add hotel selection tracking in PATCH /trips/[id]

7. **Pro Handoff** (Export):
   - Create functions/api/handoff/[id].ts (maps to Pro Handoff entity)
   - Aggregate data from heritage_trips record
   - Return JSON with Content-Disposition: attachment

8. **Frontend Updates** (UI):
   - Add hotel selection UI to public/index.html
   - Display cost estimate with disclaimer
   - Add cost estimate fetch in public/app.js

9. **Prompts & Schemas** (LLM Integration):
   - Create prompts/genealogy.intake.enricher.txt
   - Create prompts/hotels.options.enricher.txt (already drafted)
   - Create prompts/flights.airfare.estimator.txt
   - Create prompts/cost.estimator.txt
   - Create schemas/cost-estimate.v1.json
   - Create schemas/hotel-listing.v1.json
   - Create schemas/flight-offer.v1.json
   - Modify schemas/intake.v1.json (add ancestry_context, departure_airport, etc.)

10. **Testing & Deployment**:
    - Run integration tests from quickstart.md
    - Verify cache hit/miss behavior
    - Test fallback providers (simulate Amadeus failure)
    - Deploy to Cloudflare Pages
    - Smoke test production endpoints

**Dependency Order** (enforced in tasks.md):
1. Database → Caching → Provider Clients
2. Provider Clients → Provider Endpoints
3. Genealogy → Trip Intake Enhancement
4. Provider Endpoints → Cost Estimation
5. Cost Estimation → Pro Handoff
6. All backend → Frontend Updates

**Task Estimation**:
- Database + Caching: 3-5 tasks
- Provider Clients: 10-15 tasks (2-3 per provider)
- Genealogy: 5-7 tasks
- Provider Endpoints: 6-9 tasks (2-3 per endpoint)
- Cost Estimation: 3-5 tasks
- Trip Flow: 4-6 tasks
- Pro Handoff: 2-3 tasks
- Frontend: 3-5 tasks
- Prompts & Schemas: 6-8 tasks
- Testing: 5-7 tasks

**Total**: ~50-70 actionable tasks (to be generated by /tasks command)

**Critical Path Tasks** (must complete first):
1. Database migration (003_cache_providers.sql)
2. Cache layer (lib/cache.ts)
3. Genealogy parsing (lib/genealogy.ts + lib/ocr.ts)
4. Trip intake enhancement (functions/api/trips/index.ts)
5. Provider clients (lib/amadeus.ts, lib/kiwi.ts, lib/serper.ts)
6. Cost estimator (lib/cost-estimator.ts)
7. Integration test (quickstart.md scenarios)

**Non-Critical Path** (can defer):
- Google Places enrichment (nice-to-have)
- Tavily fallback (Serper.dev sufficient for MVP)
- Pro handoff UI download button (can use curl)

---

## Execution Status

- [x] Phase 0: Research complete (research.md)
- [x] Phase 1: Design complete (data-model.md, contracts/, quickstart.md)
- [x] Constitution Check re-evaluated (PASS)
- [x] Phase 2: Implementation approach planned (above)
- [ ] Phase 2: Task generation (awaiting `/tasks` command)

**STOP**: Ready for `/tasks` command to generate tasks.md
