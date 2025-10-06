# Tasks: Web Search Integration with Genealogy Context & Provider APIs

**Feature**: 001-web-search-integration | **Date**: 2025-10-05
**Input**: Design documents from `/home/neil/dev/lite-voygent-claude/specs/001-web-search-integration/`
**Prerequisites**: plan.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Execution Flow
```
1. ✓ Loaded plan.md → Tech stack: TypeScript, Cloudflare Workers, D1
2. ✓ Loaded data-model.md → 9 entities extracted
3. ✓ Loaded contracts/ → 4 OpenAPI specs (flights, hotels, search, cost)
4. ✓ Loaded quickstart.md → 8 integration test scenarios
5. ✓ Loaded research.md → 10 technology decisions
6. → Generate tasks by category (Setup → Tests → Core → Integration → Polish)
7. → Apply parallelization rules ([P] for independent files)
8. → Number sequentially (T001-T0XX)
9. → Validate completeness
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- File paths relative to repository root: `/home/neil/dev/lite-voygent-claude/`

---

## Phase 3.1: Setup & Database

### T001: Database Migration
- [ ] Create `migrations/003_cache_providers.sql`
- [ ] Define schema per data-model.md (cache_providers table with provider, query_hash, response_json, ttl_seconds, created_at)
- [ ] Add UNIQUE constraint on (provider, query_hash)
- [ ] Add INDEX idx_cache_lookup on (provider, query_hash, created_at)

### T002: Run Database Migration
- [ ] Execute migration locally: `wrangler d1 execute voygent-prod --local --file=migrations/003_cache_providers.sql`
- [ ] Execute migration remotely: `wrangler d1 execute voygent-prod --remote --file=migrations/003_cache_providers.sql`
- [ ] Verify table exists: `wrangler d1 execute voygent-prod --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name='cache_providers'"`

### T003 [P]: Create JSON Schemas
- [ ] Create `schemas/cost-estimate.v1.json` per Cost Estimate entity
- [ ] Include fields: airfare, hotels, tours, transport, total_per_person, commission_included, currency, disclaimer, estimate_date
- [ ] Validation: total_per_person[1] = Math.ceil(subtotal_high * commission_pct)

### T004 [P]: Create Flight Offer Schema
- [ ] Create `schemas/flight-offer.v1.json` per Flight Offer entity
- [ ] Include fields: route, origin_iata, destination_iata, price_low, price_median, price_high, carrier, provider, estimate_date, route_type
- [ ] Validation: price_low < price_median < price_high

### T005 [P]: Create Hotel Listing Schema
- [ ] Create `schemas/hotel-listing.v1.json` per Hotel Listing entity
- [ ] Include fields: hotel_id, name, city, nightly_price_low, nightly_price_high, star_rating, budget_tier, provider, booking_reference, availability_disclaimer
- [ ] Validation: nightly_price_low < nightly_price_high, availability_disclaimer required

### T006: Modify Intake Schema
- [ ] Update `schemas/intake.v1.json` to add ancestry_context object
- [ ] Add fields: departure_airport (string), transport_pref (enum), hotel_type (enum)
- [ ] Add ancestry_context fields: surnames[], origins[], migration_window, key_sites[], sources[], web_search_summary

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### T007 [P]: Contract Test - Flights Endpoint
- [ ] Create test file `tests/contract/test_providers_flights.ts` (or `.spec.ts` if using test framework)
- [ ] Test GET /providers/flights with valid IATA codes → expect 200 with flight offers
- [ ] Test invalid IATA code → expect 400 error
- [ ] Test missing required params → expect 400 error
- [ ] Verify response schema matches `providers-flights.openapi.yml`
- [ ] **Expected: Test FAILS (endpoint not implemented yet)**

