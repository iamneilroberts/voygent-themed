# Feature Specification: End-to-End Test Suite for Full MVP

**Feature Branch**: `002-end-to-end`
**Created**: 2025-10-09
**Status**: Draft
**Input**: User description: "end-to-end test for Full MVP"

## Clarifications

### Session 2025-10-09

- Q: Should tests use real external APIs or mocked responses for reliability? → A: Use real external APIs for all tests (higher fidelity, but slower and may incur costs)
- Q: How should performance tests handle runs that exceed time targets? → A: Warning-only approach - performance tests report metrics but never fail the test suite (informational only)
- Q: What pass rate threshold qualifies a build for production promotion? → A: Standard threshold applies - 100% P1 + 95% P2 = production-ready (no additional gates required)
- Q: How should tests handle cost accumulation and budget limits? → A: Informational tracking only - log all costs for analysis but never fail tests or block execution based on cost thresholds

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Critical Path Validation (Priority: P1)

A QA engineer or developer needs to validate that the complete user journey from theme selection through trip option selection works correctly across both Phase 1 (destination research) and Phase 2 (trip building) of the application.

**Why this priority**: This is the core MVP functionality that must work for the application to be viable. Without this working end-to-end, users cannot plan trips.

**Independent Test**: Can be fully tested by running an automated test that simulates a user selecting a trip theme, providing initial input, confirming destinations, and selecting a trip option. Delivers confidence that the critical path works without manual intervention.

**Acceptance Scenarios**:

1. **Given** the application is running, **When** a user selects the "Heritage & Ancestry" theme and enters "Sullivan family from Cork, Ireland", **Then** the system creates a trip, begins destination research, and displays progress updates
2. **Given** destination research is complete, **When** the AI presents 2-4 destination recommendations, **Then** the user can view destination details including name, context, rationale, and estimated days
3. **Given** destinations are displayed, **When** the user confirms the recommended destinations with preferences (duration, departure airport, travelers, luxury level), **Then** the system transitions to trip building phase
4. **Given** trip building is in progress, **When** the system searches for flights, hotels, and tours, **Then** progress updates are shown and the process completes within 3 minutes
5. **Given** trip building is complete, **When** 2-4 trip options are generated, **Then** each option displays total cost, flight details, hotel count, and tour count
6. **Given** trip options are displayed, **When** the user selects one option, **Then** the system marks it as selected and updates the trip status

---

### User Story 2 - API Endpoint Validation (Priority: P1)

A QA engineer needs to verify that all API endpoints respond correctly with expected data formats, handle errors gracefully, and enforce phase gate restrictions.

**Why this priority**: API reliability is critical for the frontend to function correctly. Broken endpoints or incorrect data formats will break the user experience.

**Independent Test**: Can be fully tested by making direct API calls to each endpoint with various inputs (valid, invalid, edge cases) and verifying response codes, data structures, and error messages match the API specification.

**Acceptance Scenarios**:

1. **Given** no trips exist, **When** GET /api/templates is called, **Then** the response contains an array of featured templates with id, name, description, icon, and search_placeholder fields
2. **Given** a valid template_id and initial_message, **When** POST /api/trips is called, **Then** a new trip is created and returns trip_id and status "researching"
3. **Given** a trip exists, **When** GET /api/trips/:id is called, **Then** the response contains complete trip state including status, progress, destinations, and options (if ready)
4. **Given** a trip with destinations not confirmed, **When** POST /api/trips/:id/confirm-destinations is called without destinations_confirmed flag, **Then** the system rejects Phase 2 API calls with 403 error
5. **Given** trip options are ready, **When** POST /api/trips/:id/select is called with valid option_index, **Then** the selected option is stored and detailed itinerary is returned
6. **Given** an invalid trip_id, **When** any trip endpoint is called, **Then** the system returns 404 error with appropriate message

---

### User Story 3 - Performance and Reliability Validation (Priority: P2)

A QA engineer needs to verify that the system performs within acceptable time limits and handles concurrent users, rate limiting, and timeout scenarios.

