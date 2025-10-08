# Implementation Tasks: Transform Voygent to Prompt-Driven Template System

**Feature**: 011-transform-voygent-to
**Branch**: `011-transform-voygent-to`
**Total Tasks**: 73
**Estimated Duration**: 12-16 hours (with parallel execution)

---

## Task Execution Strategy

### Parallel Execution Groups
Tasks marked **[P]** can run in parallel within their group. Use multiple Task agents:

```bash
# Example: Run 5 contract tests in parallel
Task agent1: "Complete T005: template-crud contract test"
Task agent2: "Complete T006: research-workflow contract test"
Task agent3: "Complete T007: price-estimates contract test"
Task agent4: "Complete T008: handoff contract test"
Task agent5: "Complete T009: diagnostics contract test"
```

### Dependency Order
1. **Setup** (T001-T004): Environment, migrations, schema
2. **Contract Tests** (T005-T009): API contract validation
3. **Database** (T010-T013): Template extensions, handoff table
4. **Core Services** (T014-T022): Template engine, validation, variable replacement
5. **API Endpoints** (T023-T055): CRUD, research, pricing, handoff, diagnostics
6. **A/B Removal** (T056-T060): Deprecation and cleanup
7. **Frontend** (T061-T067): Diagnostic window, handoff UI
8. **Integration** (T068-T071): End-to-end scenarios
9. **Polish** (T072-T073): Performance, documentation

---

## Phase 1: Setup & Foundations (T001-T004)

### T001: Branch and Environment Setup ✅
**Files**: `.git/`, `.dev.vars`
**Dependencies**: None
**Description**: Create feature branch, verify environment variables, test local Wrangler dev server.

```bash
git checkout -b 011-transform-voygent-to
# Verify .dev.vars has: ZAI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, AMADEUS_API_KEY
wrangler pages dev --local
```

### T002: Database Migration 020 - Extend trip_templates [P] ✅
**Files**: `migrations/020_extend_trip_templates.sql`
**Dependencies**: T001
**Description**: Create migration adding 16 new columns to trip_templates table per data-model.md.

Schema changes:
- UI Verbiage: search_placeholder, search_help_text, progress_messages
- Workflow Control: workflow_prompt, daily_activity_prompt, why_we_suggest_prompt, number_of_options, trip_days_min, trip_days_max
- Config Arrays: luxury_levels, activity_levels, transport_preferences
- Provider Instructions: tour_search_instructions, hotel_search_instructions, flight_search_instructions, estimate_margin_percent

### T003: Database Migration 021 - Create handoff_documents [P] ✅
**Files**: `migrations/021_create_handoff_documents.sql`
**Dependencies**: T001
**Description**: Create handoff_documents table with 19 columns per data-model.md.

Schema per data-model.md:193-258.

### T004: Run Migrations Locally and in Production ✅
**Files**: Database
**Dependencies**: T002, T003
**Description**: Apply migrations to both test and production databases.

```bash
# Local (test DB)
wrangler d1 execute voygent-test --file=migrations/020_extend_trip_templates.sql
wrangler d1 execute voygent-test --file=migrations/021_create_handoff_documents.sql

# Production
wrangler d1 execute voygent-themed --file=migrations/020_extend_trip_templates.sql
wrangler d1 execute voygent-themed --file=migrations/021_create_handoff_documents.sql
```

---

## Phase 2: Contract Tests (T005-T009)

### T005: Template CRUD Contract Test [P]
**Files**: `tests/contracts/template-crud.test.ts`
**Dependencies**: T004
**Description**: Create contract test validating template-crud.openapi.yml endpoints.

Test cases:
- GET /api/admin/templates (list with pagination)
- POST /api/admin/templates (create with validation)
- GET /api/admin/templates/{id} (retrieve single)
- PUT /api/admin/templates/{id} (update)
- DELETE /api/admin/templates/{id} (deactivate)
- POST /api/admin/templates/{id}/validate (validation)
- POST /api/admin/templates/{id}/duplicate (copy)

### T006: Research Workflow Contract Test [P]
**Files**: `tests/contracts/research-workflow.test.ts`
**Dependencies**: T004
**Description**: Create contract test validating research-workflow.openapi.yml endpoints.

Test cases:
- POST /api/trips (create with research initiation)
- GET /api/trips/{id}/research (poll status)
- PATCH /api/trips/{id}/research (mark viewed)
- POST /api/trips/{id}/options (generate with 403 if research not viewed)
- GET /api/trips/{id}/progress (progress messages)

### T007: Price Estimates Contract Test [P]
**Files**: `tests/contracts/price-estimates.test.ts`
**Dependencies**: T004
**Description**: Create contract test validating price-estimates.openapi.yml endpoints.