### T008 [P]: Contract Test - Hotels Endpoint
- [ ] Create test file `tests/contract/test_providers_hotels.ts`
- [ ] Test GET /providers/hotels with valid city/date → expect 200 with 2-3 hotels
- [ ] Test invalid date format → expect 400 error
- [ ] Test no hotels found → expect 404 with fallback message
- [ ] Verify response schema matches `providers-hotels.openapi.yml`
- [ ] **Expected: Test FAILS (endpoint not implemented yet)**

### T009 [P]: Contract Test - Search Endpoint
- [ ] Create test file `tests/contract/test_providers_search.ts`
- [ ] Test GET /providers/search with valid query → expect 200 with results
- [ ] Test query too short → expect 400 error
- [ ] Test timeout (if possible to simulate) → expect 504 error
- [ ] Verify response schema matches `providers-search.openapi.yml`
- [ ] **Expected: Test FAILS (endpoint not implemented yet)**

### T010 [P]: Contract Test - Cost Estimation Endpoint
- [ ] Create test file `tests/contract/test_estimate_cost.ts`
- [ ] Test POST /estimate/cost with valid request → expect 200 with cost breakdown
- [ ] Test missing trip_id → expect 400 error
- [ ] Test invalid commission_pct (<10 or >15) → expect 400 error
- [ ] Verify commission calculation: total_per_person[1] = Math.ceil(subtotal_high * 1.15)
- [ ] Verify response schema matches `estimate-cost.openapi.yml`
- [ ] **Expected: Test FAILS (endpoint not implemented yet)**

### T011 [P]: Integration Test - Genealogy Upload Flow
- [ ] Create test file `tests/integration/test_genealogy_upload.ts`
- [ ] Test scenario from quickstart.md: Upload PDF → verify ancestry_context extracted
- [ ] Test FamilySearch URL parsing → verify surnames/places/dates extracted
- [ ] Test OCR failure → verify trip continues with manual data
- [ ] Test genealogy URL parsing returns no data → verify fallback to form fields
- [ ] **Expected: Test FAILS (genealogy parsing not implemented yet)**

### T012 [P]: Integration Test - Hotel Enrichment Flow
- [ ] Create test file `tests/integration/test_hotel_enrichment.ts`
- [ ] Test scenario: Select option → fetch hotels → verify 2-3 hotels per city
- [ ] Test budget tier matching → verify hotels match intake luxury preference
- [ ] Test Amadeus unavailable → verify fallback to Serper.dev
- [ ] **Expected: Test FAILS (hotel enrichment not implemented yet)**

### T013 [P]: Integration Test - Cost Estimation Flow
- [ ] Create test file `tests/integration/test_cost_estimation.ts`
- [ ] Test scenario: Generate A/B variants → run cost estimator → verify cost breakdown
- [ ] Test commission headroom: verify top of range has 10-15% added
- [ ] Test cost invalidation when dates change → verify message displayed
- [ ] **Expected: Test FAILS (cost estimation not implemented yet)**

### T014 [P]: Integration Test - Cache Behavior
- [ ] Create test file `tests/integration/test_cache.ts`
- [ ] Test cache miss → verify provider API called, cached=false
- [ ] Test cache hit within TTL → verify cached=true, cache_age_seconds present
- [ ] Test cache expiry after 24h (flights/hotels) → verify re-fetch
- [ ] Test cache expiry after 7d (search) → verify re-fetch
- [ ] **Expected: Test FAILS (cache layer not implemented yet)**

### T015 [P]: Integration Test - Pro Handoff
- [ ] Create test file `tests/integration/test_pro_handoff.ts`
- [ ] Test GET /handoff/:id → verify complete JSON with ancestry, hotels, airfare, cost
- [ ] Test Content-Disposition header → verify attachment filename format
- [ ] Test invalid trip_id → expect 404 error
- [ ] Test trip without cost estimate → verify partial data returned
- [ ] **Expected: Test FAILS (handoff endpoint not implemented yet)**

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Library Layer