**Why this priority**: Users expect responsive applications. Slow response times or failures under load will lead to poor user experience and abandonment.

**Independent Test**: Can be fully tested by running load tests with multiple concurrent users, measuring response times for each phase, and verifying the system handles errors gracefully when external APIs fail or time out.

**Acceptance Scenarios**:

1. **Given** the application is under normal load, **When** a user creates a trip, **Then** destination research completes within 60 seconds
2. **Given** destinations are confirmed, **When** trip building starts, **Then** trip options are generated within 3 minutes
3. **Given** 10 concurrent users create trips simultaneously, **When** all trips are processing, **Then** each user receives progress updates and all trips complete successfully
4. **Given** an external API (Amadeus, Viator, or web search) times out, **When** the system attempts to call it, **Then** fallback providers are tried and an error message is shown if all fail
5. **Given** the AI provider rate limit is reached, **When** another AI request is made, **Then** the system tries fallback providers in order (Z.AI → OpenRouter → backup)

---

### User Story 4 - Data Integrity and State Management (Priority: P2)

A QA engineer needs to validate that trip data is correctly stored, retrieved, and updated throughout the user journey, and that state transitions follow the correct sequence.

**Why this priority**: Data corruption or incorrect state transitions will break the user experience and may require manual database fixes. This ensures data reliability.

**Independent Test**: Can be fully tested by creating a trip, progressing through each status (chat → researching → awaiting_confirmation → building_trip → options_ready → option_selected), and verifying database contents match expected values at each stage.

**Acceptance Scenarios**:

1. **Given** a new trip is created, **When** checking the database, **Then** the trip record contains template_id, chat_history with initial message, preferences_json, and status "chat"
2. **Given** destination research completes, **When** checking the trip record, **Then** research_destinations contains 2-4 destination objects with all required fields
3. **Given** destinations are confirmed, **When** checking the trip record, **Then** destinations_confirmed is 1, confirmed_destinations array is populated, and status is "building_trip"
4. **Given** trip building completes, **When** checking the trip record, **Then** options_json contains 2-4 trip options with flights, hotels, tours, and pricing
5. **Given** a trip option is selected, **When** checking the trip record, **Then** selected_option_index matches the chosen option and status is "option_selected"
6. **Given** AI and API calls are made, **When** checking the trip record, **Then** telemetry_logs contains all events, ai_cost_usd and api_cost_usd are accumulated correctly

---

### User Story 5 - Mobile Responsiveness Validation (Priority: P3)

A QA engineer needs to verify that the application works correctly on mobile devices with various screen sizes, touch interactions work properly, and the layout adapts appropriately.

**Why this priority**: Mobile users expect a good experience. While less critical than core functionality, mobile responsiveness is important for user satisfaction and accessibility.

**Independent Test**: Can be fully tested by running tests in mobile viewports (320px, 768px, 1024px widths), verifying touch targets are minimum 44x44px, and checking that all functionality works without horizontal scrolling.

**Acceptance Scenarios**:

1. **Given** a viewport width of 320px, **When** the homepage loads, **Then** template cards stack vertically and all text is readable without horizontal scrolling
2. **Given** a mobile device, **When** the user taps on a template card, **Then** the touch target is at least 44x44px and the action triggers correctly
3. **Given** the chat interface on mobile, **When** the user types a message, **Then** the input field and send button are accessible without zooming
4. **Given** trip options display on mobile, **When** scrolling through options, **Then** each option card is fully visible and selectable without overlap
5. **Given** a tablet viewport (768px), **When** viewing the chat interface, **Then** the layout switches to 2-column grid for trip options

---

### Edge Cases

- What happens when the user provides an empty message in the chat?
- What happens when AI providers return malformed JSON that cannot be parsed?
- What happens when all search providers (Serper, Tavily) fail simultaneously?
- What happens when Amadeus API returns zero flight results?
- What happens when Viator API returns zero tour results?
- What happens when the user tries to select an option_index that doesn't exist?
- What happens when the user tries to confirm destinations before research is complete?
- What happens when the database connection fails mid-operation?
- What happens when the user navigates away during trip building and returns later?
- What happens when two users try to update the same trip simultaneously?
- What happens when trip building takes longer than 5 minutes?
- What happens when the cost tracking shows a trip exceeding the $0.50 target?