Test cases:
- POST /api/trips/{id}/flights (3-5 options with margin)
- POST /api/trips/{id}/hotels (3-7 per location with margin)
- POST /api/trips/{id}/transport (rental/train/driver estimates)
- POST /api/trips/{id}/tours (TripAdvisor/Tours by Locals)

### T008: Handoff Contract Test [P]
**Files**: `tests/contracts/handoff.test.ts`
**Dependencies**: T004
**Description**: Create contract test validating handoff.openapi.yml endpoints.

Test cases:
- POST /api/trips/{id}/handoff (create with complete context)
- GET /api/trips/{id}/handoff (retrieve)
- GET /api/trips/{id}/handoff/pdf (PDF generation)
- GET /api/trips/{id}/handoff/json (JSON export)
- GET /api/handoffs (agent list)
- POST /api/handoffs/{id}/quote (agent submit)
- POST /api/handoffs/{id}/accept (user accept)

### T009: Diagnostics Contract Test [P]
**Files**: `tests/contracts/diagnostics.test.ts`
**Dependencies**: T004
**Description**: Create contract test validating diagnostics.openapi.yml endpoints.

Test cases:
- GET /api/trips/{id}/diagnostics (with filters: since, level, category)
- GET /api/trips/{id}/diagnostics/stream (long-polling)
- GET /api/trips/{id}/diagnostics/export (JSON download)
- GET /api/admin/diagnostics/health (system status)
- GET /api/admin/diagnostics/errors (recent errors)
- GET /api/admin/diagnostics/providers (usage stats)

---

## Phase 3: Database Models & Validation (T010-T013)

### T010: TripTemplate Model Extensions [P] ✅
**Files**: `functions/api/lib/trip-templates.ts`
**Dependencies**: T004
**Description**: Extend TripTemplate TypeScript interface with 16 new fields per data-model.md.

Add types for: search_placeholder, search_help_text, progress_messages, workflow_prompt, daily_activity_prompt, why_we_suggest_prompt, number_of_options, trip_days_min, trip_days_max, luxury_levels, activity_levels, transport_preferences, tour_search_instructions, hotel_search_instructions, flight_search_instructions, estimate_margin_percent.

### T011: HandoffDocument Model [P] ✅
**Files**: `functions/api/lib/handoff-documents.ts`
**Dependencies**: T004
**Description**: Create new HandoffDocument TypeScript interface per data-model.md:136-179.

Include all 19 fields: id, trip_id, user_id, chat_history, research_summary, user_preferences, all_flight_options, selected_flight_id, all_hotel_options, selected_hotel_ids, all_transport_options, selected_transport_ids, daily_itinerary, total_estimate_usd, margin_percent, agent_id, agent_quote_usd, agent_notes, quote_status, pdf_url, json_export, created_at, quoted_at, expires_at.

### T012: Template JSON Validation Service [P] ✅
**Files**: `functions/api/lib/validators/template-validator.ts`
**Dependencies**: T010
**Description**: Create validation service for template JSON fields per data-model.md:210-232.

Validate:
- progress_messages: Array of 1-10 strings, max 100 chars each
- luxury_levels, activity_levels, transport_preferences: Arrays of 1-6 strings
- Text length limits: workflow_prompt (100-10,000), daily_activity_prompt (50-2,000)
- Business logic: trip_days_max >= trip_days_min, estimate_margin_percent 10-25

### T013: Handoff JSON Validation Service [P] ✅
**Files**: `functions/api/lib/validators/handoff-validator.ts`
**Dependencies**: T011
**Description**: Create validation service for handoff JSON structures per data-model.md:216-232.

Validate:
- chat_history: Max 100 messages, chronological, each max 10,000 chars
- user_preferences: Required fields (luxury_level, activity_level, transport, days, adults)
- all_flight_options, all_hotel_options: Valid array structures
- daily_itinerary: Array of daily plans with required fields

---

## Phase 4: Core Services (T014-T022)

### T014: Template Variable Replacement Service [P] ✅
**Files**: `functions/api/lib/services/template-engine.ts`
**Dependencies**: T010
**Description**: Create service to replace template variables like {surnames}, {regions}, {input} per quickstart.md:391-401.

Support variables:
- {surnames}: Join with " and "
- {regions}: Join with ", "
- {input}: JSON.stringify(intake)
- {search_results}: research_summary
- {preferences}: JSON.stringify(preferences)

Include sanitization to prevent injection.

### T015: Template CRUD Service [P] ✅
**Files**: `functions/api/lib/services/template-service.ts`
**Dependencies**: T010, T012
**Description**: Create service for template CRUD operations with validation.