#### T016 [P]: Cache Helper Library
- [ ] Create `functions/api/lib/cache.ts`
- [ ] Implement `getCached(env.DB, provider, queryHash)` → returns cached JSON or null
- [ ] Implement `setCached(env.DB, provider, queryHash, responseJson, ttlSeconds)` → stores with TTL
- [ ] Implement `generateQueryHash(params)` → SHA-256 hash of normalized params
- [ ] Implement `isCacheValid(createdAt, ttlSeconds)` → checks unixepoch() - createdAt < ttlSeconds

#### T017 [P]: Amadeus API Client
- [ ] Create `functions/api/lib/amadeus.ts`
- [ ] Implement OAuth2 client credentials flow: `getAccessToken(clientId, clientSecret)` → caches token for 30min
- [ ] Implement `searchFlights(from, to, month, adults)` → calls `/v2/shopping/flight-offers`
- [ ] Implement `searchHotels(city, checkin, nights, adults)` → calls `/v3/shopping/hotel-offers`
- [ ] Return normalized format matching Flight Offer and Hotel Listing schemas
- [ ] Use lib/cache.ts for 24h caching

#### T018 [P]: Kiwi Tequila API Client
- [ ] Create `functions/api/lib/kiwi.ts`
- [ ] Implement `searchFlights(from, to, dateFrom, dateTo)` → calls `/v2/search` with API key header
- [ ] Return normalized format matching Flight Offer schema
- [ ] Use lib/cache.ts for 24h caching

#### T019 [P]: Serper.dev API Client
- [ ] Create `functions/api/lib/serper.ts`
- [ ] Implement `searchHotels(city, checkin)` → POST `/search` with query "hotels in [city]"
- [ ] Implement `webSearch(query, city, month)` → POST `/search` with query params
- [ ] Return normalized formats matching Hotel Listing and Search Query schemas
- [ ] Use lib/cache.ts (24h for hotels, 7d for search)

#### T020 [P]: Tavily Search API Client
- [ ] Create `functions/api/lib/tavily.ts`
- [ ] Implement `webSearch(query, searchDepth)` → POST `/search` with api_key in body
- [ ] Return normalized format matching Search Query schema
- [ ] Use lib/cache.ts for 7d caching

#### T021 [P]: Google Places API Client
- [ ] Create `functions/api/lib/google-places.ts`
- [ ] Implement `findPlace(hotelName)` → GET `/place/findplacefromtext/json`
- [ ] Implement `getPlaceDetails(placeId)` → GET `/place/details/json` with rating, photos, price_level
- [ ] Return enrichment data (star_rating, booking_reference)
- [ ] Use sparingly (only when Serper lacks data)

#### T022 [P]: Cost Estimator Logic
- [ ] Create `functions/api/lib/cost-estimator.ts`
- [ ] Implement `calculateCostEstimate(airfare, hotels, tours, transport, commissionPct)` → returns Cost Estimate object
- [ ] Calculate component ranges: airfare[low, high], hotels[sum(nightly_low * nights), sum(nightly_high * nights)]
- [ ] Calculate subtotal: sum all component lows, sum all component highs
- [ ] Apply commission to top only: `total_per_person = [subtotal_low, Math.ceil(subtotal_high * (1 + commissionPct/100))]`
- [ ] Include disclaimer: "final quote by travel professional"

#### T023: OCR Enhancement with Cloudflare AI Workers
- [ ] Modify `functions/api/lib/ocr.ts`
- [ ] Replace placeholder with Cloudflare AI Workers: `await env.AI.run('@cf/meta/llama-ocr', { image: imageArrayBuffer })`
- [ ] Add error handling: if OCR fails, return error message + continue trip flow (FR-008)
- [ ] Return extracted text for genealogy parsing