## Requirements *(mandatory)*

### Functional Requirements

#### Test Infrastructure

- **FR-001**: Test suite MUST be able to run against local development environment (wrangler dev)
- **FR-002**: Test suite MUST be able to run against production environment with configuration changes
- **FR-003**: Test suite MUST generate detailed test reports showing pass/fail status for each scenario
- **FR-004**: Test suite MUST capture screenshots or logs on test failures for debugging
- **FR-005**: Test suite MUST support running individual test suites or all tests together

#### API Testing

- **FR-006**: Tests MUST validate all API endpoints return correct HTTP status codes (200, 201, 400, 403, 404, 500)
- **FR-007**: Tests MUST validate response data structures match OpenAPI specifications
- **FR-008**: Tests MUST verify CORS headers are present on all API responses
- **FR-009**: Tests MUST validate error responses contain error messages in expected format
- **FR-010**: Tests MUST verify phase gate enforcement (403 errors when destinations not confirmed)

#### End-to-End User Flows

- **FR-011**: Tests MUST simulate complete user journey from homepage to trip option selection
- **FR-012**: Tests MUST wait for asynchronous operations (research, trip building) to complete
- **FR-013**: Tests MUST verify polling mechanism retrieves updated trip state every 3 seconds
- **FR-014**: Tests MUST validate chat message history persists correctly
- **FR-015**: Tests MUST verify preferences are applied when confirming destinations

#### Data Validation

- **FR-016**: Tests MUST verify database records are created with all required fields
- **FR-017**: Tests MUST verify JSON fields (chat_history, research_destinations, options_json) parse correctly
- **FR-018**: Tests MUST validate destination objects contain all required attributes (name, geographic_context, rationale, estimated_days)
- **FR-019**: Tests MUST validate trip option objects contain flights, hotels, tours, and total_cost_usd
- **FR-020**: Tests MUST verify telemetry logs accumulate costs correctly

#### Performance Testing

- **FR-021**: Tests MUST measure and report time taken for destination research (target: <60 seconds) - informational only, does not fail tests
- **FR-022**: Tests MUST measure and report time taken for trip building (target: <3 minutes) - informational only, does not fail tests
- **FR-023**: Tests MUST verify system handles at least 10 concurrent trip creations
- **FR-024**: Tests MUST validate progress updates occur at regular intervals during long operations

#### Error Handling

- **FR-025**: Tests MUST verify graceful degradation when external APIs fail (retry with fallback providers)
- **FR-026**: Tests MUST validate error messages are user-friendly (no stack traces exposed)
- **FR-027**: Tests MUST verify system recovers from transient failures (network timeouts, rate limits)
- **FR-028**: Tests MUST validate system prevents invalid state transitions

#### Mobile Responsiveness

- **FR-029**: Tests MUST verify layout adapts correctly at breakpoints (320px, 768px, 1024px)
- **FR-030**: Tests MUST validate touch targets meet minimum size requirements (44x44px)
- **FR-031**: Tests MUST verify no horizontal scrolling occurs on mobile viewports
- **FR-032**: Tests MUST validate all interactive elements are accessible on touch devices

### Key Entities

- **Test Suite**: Collection of automated tests covering user stories, API endpoints, performance, and edge cases
- **Test Report**: Document showing pass/fail results, execution time, screenshots/logs on failures
- **Test Environment**: Configuration specifying which environment to test (local, staging, production)
- **Test Fixture**: Sample data (template IDs, user inputs, preferences) used to run tests consistently

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Production Readiness Threshold**: A build is considered production-ready when SC-001 (100% P1 pass rate) and SC-002 (95% P2 pass rate) are met, with no additional approval gates required.