Methods:
- listTemplates(isActive?, limit, offset)
- getTemplate(id)
- createTemplate(data) - validates before insert
- updateTemplate(id, data) - validates before update
- deactivateTemplate(id) - sets is_active=0
- duplicateTemplate(id) - creates copy with "(Copy)" suffix
- validateTemplate(data) - returns {valid, errors, warnings}

### T016: Research Workflow Service [P] ✅
**Files**: `functions/api/lib/services/research-service.ts`
**Dependencies**: T010, T014
**Description**: Create service managing research-first workflow with gating logic.

Methods:
- initiateResearch(tripId, templateId, intake) - uses research_synthesis_prompt
- getResearchStatus(tripId) - returns status, summary, research_viewed
- markResearchViewed(tripId) - sets research_viewed=true, enables options
- canGenerateOptions(tripId) - checks research_viewed gate

### T017: Trip Options Generator Service [P] ✅
**Files**: `functions/api/lib/services/options-service.ts`
**Dependencies**: T010, T014, T016
**Description**: Create service generating N trip options based on template config.

Uses template.number_of_options (1-10) and template.workflow_prompt to generate options. Returns array of trip options per research-workflow.openapi.yml:235-264.

### T018: Price Estimation Service [P] ✅
**Files**: `functions/api/lib/services/pricing-service.ts`
**Dependencies**: T010
**Description**: Create service adding margin to Amadeus prices per template.estimate_margin_percent.

Methods:
- addMargin(basePrice, marginPercent) - returns {base, estimated, margin_applied}
- getFlightEstimates(tripId, searchParams) - calls Amadeus, applies margin
- getHotelEstimates(tripId, searchParams) - calls Amadeus, applies margin
- getTransportEstimates(tripId, searchParams) - AI estimation with margin
- getTourEstimates(tripId, searchParams) - TripAdvisor API with margin

### T019: Handoff Assembly Service [P] ✅
**Files**: `functions/api/lib/services/handoff-service.ts`
**Dependencies**: T011, T013
**Description**: Create service assembling comprehensive handoff documents per quickstart.md:415-444.

Methods:
- createHandoff(tripId, selections) - assembles complete context
- getChatHistory(tripId, limit=100) - last 100 messages
- getAllOptionsShown(tripId) - flights, hotels, transport with selected indicators
- calculateExpiry() - created_at + 30 days
- generatePDF(handoffId) - returns R2 URL
- exportJSON(handoffId) - structured export

### T020: Diagnostic Logging Service [P] ✅
**Files**: `functions/api/lib/services/diagnostic-service.ts`
**Dependencies**: Existing Logger class (Feature 006)
**Description**: Create service for trip-specific diagnostic queries.

Methods:
- getTripLogs(tripId, filters?) - queries logs by correlation_id
- streamTripLogs(tripId, sinceId) - long-polling for new logs
- exportTripLogs(tripId) - JSON download
- getTripSummary(tripId) - aggregated metrics
- getSystemHealth() - overall status
- getProviderStats(hours) - usage metrics

### T021: Daily Itinerary Generator Service [P] ✅
**Files**: `functions/api/lib/services/itinerary-service.ts`
**Dependencies**: T010, T014
**Description**: Create service generating daily plans using template prompts.

Uses template.daily_activity_prompt and template.why_we_suggest_prompt to generate structured daily plans per handoff.openapi.yml:315-335.

### T022: Tour Search Service [P] ✅
**Files**: `functions/api/lib/services/tour-service.ts`
**Dependencies**: T010
**Description**: Create service searching TripAdvisor/Tours by Locals using template.tour_search_instructions.

Methods:
- searchTours(location, date, travelers, activityLevel, luxuryLevel)
- Uses template instructions to guide search
- Filters by rating (4.5+), group size, luxury match
- Returns structured tour estimates per price-estimates.openapi.yml:367-398

---

## Phase 5: API Endpoints - Admin Templates (T023-T029)

### T023: GET /api/admin/templates - List Templates ✅
**Files**: `functions/api/admin/templates/index.ts`
**Dependencies**: T015
**Description**: Implement template listing endpoint with pagination and filtering.

Query params: is_active, limit (default 50, max 100), offset. Returns templates array with total count.

### T024: POST /api/admin/templates - Create Template ✅
**Files**: `functions/api/admin/templates/index.ts` (same file as T023)
**Dependencies**: T023
**Description**: Implement template creation with JSON validation.

Validates all fields before insert, returns 400 with field_errors if invalid. Uses TemplateService.createTemplate().

### T025: GET /api/admin/templates/[id] - Get Single Template ✅
**Files**: `functions/api/admin/templates/[id].ts`
**Dependencies**: T015
**Description**: Implement single template retrieval endpoint.

Returns 404 if not found, otherwise full template object.