#### T024 [P]: Genealogy Parser Library
- [ ] Create `functions/api/lib/genealogy.ts`
- [ ] Implement `parseFamilySearchURL(url)` → extract person ID, call FamilySearch API `/platform/tree/persons/[ID]`
- [ ] Implement `parseWikiTreeURL(url)` → extract profile ID, call WikiTree API `/api.php?action=getProfile&key=[ID]`
- [ ] Implement `extractGenealogyContext(text, ocrSummary)` → parse surnames, places, dates, migration windows
- [ ] Return Genealogy Context object
- [ ] For unsupported URLs (Ancestry, MyHeritage), return error message: "Manual entry required"

### Prompt Templates

#### T025 [P]: Genealogy Intake Enricher Prompt
- [ ] Create `prompts/genealogy.intake.enricher.txt`
- [ ] Instruction: Extract surnames, suspected origins, migration periods from genealogy text/OCR
- [ ] Output: JSON with surnames[], origins[], migration_window, key_sites[]
- [ ] Use CHEAP model (gpt-4o-mini or claude-3-haiku)

#### T026 [P]: Hotels Options Enricher Prompt
- [ ] Create `prompts/hotels.options.enricher.txt` (may already be drafted)
- [ ] Instruction: Given itinerary, recommend 2-3 hotels per city matching budget tier
- [ ] Output: Hotel suggestions with nightly price ranges, star ratings
- [ ] Use CHEAP model

#### T027 [P]: Flights Airfare Estimator Prompt
- [ ] Create `prompts/flights.airfare.estimator.txt`
- [ ] Instruction: Given flight offers from Amadeus/Kiwi, summarize low/median fare ranges
- [ ] Output: Airfare estimate JSON with route, price_low, price_median, carrier
- [ ] Use CHEAP model

#### T028 [P]: Cost Estimator Prompt
- [ ] Create `prompts/cost.estimator.txt`
- [ ] Instruction: Given airfare + hotels + tours + transport, produce per-person USD range with 10-15% commission headroom
- [ ] Output: Cost Estimate JSON with component breakdowns
- [ ] Use CHEAP model (optional - can use lib/cost-estimator.ts directly)

### Provider Endpoints

#### T029: Flights Provider Endpoint
- [ ] Create `functions/api/providers/flights.ts`
- [ ] Implement GET handler per `providers-flights.openapi.yml`
- [ ] Validate query params: from (IATA), to (IATA), month (YYYY-MM), adults, route_type
- [ ] Check cache via lib/cache.ts with key: provider+queryHash
- [ ] If cache hit, return cached response with cached=true
- [ ] If cache miss, call lib/amadeus.ts searchFlights()
- [ ] If Amadeus fails, fallback to lib/kiwi.ts searchFlights()
- [ ] If both fail, return 500 error: "Provider unavailable"
- [ ] Store result in cache with 24h TTL (86400 seconds)
- [ ] Return JSON per Flight Offer schema
- [ ] Add timeout: 10s threshold (FR-039)

#### T030: Hotels Provider Endpoint
- [ ] Create `functions/api/providers/hotels.ts`
- [ ] Implement GET handler per `providers-hotels.openapi.yml`
- [ ] Validate query params: city, checkin (YYYY-MM-DD), nights, luxury, adults
- [ ] Check cache via lib/cache.ts
- [ ] If cache miss, call lib/amadeus.ts searchHotels()
- [ ] If Amadeus fails, fallback to lib/serper.ts searchHotels() + lib/google-places.ts enrichment
- [ ] Limit results to 2-3 hotels per city (FR-016)
- [ ] If no hotels found, return 404 with message: "Limited availability in [city] - travel pro will find alternatives"
- [ ] Store result in cache with 24h TTL
- [ ] Return JSON per Hotel Listing schema with availability_disclaimer
- [ ] Add timeout: 10s threshold