- **SC-001**: All P1 user stories (Critical Path and API Validation) pass 100% of acceptance scenarios
- **SC-002**: All P2 user stories (Performance and Data Integrity) pass at least 95% of acceptance scenarios
- **SC-003**: Test suite execution completes in under 10 minutes for all tests
- **SC-004**: Destination research completes within 60 seconds in 95% of test runs (informational metric, does not fail build)
- **SC-005**: Trip building completes within 3 minutes in 90% of test runs (informational metric, does not fail build)
- **SC-006**: System handles 10 concurrent users with 100% success rate
- **SC-007**: All API endpoints return correct data structures validated against schemas
- **SC-008**: Zero critical bugs (data corruption, security vulnerabilities, crashes) are found
- **SC-009**: Mobile responsiveness tests pass at all three breakpoints (320px, 768px, 1024px)
- **SC-010**: Test failure rate due to flakiness (intermittent failures) is below 5%
- **SC-011**: All edge cases are tested and handled gracefully with appropriate error messages
- **SC-012**: Average AI cost per tested trip is below $0.50 USD (informational metric, does not fail build or block execution)

## Scope *(mandatory)*

### In Scope

- Automated end-to-end tests for complete user journey (Phase 1 + Phase 2)
- API endpoint testing for all routes defined in contracts/trips-api.yaml and contracts/templates-api.yaml
- Performance testing for concurrent users and operation timeouts
- Data integrity validation for database records and JSON fields
- Mobile responsiveness testing at defined breakpoints
- Error handling and fallback provider testing
- Phase gate enforcement validation

### Out of Scope

- Unit tests for individual functions or components
- Security penetration testing or vulnerability scanning
- Load testing beyond 10 concurrent users
- Browser compatibility testing beyond Chromium-based browsers
- Accessibility testing (WCAG compliance)
- Internationalization testing (i18n)
- Payment processing testing (not yet implemented in MVP)
- Travel agent handoff workflow testing (minimal implementation in MVP)
- Production deployment automation or CI/CD pipeline setup

## Assumptions *(mandatory)*

1. **Testing Framework**: Playwright is used for end-to-end tests (supports browser automation, API testing, and mobile viewports)
2. **Test Environment**: Tests run against local development environment by default (wrangler dev with local D1 database)
3. **External API Availability**: Tests use real external APIs (Amadeus, Viator, Serper/Tavily, Z.AI/OpenRouter) for higher test fidelity, accepting longer execution times and potential API costs
4. **API Keys**: Valid API keys for all external services are configured in test environment
5. **Database State**: Each test starts with a clean database state (migrations applied, templates seeded)
6. **Test Data**: Predefined test fixtures provide consistent inputs (template IDs, user messages, preferences)
7. **Timeouts**: Default test timeouts are set to 5 minutes to account for AI processing and API calls
8. **Network Conditions**: Tests assume stable network connection (flakiness from network issues is acceptable at <5% rate)
9. **Cost Tracking**: Tests track and report all API and AI costs for analysis purposes, but costs never cause test failures or block execution
10. **Mobile Testing**: Tests use device emulation in Playwright rather than real mobile devices

## Dependencies *(mandatory)*

### External Dependencies

- **Amadeus API**: Required for flight and hotel search in Phase 2 tests
- **Viator API**: Required for tour search in Phase 2 tests
- **Web Search (Serper/Tavily)**: Required for destination research in Phase 1 tests
- **AI Providers (Z.AI/OpenRouter)**: Required for AI-generated responses and trip options

### Internal Dependencies

- **Wrangler CLI**: Required to run local development server and execute D1 commands
- **D1 Database**: Required for storing trip data and templates
- **Cloudflare Pages Functions**: Required for API endpoint execution
- **Template Seed Data**: Heritage & Ancestry template must be seeded in database before tests run

### Test Dependencies

- **Playwright**: End-to-end testing framework
- **Node.js 18+**: Required to run Playwright and test scripts
- **Database Migrations**: Must be applied before running tests (0001_create_trip_templates.sql, 0002_create_themed_trips.sql)

## Open Questions *(optional)*

- Should performance tests include load testing beyond 10 concurrent users?