### T026: PUT /api/admin/templates/[id] - Update Template ✅
**Files**: `functions/api/admin/templates/[id].ts` (same file as T025)
**Dependencies**: T025
**Description**: Implement template update with validation.

Validates updated fields, returns 400 with errors if invalid. Uses TemplateService.updateTemplate().

### T027: DELETE /api/admin/templates/[id] - Deactivate Template ✅
**Files**: `functions/api/admin/templates/[id].ts` (same file as T025)
**Dependencies**: T025
**Description**: Implement template soft delete (sets is_active=0).

Never hard deletes. Returns success message. Uses TemplateService.deactivateTemplate().

### T028: POST /api/admin/templates/[id]/validate - Validate Template [P] ✅
**Files**: `functions/api/admin/templates/[id]/validate.ts`
**Dependencies**: T015
**Description**: Implement validation endpoint for admin UI.

Returns {valid, errors[], warnings[]} without saving. Uses TemplateService.validateTemplate().

### T029: POST /api/admin/templates/[id]/duplicate - Duplicate Template [P] ✅
**Files**: `functions/api/admin/templates/[id]/duplicate.ts`
**Dependencies**: T015
**Description**: Implement template duplication endpoint.

Creates copy with " (Copy)" suffix in name. Returns new template. Uses TemplateService.duplicateTemplate().

---

## Phase 6: API Endpoints - Research Workflow (T030-T034)

### T030: POST /api/trips - Create Trip with Research
**Files**: `functions/api/trips/index.ts`
**Dependencies**: T016
**Description**: Implement trip creation endpoint initiating research phase.

Validates intake matches template.required_fields. Initiates research asynchronously. Returns {trip_id, status: 'researching', correlation_id}.

### T031: GET /api/trips/[id]/research - Get Research Status
**Files**: `functions/api/trips/[id]/research.ts`
**Dependencies**: T016
**Description**: Implement research status polling endpoint.

Returns {status, research_summary, research_viewed, provider_used, tokens_used, cost_usd}. Status: pending|in_progress|complete|failed.

### T032: PATCH /api/trips/[id]/research - Mark Research Viewed
**Files**: `functions/api/trips/[id]/research.ts` (same file as T031)
**Dependencies**: T031
**Description**: Implement research viewed gate endpoint.

Sets research_viewed=true. Returns {success, can_generate_options}. Required before options generation.

### T033: POST /api/trips/[id]/options - Generate Trip Options
**Files**: `functions/api/trips/[id]/options.ts`
**Dependencies**: T017, T032
**Description**: Implement options generation endpoint with research gate.

Returns 403 if research_viewed=false. Generates N options based on template.number_of_options. Uses template.workflow_prompt via OptionsService.

### T034: GET /api/trips/[id]/progress - Get Progress Status [P]
**Files**: `functions/api/trips/[id]/progress.ts`
**Dependencies**: T030
**Description**: Implement progress polling endpoint with template messages.

Returns {status, progress_message, percent_complete, estimated_seconds_remaining}. Uses template.progress_messages array.

---

## Phase 7: API Endpoints - Price Estimates (T035-T042)

### T035: POST /api/trips/[id]/flights - Get Flight Estimates [P]
**Files**: `functions/api/trips/[id]/flights.ts`
**Dependencies**: T018
**Description**: Implement flight price estimation endpoint.

Searches Amadeus for 3-5 options (cheapest, shortest, upgrades). Applies template.estimate_margin_percent. Uses template.flight_search_instructions for AI guidance. Returns flights with disclaimer.

### T036: POST /api/trips/[id]/hotels - Get Hotel Estimates [P]
**Files**: `functions/api/trips/[id]/hotels.ts`
**Dependencies**: T018
**Description**: Implement hotel price estimation endpoint.

Searches Amadeus for 3-7 hotels per location matching luxury_level. Applies margin. Uses template.hotel_search_instructions. Returns hotels with disclaimer.

### T037: POST /api/trips/[id]/transport - Get Transport Estimates [P]
**Files**: `functions/api/trips/[id]/transport.ts`
**Dependencies**: T018
**Description**: Implement transport estimation endpoint.

AI estimates for rental_car, train, hired_driver, bus, ferry based on template.transport_preferences. Applies margin. Returns estimates with disclaimer.

### T038: POST /api/trips/[id]/tours - Get Tour Estimates [P]
**Files**: `functions/api/trips/[id]/tours.ts`
**Dependencies**: T022
**Description**: Implement tour search endpoint.

Searches TripAdvisor/Tours by Locals using template.tour_search_instructions. Filters by rating (4.5+), group size, luxury level. Applies margin. Returns tours with booking URLs (for agent reference).

### T039: Track All Options Shown - Flight [P]
**Files**: `functions/api/lib/services/options-tracker.ts`
**Dependencies**: T035
**Description**: Create service tracking all flight options shown to user.