#### T031: Search Provider Endpoint
- [ ] Create `functions/api/providers/search.ts`
- [ ] Implement GET handler per `providers-search.openapi.yml`
- [ ] Validate query params: q (3-200 chars), city, month, max_results (default 10)
- [ ] Generate cache key: city+topic+month (FR-021)
- [ ] Check cache via lib/cache.ts
- [ ] If cache miss, call lib/serper.ts webSearch()
- [ ] If Serper fails, fallback to lib/tavily.ts webSearch()
- [ ] Store result in cache with 7-day TTL (604800 seconds)
- [ ] Prevent duplicate searches within cache period (FR-022)
- [ ] Return JSON per Search Query schema
- [ ] Add timeout: 10s threshold

#### T032: Cost Estimation Endpoint
- [ ] Create `functions/api/estimate/cost.ts`
- [ ] Implement POST handler per `estimate-cost.openapi.yml`
- [ ] Validate request body: trip_id, airfare{price_low, price_high}, hotels[], tours[], transport[], commission_pct (10-15)
- [ ] Call lib/cost-estimator.ts calculateCostEstimate()
- [ ] Store result in `heritage_trips.variants_json.cost_estimate` via UPDATE query
- [ ] Return Cost Estimate JSON with commission_included=true, disclaimer
- [ ] If trip_id not found, return 400 error

### Trip Flow Enhancements

#### T033: Enhance Trip Intake with Genealogy Parsing
- [ ] Modify `functions/api/trips/index.ts` POST handler
- [ ] Accept new multipart fields: genealogy_url, genealogy_file, departure_airport, transport_pref, hotel_type
- [ ] If genealogy_file provided, call lib/ocr.ts extractTextFromImage() → pass to lib/genealogy.ts
- [ ] If genealogy_url provided, call lib/genealogy.ts parseFamilySearchURL() or parseWikiTreeURL()
- [ ] Call lib/serper.ts or lib/tavily.ts webSearch() for "surname + region history" (FR-005)
- [ ] Store ancestry_context in intake_json per Genealogy Context schema
- [ ] Continue trip generation even if parsing fails (FR-008)
- [ ] Store sources array with kind (url/pdf/image/text), value, ocr_summary, web_search_context

#### T034: Enhance Trip Selection with Hotel Enrichment
- [ ] Modify `functions/api/trips/[id]/select.ts` POST handler
- [ ] After itinerary generation, extract destination cities
- [ ] For each city, call internal GET /providers/hotels?city=[city]&checkin=[date]&nights=[nights]&luxury=[tier]
- [ ] Store hotels_shown[] in itinerary_json per Hotel Listing schema
- [ ] Return expanded itinerary with hotel examples

#### T035: Create A/B Variants Endpoint with Airfare
- [ ] Create `functions/api/trips/[id]/ab.ts` POST handler (or modify existing variant endpoint)
- [ ] Extract departure_airport and destinations from intake_json and itinerary_json
- [ ] Call internal GET /providers/flights?from=[airport]&to=[destination]&month=[month]
- [ ] Store airfare_estimate in variants_json per Flight Offer schema
- [ ] Call POST /estimate/cost to generate cost breakdown
- [ ] Return A/B variants JSON with airfare_estimate and cost_estimate

#### T036: Track Hotel Selections
- [ ] Modify `functions/api/trips/[id]/index.ts` PATCH handler
- [ ] Accept new field: hotels_selected[] with {hotel_id, city, name}
- [ ] Store hotels_selected[] in variants_json per Hotel Selection schema
- [ ] Track selection_context: "shown" for all displayed, "selected" for user-chosen (FR-029, FR-030)
- [ ] Update updated_at timestamp

### Professional Handoff

#### T037: Pro Handoff Export Endpoint
- [ ] Create `functions/api/handoff/[id].ts` GET handler
- [ ] Query heritage_trips WHERE id = :id
- [ ] Aggregate Pro Handoff JSON: trip_id, created_at, intake, ancestry_context, selected_option, itinerary, hotels_shown, hotels_selected, airfare_estimate, cost_estimate
- [ ] Include all genealogy sources (FR-032)
- [ ] Include complete itinerary with selections (FR-033)
- [ ] Set Content-Disposition header: `attachment; filename="trip-${id}-handoff.json"`
- [ ] Return JSON (FR-034)
- [ ] If trip not found, return 404
- [ ] If cost_estimate missing, omit field (partial data OK)

