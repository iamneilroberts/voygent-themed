# Implementation Plan: Transform Voygent to Prompt-Driven Template System

**Branch**: `011-transform-voygent-to` | **Date**: 2025-10-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-transform-voygent-to/spec.md`

## Execution Flow (/plan command scope)
```
1.  Load feature spec from Input path
2.  Fill Technical Context (spec is comprehensive, no ambiguities)
3.  Fill Constitution Check section
4.  Evaluate Constitution Check - PASS (aligns with B2B2C model)
5. ’ Execute Phase 0 ’ research.md
6. ’ Execute Phase 1 ’ contracts, data-model.md, quickstart.md
7. ’ Re-evaluate Constitution Check
8. ’ Plan Phase 2 approach
9. STOP - Ready for /tasks command
```

## Summary
Transform Voygent from a hard-coded heritage trip builder into a generalized, prompt-driven platform that supports any trip theme (heritage, culinary, adventure, wellness, etc.) with all behavior, verbiage, and workflow controlled by database templates rather than code. Remove obsolete A/B comparison logic. Integrate Feature 006 diagnostics window for real-time logging visibility. Use Amadeus APIs for accurate flight/hotel price estimates (not booking). Generate comprehensive handoff documents (with complete chat history, research summary, and all options shown) for travel agent subscribers to quote in their systems and return quotes to travelers. Critical path: Template Selection ’ Research Display ’ User Preferences ’ Price Estimates ’ Quote Handoff.

## Technical Context
**Language/Version**: TypeScript (Cloudflare Workers runtime)
**Primary Dependencies**: Cloudflare Functions, D1 (SQLite), Amadeus Self-Service APIs (price estimates only), TripAdvisor API, Tours by Locals API, Serper.dev, Tavily Search
**Storage**: Cloudflare D1 (existing tables: trips, messages, trip_templates, logs, metrics_snapshots, daily_aggregates, admin_users, agencies, cache_providers; new tables: handoff_documents, travel_agents)
**Testing**: Manual contract tests (curl), integration tests, template validation tests
**Target Platform**: Cloudflare Pages + Functions (edge runtime)
**Project Type**: Web application (frontend: /public, backend: /functions/api)
**Performance Goals**: <10s research phase, <30s total trip generation, <5s Amadeus API calls
**Constraints**: No eval() (edge runtime), AI provider cost minimization (Z.AI ’ OpenRouter ’ Anthropic ’ OpenAI cascade), 15-20% margin built into estimates, all prompts in database not code
**Scale/Scope**: Multi-template system, 1-10 trip options per template config, 3-5 hotel estimates per location, support 50+ templates without performance degradation, comprehensive handoff documents with full context

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Check (Pre-Phase 0)

**Critical Path Alignment**:
-  Ships core flow: Template Selection ’ Research ’ User Prefs ’ Trip Options ’ Price Estimates ’ Quote Handoff
-  Removes non-critical A/B comparison logic (off critical path)
-  Research-first workflow ensures user sees context before trip generation (on critical path)
-  Travel agent handoff is B2B2C value proposition (on critical path for monetization)

**Cheap-First Policy**:
-  Prioritizes Z.AI (cheapest) with cascading fallbacks (already implemented: 9bf8f78)
-  Uses cheap models for intake, research synthesis, trip options (<600 tokens when possible)
-  Template-driven prompts reduce token usage by eliminating code-level instructions
-  Amadeus API calls for pricing only (no booking, minimal API costs)
-  Caching reduces redundant provider calls (24h flight/hotel, 7d search TTL)

**No Inventory Claims**:
-  All prices labeled as "Estimates" with 15-20% margin built in
-  Handoff document clearly shows Voygent estimates vs final agent quote
-  No booking functionality (prices for planning only)
-  Agent provides official quote with terms and booking deadline
-  Uses "typical," "estimated," and disclaimer language throughout

**Reproducibility**:
-  Same build locally (wrangler dev) and prod (Pages deploy)
-  D1 schema migrations (will add 020_extend_templates.sql, 021_handoff_documents.sql)
-  Environment parity (.dev.vars for local, secrets for prod)
-  All prompts in database, versioned and migrat able
-  Template-driven behavior means no code changes for new trip types

**Status**:  PASS - All constitutional principles satisfied

---

### Post-Phase 1 Re-Check
*(To be completed after Phase 1 design)*

**Critical Path Alignment** (will verify against data-model.md + contracts/):
- [ ] All entities support template-driven workflow
- [ ] Research-first gate enforced in data model
- [ ] Handoff document captures complete context
- [ ] Diagnostic integration doesn't block trip creation

**Cheap-First Policy** (will verify against endpoints):
- [ ] Template prompts optimized for token efficiency
- [ ] Provider selection logic uses cheapest capable model
- [ ] Amadeus calls use Self-Service tier (lowest cost)
- [ ] Tour search uses free/low-cost APIs where possible

**No Inventory Claims** (will verify against contracts/):
- [ ] All price estimate schemas include disclaimer fields
- [ ] Handoff document format emphasizes estimate vs quote distinction
- [ ] UI labels all prices as "Estimated" or "For Planning Purposes"

**Reproducibility** (will verify against project structure):
- [ ] New migrations are deterministic
- [ ] Template CRUD endpoints work identically locally and in prod
- [ ] No environment-specific template logic

**Status**: ó PENDING - Will complete after Phase 1

---

## Phase 0: Research & Discovery
*Execute now ’ generates research.md*

### Research Questions
1. **Template Schema Design**: What additional fields are needed in trip_templates to support full prompt-driven workflow?
   - Current schema has: intake_prompt, options_prompt, required_fields, optional_fields, example_inputs
   - Spec requires: search_placeholder, search_help_text, progress_messages (JSON), workflow_prompt, number_of_options, trip_days_min/max, luxury_levels (JSON), activity_levels (JSON), transport_preferences (JSON), tour_search_instructions, hotel_search_instructions, flight_search_instructions, daily_activity_prompt, why_we_suggest_prompt, research_synthesis_prompt, research_query_template

2. **A/B Comparison Removal**: What code/endpoints/UI elements implement A/B comparison that must be removed?
   - `/api/trips/:id/ab` endpoint exists
   - UI likely has variant A vs B display logic
   - Database may have variant_a, variant_b fields

3. **Diagnostic Integration**: How does Feature 006 logging integrate with trip creation UI?
   - Logger class exists (`functions/api/lib/logger.ts`)
   - Needs frontend diagnostic window component
   - Real-time log streaming or polling mechanism

4. **Amadeus API Integration**: What existing amadeus.ts implementation exists and what changes are needed?
   - File exists: `functions/api/lib/amadeus.ts`
   - Need to verify: Self-Service API tier, caching strategy, error handling
   - Ensure pricing calls only (no booking logic)

5. **Handoff Document Structure**: What format works best for travel agent software compatibility?
   - Agents use Sabre, Amadeus (GDS), Travelport
   - Need both PDF (human-readable) and JSON (machine-readable)
   - Must include complete chat history, all options shown, selected choices

6. **Template CRUD Operations**: What admin interface exists for creating/editing templates?
   - Admin dashboard exists (`public/admin-dashboard.html`)
   - Template endpoints exist (`/api/templates/[id]`, `/api/admin/build-theme`)
   - Need UI for editing extended template fields

7. **Provider Cost Optimization**: How is the Z.AI ’ OpenRouter ’ Anthropic ’ OpenAI cascade implemented?
   - Recent commit (9bf8f78) added Z.AI as primary with fallbacks
   - Need to verify: error handling, timeout logic, cost tracking
   - Ensure cheapest model selection per operation type

8. **Trip Options Workflow**: How should template-controlled number_of_options work with existing options generation?
   - Current system generates up to 4 options
   - Template can specify 1-10 options
   - Need to respect template config without breaking existing trips

### Research Artifacts to Generate
- `research.md`: Comprehensive analysis of above questions with code references
- Architecture decision records (ADRs) for key design choices
- Migration strategy from current hard-coded system to template-driven
- Risk analysis and mitigation strategies

---

## Phase 1: Design Artifacts
*Execute after Phase 0 ’ generates data-model.md, contracts/, quickstart.md*

### 1. Data Model (data-model.md)
**Extended trip_templates table**:
- Add 16 new columns per FR-004 spec
- JSON fields for arrays (luxury_levels, activity_levels, etc.)
- TEXT fields for prompts (workflow_prompt, daily_activity_prompt, etc.)
- INTEGER fields for configuration (number_of_options, trip_days_min/max)
- Validate JSON structure on insert/update

**New handoff_documents table**:
- FK to trips table
- Traveler contact info (name, email, phone)
- Complete chat history (JSON array)
- Research summary (TEXT)
- All flight options shown (JSON array with selected flags)
- All hotel options shown (JSON array with selected flags)
- Daily itinerary (JSON)
- Transport details (JSON)
- Tours list (JSON)
- User preferences (JSON)
- Estimated budget breakdown (JSON)
- Special requests (TEXT)
- Agent assignment and status tracking
- Quote return fields

**New travel_agents table** (if not exists):
- Agent profile (name, email, phone, agency_id)
- Subscription status
- Specialties/regions
- Performance metrics (quotes completed, response time)

**Extended trips table**:
- Remove: variants_json (A/B comparison data)
- Add: research_summary, research_completed_at, correlation_id
- Add: selected_flight, selected_hotels, selected_transport, selected_tours (all JSON)
- Add: total_cost_usd (estimated)

**Validation Rules**:
- Templates must have all required prompt fields OR sensible defaults
- Handoff documents must have traveler contact before creation
- Price estimates must include disclaimer text
- Chat history must be chronological array

**Indexes**:
- trip_templates(is_active, number_of_options)
- handoff_documents(status, created_at)
- handoff_documents(agent_id, status)
- trips(template_id, created_at)

### 2. API Contracts (contracts/ directory)
**template-crud.openapi.yml**:
- GET /api/templates ’ list active templates with all fields
- GET /api/templates/{id} ’ single template details
- PUT /api/templates/{id} ’ update template (admin only)
- POST /api/templates ’ create template (admin only)
- POST /api/templates/{id}/validate ’ validate template prompts

**research-workflow.openapi.yml**:
- POST /api/research ’ initiate research phase
  - Request: { template_id, user_input, user_preferences }
  - Response: { research_id, status: "processing" }
- GET /api/research/{id} ’ poll research status
  - Response: { status, summary, progress_pct }
- GET /api/research/{id}/summary ’ get completed research summary
  - Response: { summary_text, sources, completed_at }

**price-estimates.openapi.yml**:
- POST /api/estimates/flights ’ Amadeus flight price estimates
  - Request: { origin, destination, dates, travelers, cabin_class }
  - Response: { options: [cheapest, shortest, upgrade], disclaimer }
- POST /api/estimates/hotels ’ Amadeus hotel price estimates
  - Request: { location, checkin, checkout, travelers, luxury_level }
  - Response: { options: [3-5 hotels], disclaimer }
- POST /api/estimates/transport ’ rental car / rail estimates
  - Request: { locations, days, travelers, transport_type }
  - Response: { daily_rate, total_cost, disclaimer }

**handoff.openapi.yml**:
- POST /api/trips/{id}/request-quote ’ generate handoff document
  - Request: { traveler_name, traveler_email, traveler_phone, special_requests }
  - Response: { handoff_id, status: "pending", agent_assignment: null }
- GET /api/handoff/{id} ’ get handoff document
  - Response: { complete handoff document structure }
- GET /api/handoff/{id}/pdf ’ download PDF version
  - Response: PDF file
- GET /api/handoff/{id}/json ’ download JSON version
  - Response: JSON file
- POST /api/handoff/{id}/quote ’ agent submits quote (agent-only)
  - Request: { agent_quote_details (JSON) }
  - Response: { status: "quoted", quote_sent_at }

**diagnostics.openapi.yml**:
- GET /api/logs/trip/{tripId} ’ get logs for specific trip
  - Uses correlation_id to filter Feature 006 logs table
  - Response: { logs: [array of log entries], count }
- GET /api/logs/stream ’ SSE endpoint for real-time logs (optional)
  - Server-Sent Events stream of new log entries

### 3. Quickstart Guide (quickstart.md)
**Scenario 1**: Admin creates new culinary trip template
- Navigate to admin dashboard
- Click "Create New Template"
- Fill in all required fields (name, description, icon, prompts)
- Set number_of_options=5, trip_days_min=7, trip_days_max=14
- Define luxury_levels, activity_levels, transport_preferences (JSON)
- Save and activate template
- Verify template appears in user-facing template selector

**Scenario 2**: User creates heritage trip with research-first workflow
- Select "Heritage Trip" template
- Enter surname "McLeod"
- System initiates research phase (status updates via progress endpoint)
- Research summary displays (2-3 paragraphs about McLeod origins)
- User provides preferences (10 days, Comfort luxury, Moderate activity)
- System generates 3 trip options based on template config
- User selects "Scottish Highlands" option
- System fetches Amadeus estimates for flights and hotels
- Complete itinerary displays with price estimates

**Scenario 3**: User requests travel agent quote
- From complete itinerary page, click "Get a free quote from a travel professional"
- Form appears requesting name, email, phone, special requests
- User submits form
- System generates handoff document with complete chat history, research summary, all options shown
- PDF and JSON versions available for download
- Handoff routed to subscribed travel agent
- Agent reviews document, quotes in their system, returns quote
- User receives email with agent quote and contact info

**Scenario 4**: Developer views trip creation diagnostics
- User creates trip (correlation_id generated)
- Click "View Diagnostics" button in UI
- Diagnostic window opens showing real-time logs
- Filter by severity (DEBUG, INFO, WARN, ERROR)
- See each workflow step: research, options generation, Amadeus calls, cost estimation
- Expand log entries to see metadata (duration, status, errors)
- Use for debugging when trips fail or behave unexpectedly

**Scenario 5**: Developer removes A/B comparison code
- Search codebase for "variantA", "variantB", "/ab" references
- Remove `/api/trips/:id/ab` endpoint
- Remove UI components showing A/B comparison
- Remove variants_json from database queries
- Deploy and verify no A/B UI elements remain
- Test existing trips still load correctly

**Environment Setup**:
```bash
# Required environment variables
AMADEUS_API_KEY=xxx              # Self-Service API key
AMADEUS_API_SECRET=xxx           # Self-Service API secret
TRIPADVISOR_API_KEY=xxx          # API key for tour search
TOURS_BY_LOCALS_API_KEY=xxx      # API key for tour search
TAVILY_API_KEY=xxx               # Existing
SERPER_API_KEY=xxx               # Existing
Z_AI_API_KEY=xxx                 # Cheapest provider (existing)
OPENROUTER_API_KEY=xxx           # Fallback (existing)
ANTHROPIC_API_KEY=xxx            # Fallback (existing)
OPENAI_API_KEY=xxx               # Fallback (existing)
JWT_SECRET=xxx                   # Admin auth (existing)
```

---

## Phase 2: Implementation Planning
*To be executed in /tasks command - generates tasks.md*

### Implementation Strategy
1. **Foundation** (T001-T010): Extend database schema, remove A/B code
2. **Template System** (T011-T020): Template CRUD, validation, UI
3. **Research Workflow** (T021-T030): Research-first gate, progress tracking
4. **Price Estimates** (T031-T040): Amadeus integration, transport/tour estimates
5. **Handoff Documents** (T041-T050): Document generation, PDF export, agent routing
6. **Diagnostics Integration** (T051-T060): Frontend diagnostic window, log streaming
7. **Testing & Deployment** (T061-T070): E2E tests, migration script, production deploy

### Key Architectural Decisions
1. **Template Prompt Execution**: Use template variables like `{input}`, `{search_results}`, `{preferences}` and replace at runtime
2. **Research Gate**: Enforce research completion before allowing trip options generation (database constraint + UI logic)
3. **Price Estimate Caching**: Cache Amadeus responses for 24h (flights) and 48h (hotels) to reduce API costs
4. **Handoff Document Storage**: Store complete handoff in database (handoff_documents table) + generate PDF/JSON on demand
5. **Diagnostic Window**: Use polling (GET /api/logs/trip/{tripId} every 2s) rather than WebSocket/SSE for simplicity
6. **A/B Removal**: Deprecate endpoint rather than delete (return 410 Gone) for backwards compatibility during transition

### Risk Mitigation
- **Template Validation**: Strict JSON schema validation for all template fields before save
- **Amadeus API Limits**: Implement rate limiting and fallback to manual pricing if quota exceeded
- **Handoff Document Size**: Limit chat history to last 100 messages to prevent document bloat
- **Migration Path**: Create script to backfill existing trips with template_id and research_summary fields
- **Provider Cascade**: Test Z.AI ’ OpenRouter ’ Anthropic ’ OpenAI fallback under various failure modes

---

## Progress Tracking

### Phase 0: Research ó
- [ ] Research template schema extensions
- [ ] Research A/B comparison code locations
- [ ] Research Feature 006 logging integration
- [ ] Research Amadeus API implementation
- [ ] Research handoff document formats
- [ ] Research template CRUD admin UI
- [ ] Research provider cost optimization
- [ ] Research trip options workflow
- [ ] Generate research.md artifact

### Phase 1: Design ó
- [ ] Create data-model.md with all table schemas
- [ ] Create template-crud.openapi.yml
- [ ] Create research-workflow.openapi.yml
- [ ] Create price-estimates.openapi.yml
- [ ] Create handoff.openapi.yml
- [ ] Create diagnostics.openapi.yml
- [ ] Create quickstart.md with 5 scenarios
- [ ] Re-evaluate constitution check

### Phase 2: Task Planning ó
- [ ] Break down implementation into ~70 tasks
- [ ] Assign task dependencies
- [ ] Estimate task durations
- [ ] Identify critical path
- [ ] Generate tasks.md artifact

---

## Dependencies
- **Feature 006 (Full Logging)**:  IMPLEMENTED (see IMPLEMENTATION_SUMMARY.md)
  - Logger class, admin dashboard, metrics aggregation all exist
  - Need to add: Frontend diagnostic window component
  - Need to add: Log filtering by correlation_id for trip-specific logs
- **Amadeus Self-Service API**:   UNKNOWN (need to verify lib/amadeus.ts implementation)
  - If not using Self-Service tier, need to migrate to lower-cost tier
  - If booking logic exists, need to remove and keep only pricing
- **TripAdvisor API**: L NOT IMPLEMENTED (need new integration)
  - Tour search functionality required for FR-010
- **Tours by Locals API**: L NOT IMPLEMENTED (need new integration)
  - Small group/private tour search required for FR-010
- **Template UI Admin**:   PARTIAL (admin dashboard exists, but extended fields not editable)
  - Need to add form fields for 16 new template columns

---

## Success Metrics
-  All A/B comparison code removed (0 references to variantA/variantB)
-  Template system supports 50+ templates without performance degradation (<5s template load)
-  Research summary displays within 10 seconds
-  Complete trip generation (research ’ options ’ estimates) completes within 60 seconds
-  Diagnostic window shows all workflow steps in real-time (<2s lag)
-  Handoff document includes 100% of required fields per FR-016 spec
-  PDF export generates successfully for all handoff documents
-  Amadeus API calls return within 5 seconds
-  Price estimates include 15-20% margin and disclaimer text
-  Zero code changes required to add new trip template (all config in database)

---

## Constitutional Compliance Summary
 **Critical Path**: Template Selection ’ Research ’ Prefs ’ Estimates ’ Handoff
 **Cheap-First**: Z.AI primary, cascading fallbacks, template-driven prompts reduce tokens
 **No Inventory Claims**: All prices labeled "Estimated", 15-20% margin, agent quotes final
 **Reproducibility**: Database migrations, template versioning, same build local/prod

---

## Next Steps
1. Execute Phase 0 research (generate research.md)
2. Execute Phase 1 design (generate data-model.md, contracts/, quickstart.md)
3. Re-evaluate constitution check after Phase 1
4. Await /tasks command to generate tasks.md with ~70 implementation tasks

## Phase 1: Constitution Re-Check Results

**Completed**: 2025-10-07 after generating data-model.md, contracts/, and quickstart.md

### Critical Path Alignment âœ…
Verified against data-model.md + contracts/:
- **Template-driven workflow**: trip_templates extended with 16 columns for workflow control (data-model.md:16-95)
- **Research-first gate**: research_viewed boolean gates options generation, API returns 403 if not viewed (research-workflow.openapi.yml:105-130)
- **Complete handoff context**: Includes chat_history (100 msgs), research_summary, ALL options shown (handoff.openapi.yml:193-230)
- **Non-blocking diagnostics**: Async batch logging, read-only polling endpoints (diagnostics.openapi.yml:15-82)

### Cheap-First Policy âœ…
Verified against endpoints:
- **Token optimization**: Variable replacement reduces redundant instructions, templates reused (quickstart.md:391-401)
- **Cheapest provider**: Z.AI primary ($0.065/1M) with fallback, already deployed (lib/provider.ts:48-72, commit 9bf8f78)
- **Amadeus Self-Service**: $0.01-0.05/call confirmed, 24h caching (research.md:50-63)
- **Free/low-cost APIs**: TripAdvisor/Tours by Locals, template-guided searches (price-estimates.openapi.yml:165-209)

### No Inventory Claims âœ…
Verified against contracts/:
- **Disclaimer fields**: All estimate responses include "Prices are estimates only..." (price-estimates.openapi.yml:78-79)
- **Estimate vs quote distinction**: total_estimate_usd vs agent_quote_usd separate fields (handoff.openapi.yml:225-227)
- **Estimate labeling**: Schema fields named estimated_price_usd, base_price_usd (price-estimates.openapi.yml:233-238)

### Reproducibility âœ…
Verified against project structure:
- **Deterministic migrations**: Explicit defaults, full CREATE TABLE schemas (data-model.md:284-343)
- **Identical local/prod**: OpenAPI contracts, JSON validation in API layer (template-crud.openapi.yml:11-15)
- **Environment-agnostic**: All fields in D1, provider selection uses env keys but template logic agnostic (data-model.md:16-95)

### New Risks Identified
1. **Handoff document size**: 100 chat messages + all options â†’ Mitigate: Compress JSON, paginate PDFs
2. **Template variable injection**: User input in {variables} â†’ Mitigate: Sanitize in replaceTemplateVars()
3. **Diagnostic polling load**: 2s Ã— concurrent trips â†’ Mitigate: Index correlation_id, rate limiting

### Constitution Re-Check: âœ… PASS
All constitutional principles verified in Phase 1 design. Proceed to Phase 2 task generation.