Stores in trip record for handoff document. Methods: trackFlightOptions(tripId, options), getAllFlightOptions(tripId).

### T040: Track All Options Shown - Hotel [P]
**Files**: `functions/api/lib/services/options-tracker.ts` (same file as T039)
**Dependencies**: T036
**Description**: Extend service to track all hotel options shown.

Methods: trackHotelOptions(tripId, location, options), getAllHotelOptions(tripId).

### T041: Track All Options Shown - Transport [P]
**Files**: `functions/api/lib/services/options-tracker.ts` (same file as T039)
**Dependencies**: T037
**Description**: Extend service to track all transport options shown.

Methods: trackTransportOptions(tripId, options), getAllTransportOptions(tripId).

### T042: Track All Options Shown - Tours [P]
**Files**: `functions/api/lib/services/options-tracker.ts` (same file as T039)
**Dependencies**: T038
**Description**: Extend service to track all tour options shown.

Methods: trackTourOptions(tripId, options), getAllTourOptions(tripId).

---

## Phase 8: API Endpoints - Handoff & Agent Quotes (T043-T050)

### T043: POST /api/trips/[id]/handoff - Create Handoff Document
**Files**: `functions/api/trips/[id]/handoff.ts`
**Dependencies**: T019, T039, T040, T041, T042
**Description**: Implement handoff creation endpoint.

Assembles complete context: chat_history (100 msgs), research_summary, all_options (flights/hotels/transport/tours) with selected indicators, daily_itinerary, user_preferences. Calculates expires_at (created_at + 30 days). Returns handoff object.

### T044: GET /api/trips/[id]/handoff - Get Handoff Document
**Files**: `functions/api/trips/[id]/handoff.ts` (same file as T043)
**Dependencies**: T043
**Description**: Implement handoff retrieval endpoint.

Returns 404 if not found, otherwise full handoff object.

### T045: GET /api/trips/[id]/handoff/pdf - Download PDF [P]
**Files**: `functions/api/trips/[id]/handoff/pdf.ts`
**Dependencies**: T043
**Description**: Implement PDF export endpoint.

Generates professional PDF including: cover page, chat history, research summary, options comparison tables (selected highlighted), daily itinerary, total estimate breakdown, agent contact form. Returns PDF binary or 202 if generating (retry in 5s).

### T046: GET /api/trips/[id]/handoff/json - Export JSON [P]
**Files**: `functions/api/trips/[id]/handoff/json.ts`
**Dependencies**: T043
**Description**: Implement JSON export endpoint.

Returns complete structured data per handoff.openapi.yml:346-368. Includes handoff + trip_template + system_metadata for agency integration.

### T047: GET /api/handoffs - List Handoffs for Agent [P]
**Files**: `functions/api/handoffs/index.ts`
**Dependencies**: T043
**Description**: Implement agent handoff listing endpoint.

Filters by status (pending/quoted/booked/cancelled), agent_id. Returns array of HandoffSummary per handoff.openapi.yml:337-350.

### T048: POST /api/handoffs/[handoff_id]/quote - Agent Submit Quote
**Files**: `functions/api/handoffs/[handoff_id]/quote.ts`
**Dependencies**: T047
**Description**: Implement agent quote submission endpoint.

Validates quote_usd >= total_estimate_usd. Updates handoff with agent_quote_usd, agent_notes, modifications[], quoted_at timestamp. Sets quote_status='quoted'. Sends user notification. Returns {success, quote_id, user_notified}.

### T049: POST /api/handoffs/[handoff_id]/accept - User Accept Quote [P]
**Files**: `functions/api/handoffs/[handoff_id]/accept.ts`
**Dependencies**: T048
**Description**: Implement user quote acceptance endpoint.

Sets quote_status='booked'. Returns {success, status: 'booked', agent_contact}.

### T050: Handoff Expiry Cleanup Job [P]
**Files**: `functions/api/lib/jobs/handoff-cleanup.ts`
**Dependencies**: T043
**Description**: Create scheduled job to archive expired handoffs.

Runs daily. Archives handoffs where expires_at < now() AND quote_status IN ('pending', 'cancelled'). Deletes PDFs from R2. Moves to archive table or sets archived=true.

---

## Phase 9: API Endpoints - Diagnostics (T051-T055)

### T051: GET /api/trips/[id]/diagnostics - Get Trip Logs [P]
**Files**: `functions/api/trips/[id]/diagnostics.ts`
**Dependencies**: T020
**Description**: Implement trip diagnostics endpoint with filtering.

Query params: since (timestamp), level (debug/info/warn/error), category. Returns logs via correlation_id with summary (total_logs, log_levels, providers_used, total_cost, duration).