---

## Phase 3.4: Integration

#### T038: Environment Variables Setup
- [ ] Document all required env vars in `~/Documents/.env` per quickstart.md:
  - AMADEUS_CLIENT_ID, AMADEUS_CLIENT_SECRET, AMADEUS_API_URL
  - KIWI_API_KEY, KIWI_API_URL
  - SERPER_API_KEY, SERPER_API_URL
  - TAVILY_API_KEY, TAVILY_API_URL
  - GOOGLE_PLACES_API_KEY
- [ ] Add to `.dev.vars` for local development
- [ ] Add secrets to Cloudflare via `wrangler secret put` for production

#### T039: Update Frontend - Hotel Selection UI
- [ ] Modify `public/index.html`
- [ ] Add hotel selection interface after A/B variants display
- [ ] Show hotels_shown with name, price range, star rating, "Select" button
- [ ] Add onclick handlers to track selections
- [ ] Store selected hotels in local state, send via PATCH /trips/:id

#### T040: Update Frontend - Cost Estimate Display
- [ ] Modify `public/index.html`
- [ ] Add cost estimate section after hotel selection
- [ ] Display per-person range: "$X,XXX - $Y,YYY per person"
- [ ] Display disclaimer: "final quote by travel professional" (FR-028)
- [ ] Add component breakdown (airfare, hotels, tours, transport) if diagnostics enabled

#### T041: Update Frontend - Cost Estimate Fetch
- [ ] Modify `public/app.js`
- [ ] After A/B variants generated, call GET /estimate/cost (or auto-trigger if cost_estimate in response)
- [ ] Display cost breakdown in UI
- [ ] If dates change, show message: "Cost estimate is for previous dates - regenerate for updated pricing"

#### T042: Error Handling - Provider Failures
- [ ] In all provider endpoints, ensure fallback logic handles:
  - Amadeus unavailable → Kiwi/Serper fallback
  - Both providers fail → 500 error with details
  - Timeout >10s → 504 error (FR-039)
- [ ] Log provider switches for debugging
- [ ] Test with simulated failures (remove API keys)

#### T043: Background Cache Cleanup (Optional - Nice to Have)
- [ ] Create Cloudflare Cron Trigger (wrangler.toml scheduled event)
- [ ] Run daily: DELETE FROM cache_providers WHERE created_at + ttl_seconds < unixepoch()
- [ ] Log cleanup count
- [ ] Note: Can defer to post-MVP if cache size not an issue

---

## Phase 3.5: Polish

#### T044 [P]: Unit Test - Cache Helper
- [ ] Create `tests/unit/test_cache.ts`
- [ ] Test generateQueryHash() → same params = same hash
- [ ] Test isCacheValid() → true within TTL, false after
- [ ] Test getCached() → returns null if expired

#### T045 [P]: Unit Test - Cost Estimator
- [ ] Create `tests/unit/test_cost_estimator.ts`
- [ ] Test calculateCostEstimate() with known inputs → verify commission calculation
- [ ] Test commission 10% → verify total_per_person[1] = Math.ceil(subtotal * 1.10)
- [ ] Test commission 15% → verify total_per_person[1] = Math.ceil(subtotal * 1.15)

#### T046 [P]: Unit Test - Genealogy Parser
- [ ] Create `tests/unit/test_genealogy.ts`
- [ ] Test parseFamilySearchURL() with valid URL → verify person ID extraction
- [ ] Test parseWikiTreeURL() with valid URL → verify profile ID extraction
- [ ] Test unsupported URL → verify "Manual entry required" message

