# Tasks: VoyGent V3 Template-Driven Trip Planner

**Input**: Design documents from `/home/neil/dev/voygent-v3/specs/001-voygent-v3-template/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- File paths are absolute from repository root

## Path Conventions
- **Frontend**: `public/` (HTML, CSS, JS)
- **Backend**: `functions/` (TypeScript)
- **Database**: `db/` (migrations, seeds)
- **Config**: Root level (`wrangler.toml`, `package.json`, `tsconfig.json`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and configuration that all user stories depend on

- [ ] T001 [P] Initialize Node.js project with `package.json` (dependencies: wrangler, @cloudflare/workers-types, hono, vitest, playwright)
- [ ] T002 [P] Create TypeScript configuration in `tsconfig.json` (target: ES2022, module: ESNext, types: @cloudflare/workers-types)
- [ ] T003 [P] Create Cloudflare Pages configuration in `wrangler.toml` (D1 binding: voygent-v3-dev)
- [ ] T004 [P] Create `.env.example` with API key placeholders (AMADEUS_API_KEY, VIATOR_API_KEY, SERPER_API_KEY, ZAI_API_KEY, OPENROUTER_API_KEY)
- [ ] T005 [P] Create `.gitignore` (exclude: node_modules/, .env, .wrangler/, dist/)
- [ ] T006 [P] Create directory structure: `public/`, `public/css/`, `public/js/`, `public/assets/icons/`, `functions/api/`, `functions/lib/`, `functions/services/`, `functions/middleware/`, `db/migrations/`, `db/seeds/`

**Checkpoint**: Project structure ready for code development

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T007 Create D1 database migration `db/migrations/0001_init_trip_templates.sql` for `trip_templates` table (see data-model.md schema)
- [ ] T008 Create D1 database migration `db/migrations/0002_init_themed_trips.sql` for `themed_trips` table (see data-model.md schema)
- [ ] T009 Create database seed file `db/seeds/0001_seed_templates.sql` with 5 featured themes + "Plan My Trip" generic template (Heritage🌳, Wine🍷, Film🎬, Historical📜, Adventure🏔️)
- [ ] T010 [P] Implement D1 database client in `functions/lib/db.ts` (exports: query builder, connection helper, transaction support)
- [ ] T011 [P] Implement logging service in `functions/lib/logger.ts` (user-facing vs admin telemetry routing based on role check, Constitution principle IV)
- [ ] T012 [P] Implement cost tracker in `functions/lib/cost-tracker.ts` (accumulates AI/API costs, updates themed_trips.ai_cost_usd and api_cost_usd)
- [ ] T013 [P] Implement template engine in `functions/lib/template-engine.ts` (interpolates {surname}, {region}, etc. in template prompts)
- [ ] T014 [P] Implement phase gate middleware in `functions/lib/phase-gate.ts` (validates destinations_confirmed before Phase 2, Constitution principle II)
- [ ] T015 [P] Implement CORS middleware in `functions/middleware/cors.ts` (handles preflight requests, adds CORS headers)
- [ ] T016 [P] Implement error handler middleware in `functions/middleware/error-handler.ts` (catches errors, returns user-friendly messages, logs technical details for admins)
- [ ] T017 [P] Create global CSS styles in `public/css/main.css` (typography, colors, layout utilities, CSS reset)
- [ ] T018 [P] Create utility functions in `public/js/utils.js` (date formatting, currency formatting, string helpers)
- [ ] T019 [P] Create API client wrapper in `public/js/api-client.js` (fetch wrapper with error handling, base URL configuration, request/response interceptors)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Destination Research and Confirmation (Priority: P1) 🎯 MVP

**Goal**: Users can select a theme, describe their trip interests, receive AI-researched destination recommendations, and confirm/refine choices before trip building begins. Delivers immediate value by helping users discover destinations risk-free without wasted API costs.

**Independent Test**: Select "Heritage & Ancestry" theme, enter "Sullivan family from Cork, Ireland", receive 2-4 destination recommendations with context, confirm selections. System status changes to "awaiting_confirmation" without calling any booking APIs (Amadeus, Viator). User sees friendly progress messages, admin sees technical telemetry.

### Implementation for User Story 1

- [ ] T020 [P] [US1] Implement AI provider fallback chain in `functions/lib/ai-providers.ts` (Z.AI llama-3.3-70b → OpenRouter → backup, cost tracking, token limits)
- [ ] T021 [P] [US1] Implement web search client in `functions/services/search-client.ts` (Serper/Tavily integration, returns 10-30 results per query)
- [ ] T022 [US1] Implement research service in `functions/services/research-service.ts` (uses template.research_query_template, calls search-client, synthesizes with AI using destination_criteria_prompt, returns 2-4 destinations)
- [ ] T023 [US1] Implement `POST /api/trips` endpoint in `functions/api/trips/index.ts` (creates trip, stores initial message, starts Phase 1 research, returns trip_id)
- [ ] T024 [US1] Implement `POST /api/trips/:id/chat` endpoint in `functions/api/trips/[id]/chat.ts` (handles user messages, calls research service or parses confirmations, updates chat_history, supports SSE streaming)
- [ ] T025 [US1] Implement `GET /api/trips/:id` endpoint in `functions/api/trips/[id]/index.ts` (returns trip state: status, progress_message, research_destinations, destinations_confirmed)
- [ ] T026 [US1] Implement `POST /api/trips/:id/confirm-destinations` endpoint in `functions/api/trips/[id]/confirm-destinations.ts` (validates destinations, sets destinations_confirmed=true, updates status='building_trip', triggers Phase 2—implementation for Phase 2 will be in US3)
- [ ] T027 [P] [US1] Create homepage HTML in `public/index.html` (theme selection cards, "Plan My Trip" button, responsive grid layout)
- [ ] T028 [P] [US1] Create homepage styles in `public/css/main.css` (theme card styling, hover effects, responsive breakpoints)
- [ ] T029 [P] [US1] Create homepage script in `public/js/main.js` (loads templates via GET /api/templates, renders theme cards, handles clicks → navigates to chat.html?template_id={id})
- [ ] T030 [P] [US1] Create chat interface HTML in `public/chat.html` (chat window, message display area, input box, send button, progress indicator)
- [ ] T031 [P] [US1] Create chat interface styles in `public/css/chat.css` (message bubbles, user vs AI alignment, scrollable chat area, input box styling)
- [ ] T032 [US1] Create chat interface script in `public/js/chat.js` (sends messages via POST /api/trips/:id/chat, displays AI responses, handles SSE streaming, shows progress messages, polls GET /api/trips/:id for status updates)
- [ ] T033 [US1] Add user-facing progress message display to chat interface in `public/js/chat.js` (shows "Researching destinations..." during Phase 1, NO technical details)
- [ ] T034 [US1] Add admin diagnostic telemetry panel in `public/js/diagnostics.js` (fetches GET /api/trips/:id/logs via SSE, displays model names/costs/tokens/timing, only visible when user.role='admin')
- [ ] T035 [P] [US1] Implement `GET /api/templates` endpoint in `functions/api/templates/index.ts` (returns featured templates with featured=1 and is_active=1)
- [ ] T036 [P] [US1] Implement `GET /api/templates/:id` endpoint in `functions/api/templates/[id].ts` (returns full template config including all prompts and constraints)
- [ ] T037 [US1] Implement `GET /api/trips/:id/logs` endpoint in `functions/api/trips/[id]/logs.ts` (admin-only, requires auth middleware, streams telemetry_logs via SSE)
- [ ] T038 [P] [US1] Implement admin auth middleware in `functions/middleware/auth.ts` (checks user.role='admin', returns 403 if not admin)

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently. Users can research destinations and confirm choices without any booking API calls.

---

## Phase 4: User Story 2 - Trip Customization with Preferences Panel (Priority: P1) 🎯 MVP

**Goal**: Users can see and edit trip preferences (duration, travelers, luxury, activity, departure airport) BEFORE research begins, ensuring AI recommendations match their constraints from the start.

**Independent Test**: Open chat interface and immediately see "Customize My Trip" panel expanded (not collapsed). Change duration to "3-5 days", enter "Tuscany wine tour", verify AI research yields compact geographic clusters (Chianti + Florence only). Collapse panel, verify preferences persist. Re-expand panel, change luxury level, verify trip building (Phase 2) uses updated preferences.

### Implementation for User Story 2

- [ ] T039 [P] [US2] Create preferences panel HTML structure in `public/chat.html` (expanded by default, dropdowns for duration/luxury/activity, number inputs for travelers, text input for departure airport, collapse/expand button)
- [ ] T040 [P] [US2] Create preferences panel styles in `public/css/preferences.css` (expanded state styling, dropdown styling, 44px minimum touch targets, collapsible animation, mobile vertical stacking)
- [ ] T041 [US2] Create preferences panel script in `public/js/preferences.js` (loads default values, handles changes, persists to localStorage, sends preferences with POST /api/trips and updates via POST /api/trips/:id/chat when changed)
- [ ] T042 [US2] Update research service in `functions/services/research-service.ts` to consider preferences (duration affects destination clustering: 3-day trips suggest nearby locations, 14-day trips suggest multi-city tours)
- [ ] T043 [US2] Update chat script in `public/js/chat.js` to integrate preferences panel (includes preferences in API calls, updates UI when preferences change)

**Checkpoint**: At this point, User Stories 1 AND 2 both work independently. Users have full control over trip parameters before research begins.

---

## Phase 5: User Story 3 - Detailed Trip Building with Real Pricing (Priority: P2)

**Goal**: After user confirms destinations, system calls booking APIs (Amadeus flights/hotels, Viator tours) to generate 2-4 detailed trip options with accurate pricing. User selects one option to view day-by-day itinerary and can request travel agent handoff.

**Independent Test**: Use pre-seeded trip with confirmed destinations (Cork, Kinsale, Killarney) and trigger Phase 2 via POST /api/trips/:id/confirm-destinations. System calls flight/hotel/tour APIs, generates 2-4 options with costs, displays in chat. User clicks "See Details" on Option 2, views full itinerary. User clicks "Get a free quote", receives confirmation message.

### Implementation for User Story 3

- [ ] T044 [P] [US3] Implement Amadeus flights client in `functions/services/amadeus-client.ts` (Flight Offers Search API, handles auth, maps luxury level to cabin class, returns 10-15 flight options)
- [ ] T045 [P] [US3] Implement Amadeus hotels client in `functions/services/amadeus-client.ts` (Hotel Search API, maps luxury level to star rating filter, returns 20-30 hotel options per city)
- [ ] T046 [P] [US3] Implement Viator tours client in `functions/services/viator-client.ts` (tours/activities search, uses template.tour_search_instructions and destination_criteria_prompt, returns 15-20 tour options per city)
- [ ] T047 [US3] Implement trip builder service in `functions/services/trip-builder-service.ts` (orchestrates calls to amadeus-client and viator-client, uses template.options_prompt to generate 2-4 trip variations with AI, calculates total costs with 15% margin, stores in options_json)
- [ ] T048 [US3] Update `POST /api/trips/:id/confirm-destinations` endpoint in `functions/api/trips/[id]/confirm-destinations.ts` to call trip-builder-service after setting destinations_confirmed=true (Phase 2 trigger)
- [ ] T049 [US3] Update `GET /api/trips/:id` endpoint to include options_json in response when status='options_ready'
- [ ] T050 [US3] Implement `POST /api/trips/:id/select` endpoint in `functions/api/trips/[id]/select.ts` (validates option_index, stores selection, generates detailed day-by-day itinerary using template.daily_activity_prompt, returns detailed_itinerary)
- [ ] T051 [US3] Implement `POST /api/trips/:id/handoff` endpoint in `functions/api/trips/[id]/handoff.ts` (generates structured handoff document with user contact, selected trip details, costs, special requests, stores in handoff_json, sets status='handoff_sent')
- [ ] T052 [P] [US3] Create trip options display component in `public/js/trip-builder.js` (renders 2-4 trip option cards with costs, flight summaries, hotel tiers, tour counts, "See Details" buttons)
- [ ] T053 [US3] Create detailed itinerary view in `public/js/trip-builder.js` (day-by-day schedule with activities, hotels, meals, costs, "Get a free quote" button)
- [ ] T054 [US3] Update chat script in `public/js/chat.js` to display trip options (calls trip-builder.js to render options, handles "See Details" clicks, handles "Get a free quote" button → POST /api/trips/:id/handoff)
- [ ] T055 [US3] Add Phase 2 progress messages to chat interface (shows "Finding flights...", "Checking hotels...", "Discovering tours..." as trip-builder-service makes API calls, updates via status polling)
- [ ] T056 [US3] Add error handling for API failures in `functions/services/trip-builder-service.ts` (retry once, fall back to generic suggestions if Amadeus/Viator fail, log errors to admin telemetry, show friendly user messages)

**Checkpoint**: All core trip planning functionality complete. Users can research, confirm, build, and request agent handoff end-to-end.

---

## Phase 6: User Story 4 - Template Management and Theme Selection (Priority: P2)

**Goal**: System loads all behavior from database templates. Homepage displays 5 featured themes + "Plan My Trip" generic option. Each theme defines unique research/trip building prompts. New themes can be added via database inserts without code changes.

**Independent Test**: Load homepage, see 6 theme cards. Click "Heritage & Ancestry", verify chat loads with heritage-specific prompts (research_query_template: "{surname} origin country", destination_criteria_prompt: "ancestral towns, genealogy centers"). Click "Wine & Food", verify different prompts loaded. Admin inserts "Photography Tours" template via SQL, refreshes homepage, verifies new theme appears without code deployment.

### Implementation for User Story 4

- [ ] T057 [US4] Update `GET /api/templates` endpoint in `functions/api/templates/index.ts` to load from database dynamically (no hardcoded templates, query WHERE featured=1 AND is_active=1)
- [ ] T058 [US4] Update research service in `functions/services/research-service.ts` to use template fields dynamically (reads research_query_template, destination_criteria_prompt, research_synthesis_prompt from loaded template)
- [ ] T059 [US4] Update trip builder service in `functions/services/trip-builder-service.ts` to use template fields dynamically (reads options_prompt, daily_activity_prompt, number_of_options, tour_search_instructions, hotel_search_instructions from loaded template)
- [ ] T060 [US4] Add template validation in `functions/lib/db.ts` (checks required fields on template load: name, research_query_template, destination_criteria_prompt, options_prompt, logs errors and falls back to generic template if misconfigured)
- [ ] T061 [US4] Update homepage script in `public/js/main.js` to render themes dynamically (no hardcoded theme list, renders cards based on GET /api/templates response)
- [ ] T062 [US4] Update chat script in `public/js/chat.js` to display template-specific UI text (search_placeholder, search_help_text from template, progress_messages from template.progress_messages JSON)
- [ ] T063 [US4] Verify template-driven architecture compliance (audit code for hardcoded theme logic, ensure all behavior comes from database, test adding new template via SQL without code changes)

**Checkpoint**: System is fully template-driven. New trip themes can be added by business users without developer involvement.

---

## Phase 7: User Story 5 - Mobile-Responsive Chat Experience (Priority: P3)

**Goal**: All UI works on mobile devices (320px-768px width). Chat interface, preferences panel, destination cards, trip options, and detailed itineraries are touch-friendly with readable text sizing and proper layout stacking.

**Independent Test**: Open chat interface on iPhone SE (375px width). Verify chat fills screen, preferences panel stacks vertically, text is readable without zooming (16px base font), all buttons/inputs have 44x44px touch targets. Tap destination card, verify it expands without breaking layout. Swipe through trip options, verify smooth transitions. Scroll detailed itinerary, verify "Get a free quote" button stays accessible.

### Implementation for User Story 5

- [ ] T064 [P] [US5] Create mobile-specific CSS in `public/css/mobile.css` (@media queries for 320px-768px widths, base font 16px, touch targets 44px minimum, no horizontal scroll)
- [ ] T065 [US5] Update global styles in `public/css/main.css` for mobile-first design (CSS Grid layout with breakpoints, Flexbox for message bubbles, viewport meta tag in HTML)
- [ ] T066 [US5] Update chat styles in `public/css/chat.css` for mobile (message bubbles max-width 85% on mobile, input box full-width, scrollable chat area with momentum scrolling)
- [ ] T067 [US5] Update preferences panel styles in `public/css/preferences.css` for mobile (stacks vertically on mobile, dropdowns/inputs sized for touch, panel collapses to save space but remains accessible)
- [ ] T068 [US5] Update trip options display in `public/js/trip-builder.js` for mobile (swipeable cards, touch-friendly "See Details" buttons, responsive pricing tables)
- [ ] T069 [US5] Add mobile viewport meta tag to all HTML files (`<meta name="viewport" content="width=device-width, initial-scale=1">`)
- [ ] T070 [US5] Add mobile-specific JavaScript in `public/js/chat.js` (detects slow network, shows "AI is thinking..." indicator for long waits, handles touch events for swipe gestures)
- [ ] T071 [US5] Test mobile responsiveness on 5 devices (iPhone SE 320px, iPhone 14 390px, Samsung Galaxy S21 360px, iPad Mini 768px, Android tablet 800px, verify text readability, touch target sizes, no horizontal scroll)

**Checkpoint**: Full mobile support complete. Users can plan trips end-to-end on phones and tablets.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories, final integration, and production readiness

- [ ] T072 [P] Add loading states to all API calls in `public/js/api-client.js` (shows spinners during fetch, disables buttons to prevent double-submission)
- [ ] T073 [P] Add error recovery to chat interface in `public/js/chat.js` (allows retry of failed messages, shows user-friendly error messages, preserves conversation context)
- [ ] T074 [P] Add request queuing for rate-limited APIs in `functions/services/amadeus-client.ts` and `functions/services/viator-client.ts` (respects Amadeus 10 req/s, Viator 5 req/s limits, queues excess requests)
- [ ] T075 [P] Add session timeout handling (warns user after 20 minutes inactivity, offers to resume conversation within 24 hours, archives state after 24 hours)
- [ ] T076 [P] Add analytics tracking (logs user actions: theme selection, message sent, destinations confirmed, option selected, handoff requested, no PII, respects privacy)
- [ ] T077 [P] Create documentation in `docs/` (API documentation, deployment guide, troubleshooting, template creation guide for business users)
- [ ] T078 [P] Update `README.md` with quickstart instructions (clone, install, configure .env, run migrations, start dev server, test endpoints)
- [ ] T079 Add production environment configuration in `wrangler.toml` (production D1 database binding: voygent-themed, environment-specific secrets)
- [ ] T080 Run quickstart.md validation (follow all steps in quickstart.md, verify local development works, test all endpoints, confirm mobile responsiveness)
- [ ] T081 Performance optimization pass (add caching for templates, optimize AI token usage, compress API responses, minify frontend assets for production)
- [ ] T082 Security hardening (add rate limiting to public endpoints, validate all user inputs, sanitize outputs for XSS prevention, audit for SQL injection vulnerabilities)
- [ ] T083 [P] Code cleanup and linting (run ESLint on TypeScript, Prettier for formatting, remove console.logs, add JSDoc comments to key functions)

**Checkpoint**: Production-ready system. All user stories complete, tested, and optimized.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Integrates with US1 but independently testable (can load preferences panel without research functionality working)
- **User Story 3 (P2)**: Depends on US1 (needs destinations_confirmed from US1) - Cannot test Phase 2 trip building without Phase 1 destination confirmation
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Independent of US1/US2/US3 (template loading is foundational)
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - Overlays mobile styles on existing features, so best done after US1-US4 complete

### Within Each User Story

- Models/Services before endpoints (T010-T019 before T020-T026)
- Backend endpoints before frontend integration (T023-T026 before T032)
- Core implementation before edge case handling (T022 research service before T056 error handling)

### Parallel Opportunities

- All Setup tasks (T001-T006) can run in parallel
- All Foundational tasks marked [P] can run in parallel: T010-T019
- Once Foundational phase completes:
  - US1 tasks marked [P]: T020-T021 (AI providers + search client)
  - US1 tasks marked [P]: T027-T029 (homepage HTML/CSS/JS)
  - US1 tasks marked [P]: T030-T031 (chat HTML/CSS)
  - US1 tasks marked [P]: T035-T036 (templates API endpoints)
  - US1 tasks marked [P]: T038 (auth middleware)
  - US2 tasks marked [P]: T039-T040 (preferences HTML/CSS)
  - US3 tasks marked [P]: T044-T046 (API clients: Amadeus flights/hotels, Viator tours)
  - US3 task marked [P]: T052 (trip options display)
  - US5 tasks marked [P]: T064 (mobile CSS)
  - Polish tasks marked [P]: T072-T078, T083

---

## Parallel Execution Example: User Story 1 (MVP)

After Foundational phase completes (T007-T019):

**Parallel Batch 1** (different backend services, no dependencies):
- T020: AI provider fallback chain in `functions/lib/ai-providers.ts`
- T021: Web search client in `functions/services/search-client.ts`
- T035: GET /api/templates in `functions/api/templates/index.ts`
- T036: GET /api/templates/:id in `functions/api/templates/[id].ts`
- T038: Admin auth middleware in `functions/middleware/auth.ts`

**Sequential**: T022 research service (depends on T020, T021 completing)

**Parallel Batch 2** (API endpoints depend on T022 research service):
- T023: POST /api/trips in `functions/api/trips/index.ts`
- T025: GET /api/trips/:id in `functions/api/trips/[id]/index.ts`
- T026: POST /api/trips/:id/confirm-destinations in `functions/api/trips/[id]/confirm-destinations.ts`
- T037: GET /api/trips/:id/logs in `functions/api/trips/[id]/logs.ts`

**Sequential**: T024 POST /api/trips/:id/chat (depends on T023 completing, needs trip_id)

**Parallel Batch 3** (frontend components, independent of each other):
- T027: Homepage HTML in `public/index.html`
- T028: Homepage styles in `public/css/main.css`
- T030: Chat HTML in `public/chat.html`
- T031: Chat styles in `public/css/chat.css`

**Sequential Frontend Integration**:
- T029: Homepage script (depends on T027, T028, needs HTML structure)
- T032: Chat script (depends on T030, T031, T024, needs HTML + API endpoints)
- T033: Progress messages (depends on T032)
- T034: Admin telemetry panel (depends on T037 logs endpoint)

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (T001-T006)
2. Complete Phase 2: Foundational (T007-T019) — CRITICAL blocking phase
3. Complete Phase 3: User Story 1 (T020-T038)
4. Complete Phase 4: User Story 2 (T039-T043)
5. **STOP and VALIDATE**: Test destination research + preferences independently
6. Deploy MVP to staging, user test, gather feedback

**Rationale**: US1 + US2 deliver core value (destination discovery with preferences) without needing expensive booking APIs. Proves concept, validates user interest before investing in Amadeus/Viator integration.

### Incremental Delivery

1. Complete Setup + Foundational (T001-T019) → Foundation ready
2. Add US1 + US2 (T020-T043) → Test independently → Deploy MVP
3. Add US3 (T044-T056) → Test independently → Deploy Phase 2 trip building
4. Add US4 (T057-T063) → Test independently → Deploy multi-theme support
5. Add US5 (T064-T071) → Test independently → Deploy mobile support
6. Add Polish (T072-T083) → Final production release

Each phase adds value without breaking previous functionality.

### Parallel Team Strategy

With 3 developers after Foundational phase completes:

- **Developer A**: User Story 1 (T020-T038) - destination research
- **Developer B**: User Story 2 (T039-T043) - preferences panel
- **Developer C**: User Story 4 (T057-T063) - template management

After US1/US2 complete (MVP validated):
- **Developer A**: User Story 3 (T044-T056) - trip building
- **Developer B**: User Story 5 (T064-T071) - mobile support
- **Developer C**: Polish (T072-T083) - cross-cutting concerns

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable (checkpoints after each phase)
- All tasks have absolute file paths from repository root
- Foundational phase (T007-T019) is CRITICAL and blocks all user stories
- MVP = US1 + US2 (destination research + preferences)
- Commit after each task or logical group
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence

---

## Total Task Count: 83

**By User Story**:
- Setup: 6 tasks
- Foundational (BLOCKING): 13 tasks
- User Story 1 (P1 MVP): 19 tasks
- User Story 2 (P1 MVP): 5 tasks
- User Story 3 (P2): 13 tasks
- User Story 4 (P2): 7 tasks
- User Story 5 (P3): 8 tasks
- Polish: 12 tasks

**Parallel Opportunities**: 38 tasks marked [P] can run in parallel (45% of total)

**MVP Scope**: T001-T043 (43 tasks) = User Stories 1 + 2 = Destination research + preferences panel

**Independent Testing**: Each user story has clear checkpoint with test criteria for independent validation