### T052: GET /api/trips/[id]/diagnostics/stream - Stream Logs [P]
**Files**: `functions/api/trips/[id]/diagnostics/stream.ts`
**Dependencies**: T020
**Description**: Implement long-polling diagnostics endpoint.

Holds connection up to 30s waiting for new logs. Query param: last_log_id. Returns new logs or 204 if timeout.

### T053: GET /api/trips/[id]/diagnostics/export - Export Logs [P]
**Files**: `functions/api/trips/[id]/diagnostics/export.ts`
**Dependencies**: T020
**Description**: Implement log export endpoint.

Returns JSON download: {trip_id, correlation_id, logs[], export_timestamp}.

### T054: GET /api/admin/diagnostics/health - System Health [P]
**Files**: `functions/api/admin/diagnostics/health.ts`
**Dependencies**: T020
**Description**: Implement system health check endpoint.

Returns {status: healthy|degraded|down, services: {database, amadeus, providers: {zai, openai, anthropic}}, metrics: {active_trips, error_rate_percent, avg_response_time_ms}}.

### T055: GET /api/admin/diagnostics/providers - Provider Stats [P]
**Files**: `functions/api/admin/diagnostics/providers.ts`
**Dependencies**: T020
**Description**: Implement provider usage stats endpoint.

Query param: hours (default 24). Returns {period_hours, providers: [{provider, model, requests, success_count, error_count, fallback_count, total_cost_usd, avg_latency_ms}], total_cost_usd, total_requests, fallback_count}.

---

## Phase 10: A/B Comparison Removal (T056-T060)

### T056: Deprecate A/B Endpoint with 410 Gone
**Files**: `functions/api/trips/[id]/ab.ts`
**Dependencies**: T033
**Description**: Modify A/B endpoint to return 410 Gone with migration guide.

Return: {error: "A/B comparison has been deprecated", message: "Use template-driven trip options instead", migration_guide: "https://docs.voygent.app/migration/ab-to-templates", deprecated_since: "2025-10-01", removal_date: "2025-11-01"}.

### T057: Remove A/B Frontend UI
**Files**: `public/templates/ab-selector.html`, `public/templates/trip-detail.html`
**Dependencies**: T056
**Description**: Delete A/B variant selection UI components.

Remove: ab-selector.html (entire file). Edit trip-detail.html: remove `<div id="ab-comparison">` section.

### T058: Monitor A/B Endpoint Usage [P]
**Files**: Diagnostic logs
**Dependencies**: T056
**Description**: Monitor for A/B endpoint calls over 7 days.

Check GET /api/admin/diagnostics/errors for "410 Gone: A/B comparison deprecated" count. If <5 calls in 7 days, proceed to T059.

### T059: Delete A/B Endpoint File (after 30 days)
**Files**: `functions/api/trips/[id]/ab.ts`
**Dependencies**: T058 + 30 day wait
**Description**: Delete A/B endpoint file after grace period.

```bash
rm functions/api/trips/[id]/ab.ts
grep -r "from.*ab.ts" functions/  # Verify no imports
```

### T060: Database Migration 022 - Remove variants_json (after 60 days) [P]
**Files**: `migrations/022_remove_variants_json.sql`
**Dependencies**: T059 + 60 day wait
**Description**: Create and run migration to drop deprecated column.

```sql
ALTER TABLE themed_trips DROP COLUMN variants_json;
```

---

## Phase 11: Frontend - Diagnostics & Handoff UI (T061-T067)

### T061: Diagnostic Window Component [P]
**Files**: `public/components/diagnostic-window.js`, `public/templates/diagnostic-window.html`
**Dependencies**: T051
**Description**: Create real-time diagnostic window component per quickstart.md:276-296.

Features:
- Polls GET /api/trips/{id}/diagnostics every 2s
- Displays logs with level colors (debug=gray, info=blue, warn=yellow, error=red)
- Filter dropdowns: level, category
- Shows summary metrics: providers_used, total_cost, duration
- Export button (downloads JSON)

### T062: Diagnostic Window CSS Styling [P]
**Files**: `public/css/diagnostic-window.css`
**Dependencies**: T061
**Description**: Style diagnostic window for production UI.

Dark theme, monospace font for logs, collapsible sections, fixed position bottom-right corner.

### T063: Integrate Diagnostic Window in Trip Pages
**Files**: `public/templates/trip-detail.html`, `public/js/trip-detail.js`
**Dependencies**: T061, T062
**Description**: Add diagnostic window toggle button to trip detail pages.

Bottom-right floating button "View Diagnostics" opens window. Only visible for admin users or in dev mode.

### T064: Handoff Request UI [P]
**Files**: `public/components/handoff-request.js`, `public/templates/handoff-button.html`
**Dependencies**: T043
**Description**: Create "Get a free quote from a travel professional" button component.