#### T047: Performance Test - Provider Endpoints
- [ ] Run curl tests from quickstart.md with `time` command
- [ ] Verify flight search: 2-5s without cache, <100ms with cache
- [ ] Verify hotel search: 3-6s without cache, <100ms with cache
- [ ] Verify generic search: 1-3s without cache, <100ms with cache
- [ ] Verify cost estimation: <1s
- [ ] Verify pro handoff: <500ms
- [ ] All must complete within 10s timeout (FR-039)

#### T048: Run Quickstart Integration Tests
- [ ] Execute all 8 integration test scenarios from quickstart.md:
  1. Create trip with genealogy upload
  2. Verify ancestry context in intake
  3. Generate trip options
  4. Enrich with hotels
  5. Enrich with airfare
  6. Generate A/B variants with cost estimate
  7. Select hotels
  8. Generate pro handoff
- [ ] Verify cache hit/miss behavior
- [ ] Test cache expiry (manually set created_at in past)

#### T049: Code Quality - Remove Duplication
- [ ] Review provider clients (amadeus.ts, kiwi.ts, serper.ts, tavily.ts) for common patterns
- [ ] Extract shared HTTP client logic if needed
- [ ] Review error handling across endpoints - ensure consistent format
- [ ] Remove any dead code or unused imports

#### T050: Update Documentation
- [ ] Update README.md with new endpoints
- [ ] Document environment variables required
- [ ] Add quickstart.md instructions to main docs
- [ ] Add examples of pro handoff JSON
- [ ] Document cache TTL strategy (24h/7d)

#### T051: Deploy to Cloudflare
- [ ] Run `wrangler pages deploy`
- [ ] Verify all secrets are set: `wrangler secret list`
- [ ] Smoke test production endpoints per quickstart.md
- [ ] Test https://voygent-heritage-mvp.pages.dev/api/providers/flights
- [ ] Test https://voygent-heritage-mvp.pages.dev/api/providers/hotels
- [ ] Test https://voygent-heritage-mvp.pages.dev/api/providers/search
- [ ] Test https://voygent-heritage-mvp.pages.dev/api/estimate/cost
- [ ] Test https://voygent-heritage-mvp.pages.dev/api/handoff/:id

---

## Dependencies

**Critical Path** (must complete in order):
1. T001-T002 (Database) → T016 (Cache) → T017-T021 (Providers) → T029-T031 (Endpoints)
2. T023-T024 (OCR + Genealogy) → T033 (Trip Intake Enhancement)
3. T029-T031 (Provider Endpoints) → T032 (Cost Estimation) → T037 (Pro Handoff)
4. T007-T015 (Tests) → T016-T037 (Implementation) → T044-T051 (Polish)

**Blocks**:
- T016 (Cache) blocks T017-T021 (all provider clients need cache)
- T017 (Amadeus) blocks T029 (Flights endpoint) and T030 (Hotels endpoint)
- T018 (Kiwi) blocks T029 (Flights fallback)
- T019 (Serper) blocks T030 (Hotels fallback) and T031 (Search endpoint)
- T023 (OCR) blocks T033 (Trip intake)
- T024 (Genealogy) blocks T033 (Trip intake)
- T029-T031 (Provider endpoints) block T034-T035 (Trip flow enhancements)
- T032 (Cost estimation) blocks T035 (A/B variants)
- T033-T036 (Backend) block T039-T041 (Frontend)

**No dependencies** (can run in parallel):
- T003-T006 (Schemas) - all different files
- T007-T015 (Tests) - all different files
- T017-T021 (Provider clients after T016) - all different files
- T025-T028 (Prompts) - all different files
- T044-T046 (Unit tests) - all different files

---

## Parallel Execution Examples

### Parallel Group 1: Schemas (after T001-T002)
```bash
# Launch T003-T006 together:
Task: "Create schemas/cost-estimate.v1.json per Cost Estimate entity"
Task: "Create schemas/flight-offer.v1.json per Flight Offer entity"
Task: "Create schemas/hotel-listing.v1.json per Hotel Listing entity"
# T006 cannot run parallel (modifies existing intake schema)
```