Shows after user selects flights/hotels. Triggers POST /api/trips/{id}/handoff. Displays success modal with PDF download link.

### T065: Handoff PDF Preview [P]
**Files**: `public/components/pdf-preview.js`
**Dependencies**: T045
**Description**: Create PDF preview modal component.

Embeds PDF iframe, download button, share button. Uses GET /api/trips/{id}/handoff/pdf.

### T066: Agent Dashboard - Handoff List [P]
**Files**: `public/admin/agent-handoffs.html`, `public/js/agent-handoffs.js`
**Dependencies**: T047
**Description**: Create agent dashboard for viewing assigned handoffs.

Lists handoffs via GET /api/handoffs?status=pending. Shows: trip summary, travelers, destination, days, estimate, expires_at. Click opens detail view.

### T067: Agent Quote Submission Form [P]
**Files**: `public/components/agent-quote-form.js`
**Dependencies**: T048
**Description**: Create agent quote submission form.

Form fields: quote_usd (≥ estimate), agent_notes, modifications[] (item, original_price, new_price, reason). Submits to POST /api/handoffs/{id}/quote.

---

## Phase 12: Integration & E2E Tests (T068-T071)

### T068: Integration Test - Culinary Heritage Template [P]
**Files**: `tests/integration/culinary-heritage.test.ts`
**Dependencies**: T005-T067
**Description**: Implement Scenario 1 from quickstart.md:23-82 as automated test.

Flow:
1. POST /api/admin/templates (create Culinary Heritage template)
2. POST /api/admin/templates/{id}/validate (verify)
3. POST /api/trips (test trip with template)
4. Verify research, options, estimates work

### T069: Integration Test - Scottish Heritage Trip [P]
**Files**: `tests/integration/scottish-heritage-trip.test.ts`
**Dependencies**: T005-T067
**Description**: Implement Scenario 2 from quickstart.md:86-210 as automated test.

Flow:
1. POST /api/trips (create trip)
2. Poll GET /api/trips/{id}/research until complete
3. PATCH /api/trips/{id}/research (mark viewed)
4. POST /api/trips/{id}/options (generate 4 options)
5. GET /api/trips/{id}/diagnostics (verify logs)

### T070: Integration Test - Travel Agent Handoff [P]
**Files**: `tests/integration/agent-handoff.test.ts`
**Dependencies**: T005-T067
**Description**: Implement Scenario 3 from quickstart.md:214-331 as automated test.

Flow:
1. Complete trip creation (flights, hotels, itinerary selected)
2. POST /api/trips/{id}/handoff (create handoff)
3. GET /api/trips/{id}/handoff/pdf (verify PDF generated)
4. POST /api/handoffs/{id}/quote (agent submits quote)
5. POST /api/handoffs/{id}/accept (user accepts)

### T071: Integration Test - Diagnostic Workflow [P]
**Files**: `tests/integration/diagnostics.test.ts`
**Dependencies**: T005-T067
**Description**: Implement Scenario 4 from quickstart.md:335-373 as automated test.

Flow:
1. Create trip with intentional error (invalid template variable)
2. GET /api/trips/{id}/diagnostics (verify error logged)
3. GET /api/trips/{id}/diagnostics?level=error (filter errors)
4. GET /api/trips/{id}/diagnostics/export (download logs)

---

## Phase 13: Polish & Deployment (T072-T073)

### T072: Performance Optimization [P]
**Files**: Various
**Dependencies**: T068-T071
**Description**: Optimize for performance goals (<10s research, <30s total, <5s Amadeus).

Actions:
- Profile template variable replacement (should be <50ms)
- Verify Amadeus 24h caching working (check cache_providers table)
- Test Z.AI fallback latency (should be <2s to OpenAI)
- Optimize diagnostic polling (index on correlation_id, limit to last 1000 logs)
- Compress handoff JSON before storage if >1MB

### T073: Documentation & Deployment [P]
**Files**: `README.md`, `CHANGELOG.md`, deployment
**Dependencies**: T072
**Description**: Update documentation and deploy to production.

Actions:
1. Update README with template-driven system overview
2. Add CHANGELOG entry for feature 011
3. Deploy to Cloudflare Pages:
   ```bash
   git add .
   git commit -m "feat: Transform to prompt-driven template system with agent handoff"
   git push origin 011-transform-voygent-to
   # Create PR, merge to main
   # Cloudflare auto-deploys
   ```
4. Run production migrations:
   ```bash
   wrangler d1 execute voygent-themed --file=migrations/020_extend_trip_templates.sql
   wrangler d1 execute voygent-themed --file=migrations/021_create_handoff_documents.sql
   ```
5. Verify production at voygent.app