### Parallel Group 2: Contract Tests (Phase 3.2)
```bash
# Launch T007-T015 together (all different test files):
Task: "Contract test GET /providers/flights in tests/contract/test_providers_flights.ts"
Task: "Contract test GET /providers/hotels in tests/contract/test_providers_hotels.ts"
Task: "Contract test GET /providers/search in tests/contract/test_providers_search.ts"
Task: "Contract test POST /estimate/cost in tests/contract/test_estimate_cost.ts"
Task: "Integration test genealogy upload in tests/integration/test_genealogy_upload.ts"
Task: "Integration test hotel enrichment in tests/integration/test_hotel_enrichment.ts"
Task: "Integration test cost estimation in tests/integration/test_cost_estimation.ts"
Task: "Integration test cache behavior in tests/integration/test_cache.ts"
Task: "Integration test pro handoff in tests/integration/test_pro_handoff.ts"
```

### Parallel Group 3: Provider Clients (after T016 Cache)
```bash
# Launch T017-T021 together:
Task: "Create functions/api/lib/amadeus.ts with OAuth2 + flight/hotel search"
Task: "Create functions/api/lib/kiwi.ts with API key auth + flight search"
Task: "Create functions/api/lib/serper.ts with hotel search + web search"
Task: "Create functions/api/lib/tavily.ts with web search"
Task: "Create functions/api/lib/google-places.ts with place enrichment"
```

### Parallel Group 4: Prompts (any time)
```bash
# Launch T025-T028 together:
Task: "Create prompts/genealogy.intake.enricher.txt"
Task: "Create prompts/hotels.options.enricher.txt"
Task: "Create prompts/flights.airfare.estimator.txt"
Task: "Create prompts/cost.estimator.txt"
```

### Parallel Group 5: Unit Tests (Phase 3.5)
```bash
# Launch T044-T046 together:
Task: "Unit test cache helper in tests/unit/test_cache.ts"
Task: "Unit test cost estimator in tests/unit/test_cost_estimator.ts"
Task: "Unit test genealogy parser in tests/unit/test_genealogy.ts"
```

---

## Validation Checklist

- [x] All 4 contracts have corresponding tests (T007-T010 map to providers-flights, providers-hotels, providers-search, estimate-cost)
- [x] All 9 entities have implementation tasks (T003-T005: schemas, T016-T024: libraries, T029-T037: endpoints)
- [x] All tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks are truly independent (checked file paths)
- [x] Each task specifies exact file path
- [x] No [P] task modifies same file as another [P] task

---

## Notes

- **[P] tasks** = different files, no dependencies - can run in parallel via Task tool
- **TDD approach**: Verify all tests in Phase 3.2 FAIL before implementing Phase 3.3
- **Constitution alignment**: All tasks support critical path (Intake → Options → Select → A/B → Cost Estimate → Save Trip ID)
- **Commit strategy**: Commit after each completed task for rollback safety
- **Avoid**: Vague tasks, same-file conflicts, skipping tests

---

## Total Task Count: 51 tasks

**Breakdown**:
- Setup & Database: 6 tasks (T001-T006)
- Tests (TDD): 9 tasks (T007-T015)
- Core Implementation: 22 tasks (T016-T037)
- Integration: 6 tasks (T038-T043)
- Polish: 8 tasks (T044-T051)

**Estimated Completion**: ~50-70 hours (1-2 hours per task average)

**Critical Path Tasks** (must complete for MVP):
- T001-T002, T016, T017-T019, T022-T024, T029-T033, T037, T048

**Optional/Deferred**:
- T020 (Tavily - Serper sufficient)
- T021 (Google Places - nice-to-have)
- T043 (Background cleanup - can defer)