---

## Parallel Execution Plan

### Wave 1: Setup (Sequential)
- T001 → T002, T003 (parallel) → T004

### Wave 2: Tests & Models (8 parallel agents)
- T005, T006, T007, T008, T009 (contract tests)
- T010, T011, T012, T013 (models & validation)

### Wave 3: Core Services (9 parallel agents)
- T014, T015, T016, T017, T018, T019, T020, T021, T022

### Wave 4: Admin Endpoints (Mix of sequential and parallel)
- T023, T024 (sequential, same file)
- T025, T026, T027 (sequential, same file)
- T028, T029 (parallel, different files)

### Wave 5: Research & Options Endpoints (Mix)
- T030 → T031, T032 (sequential, same file) → T033
- T034 (parallel with above)

### Wave 6: Pricing Endpoints (8 parallel agents)
- T035, T036, T037, T038 (estimate endpoints)
- T039, T040, T041, T042 (tracking, same file but can be done in sequence quickly)

### Wave 7: Handoff Endpoints (Mix)
- T043, T044 (sequential, same file)
- T045, T046, T047 (parallel, different files)
- T048 → T049 (sequential if related logic)
- T050 (parallel)

### Wave 8: Diagnostics Endpoints (5 parallel agents)
- T051, T052, T053, T054, T055

### Wave 9: A/B Removal (Sequential with waits)
- T056 → T057 → T058 → [wait 30 days] → T059 → [wait 60 days] → T060

### Wave 10: Frontend (7 parallel agents)
- T061, T062 → T063 (sequential)
- T064, T065, T066, T067 (parallel)

### Wave 11: Integration Tests (4 parallel agents)
- T068, T069, T070, T071

### Wave 12: Polish (2 parallel agents)
- T072, T073

---

## Success Criteria

### Functional Requirements
- ✅ All 5 contract tests pass (T005-T009)
- ✅ All 4 integration tests pass (T068-T071)
- ✅ Template CRUD works in admin UI
- ✅ Research-first workflow enforces gate (403 if research not viewed)
- ✅ Price estimates include margin and disclaimers
- ✅ Handoff documents include complete context (chat, research, all options)
- ✅ Diagnostic window shows real-time logs with filtering
- ✅ A/B comparison completely removed from UI and endpoints

### Performance Requirements
- ✅ Research phase completes in <10s (Z.AI with fallback)
- ✅ Total trip generation in <30s
- ✅ Amadeus API calls in <5s (with caching)
- ✅ Template variable replacement in <50ms
- ✅ Diagnostic polling <100ms per request

### Constitution Compliance
- ✅ Critical path maintained: Template → Research → Preferences → Estimates → Handoff
- ✅ Cheap-first policy: Z.AI primary, token optimization via templates
- ✅ No inventory claims: All prices labeled "Estimated", disclaimers present
- ✅ Reproducibility: Migrations deterministic, local/prod identical

---

## Rollback Plan

If critical issues found in production:

1. **Immediate**: Revert main branch to previous commit
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Database**: Migrations are backwards-compatible (nullable columns with defaults)
   - No rollback needed unless data corruption
   - If needed: manually remove new columns (not recommended)

3. **A/B Removal**: If users complain about missing A/B feature
   - Endpoint already returns 410 with migration guide
   - Can temporarily re-enable by removing 410 response (not recommended)

4. **Monitor**: Watch diagnostics for errors
   ```bash
   curl https://voygent.app/api/admin/diagnostics/errors?hours=1
   ```

---

## Estimated Timeline

**With Sequential Execution**: ~16 hours
**With Maximum Parallelization**: ~12 hours

| Phase | Tasks | Duration (parallel) | Duration (sequential) |
|-------|-------|---------------------|----------------------|
| Setup | T001-T004 | 30 min | 30 min |
| Tests & Models | T005-T013 | 1 hour | 3 hours |
| Core Services | T014-T022 | 1.5 hours | 4 hours |
| Admin APIs | T023-T029 | 45 min | 1.5 hours |
| Research APIs | T030-T034 | 30 min | 1 hour |
| Pricing APIs | T035-T042 | 1 hour | 2.5 hours |
| Handoff APIs | T043-T050 | 1 hour | 2 hours |
| Diagnostics | T051-T055 | 45 min | 1.5 hours |
| A/B Removal | T056-T060 | 30 min | 45 min |
| Frontend | T061-T067 | 1.5 hours | 3 hours |
| Integration | T068-T071 | 1 hour | 2 hours |
| Polish | T072-T073 | 1.5 hours | 2 hours |
| **TOTAL** | **73 tasks** | **~12 hours** | **~16 hours** |

*Note: A/B removal T059-T060 require 30-60 day wait periods, excluded from timeline.*
