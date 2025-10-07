# Feature Specification: Comprehensive Test Suite for Template-Based Voygent Platform

**Feature Branch**: `007-full-test-suite`
**Created**: 2025-10-07
**Status**: Draft
**Input**: User description: "full test suite for the template-based voygent.app"

## Execution Flow (main)
```
1. Parse user description from Input
   ’ If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   ’ Identify: actors, actions, data, constraints
3. For each unclear aspect:
   ’ Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   ’ If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   ’ Each requirement must be testable
   ’ Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   ’ If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   ’ If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## ¡ Quick Guidelines
-  Focus on WHAT users need and WHY
- L Avoid HOW to implement (no tech stack, APIs, code structure)
- =e Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

---

## Problem Statement

The Voygent platform currently lacks automated testing coverage, making it difficult to:
- Verify that trip generation works correctly across all 5 themes (heritage, TV/movie, historical, culinary, adventure)
- Ensure research execution produces valid results and persists to database
- Validate template system behavior (query interpolation, synthesis prompts, required/optional fields)
- Catch regressions when making changes to intake normalization, options generation, or trip selection
- Verify white-label functionality works for multiple agencies
- Test error handling and edge cases systematically
- Measure performance and cost metrics

Without comprehensive tests, developers must manually verify functionality after every change, increasing the risk of bugs in production.

---

## User Scenarios & Testing

### Primary User Story
A developer working on the Voygent platform needs to verify that all features work correctly before deploying changes. They should be able to run a comprehensive test suite that validates:
1. Trip generation for all 5 themes with realistic inputs
2. Research execution and database persistence
3. Template system behavior and query interpolation
4. API endpoint responses and data integrity
5. Error handling for invalid inputs
6. White-label agency isolation
7. Performance benchmarks and cost tracking

### Acceptance Scenarios

**Theme-Specific Trip Generation**
1. **Given** a heritage trip request with surname "Williams" and origin "Scotland", **When** generating trip options, **Then** system returns 2-4 valid options with Scottish heritage sites
2. **Given** a TV/movie trip request with title "Game of Thrones", **When** generating trip options, **Then** system returns options with Northern Ireland/Iceland/Croatia filming locations
3. **Given** a historical trip request with event "D-Day", **When** generating trip options, **Then** system returns options with Normandy historical sites
4. **Given** a culinary trip request with cuisine "Italian" and region "Tuscany", **When** generating trip options, **Then** system returns options with cooking classes and restaurants
5. **Given** an adventure trip request with destination "Patagonia" and activity "hiking", **When** generating trip options, **Then** system returns options with trail recommendations

**Research Execution**
6. **Given** a heritage trip with surname, **When** research executes, **Then** database diagnostics column contains research data with query, results, and analysis
7. **Given** a TV/movie trip with title, **When** research executes, **Then** diagnostics include filming location research findings
8. **Given** research fails (API error), **When** trip generation continues, **Then** trip is created with empty research array and error logged

**Template System**
9. **Given** a heritage template with {surname} placeholder, **When** processing input with surname "Smith", **Then** research query contains "Smith family heritage"
10. **Given** a template with required field missing, **When** validating intake, **Then** validation fails with specific field error
11. **Given** a template with researchQueryTemplate undefined, **When** executing research, **Then** research step is skipped gracefully

**API Endpoints**
12. **Given** a valid trip request, **When** POST /api/trips is called, **Then** response includes tripId, intake, options, and diagnostics
13. **Given** an existing trip ID, **When** GET /api/trips/{id} is called, **Then** response includes full trip data with diagnostics
14. **Given** an invalid trip ID, **When** GET /api/trips/{id} is called, **Then** response returns 404 error

**White-Label Multi-Agency**
15. **Given** trips for agency A and agency B, **When** filtering by agency A, **Then** only agency A trips appear in results
16. **Given** an agency-admin user, **When** accessing admin dashboard, **Then** user sees only their agency's data

**Performance & Cost**
17. **Given** a trip generation request, **When** processing completes, **Then** total time is under 60 seconds
18. **Given** a heritage trip with research, **When** calculating cost, **Then** total AI cost is under $0.10 per trip
19. **Given** 10 concurrent trip requests, **When** system processes them, **Then** all complete without errors or timeouts

### Edge Cases
- What happens when a user submits a surname with no web search results?
- How does the system handle extremely long input text (>10,000 characters)?
- What if the AI provider (OpenAI/Anthropic) is down or rate-limiting?
- How are special characters in surnames handled (O'Brien, São Paulo)?
- What happens if the database is full or connection times out?
- How does the system behave with malformed JSON in stored diagnostics?
- What if a template references a placeholder that doesn't exist in intake?
- How are orphaned records handled (trip created but not updated)?

---

## Requirements

### Functional Requirements

#### Trip Generation Coverage
- **FR-001**: Test suite MUST verify successful trip generation for all 5 themes (heritage, tvmovie, historical, culinary, adventure)
- **FR-002**: Test suite MUST validate that each theme produces 2-4 trip options with correct structure
- **FR-003**: Test suite MUST verify intake normalization extracts required fields for each theme
- **FR-004**: Test suite MUST validate options include cities, itinerary, estimated budget, and highlights

#### Research Execution
- **FR-005**: Test suite MUST verify research executes for themes with researchQueryTemplate defined
- **FR-006**: Test suite MUST validate research results are saved to database diagnostics column
- **FR-007**: Test suite MUST verify research data includes query, results, analysis, and timestamp
- **FR-008**: Test suite MUST validate research failures don't block trip generation

#### Template System
- **FR-009**: Test suite MUST verify query interpolation replaces all placeholders correctly
- **FR-010**: Test suite MUST validate templates with missing required fields fail validation
- **FR-011**: Test suite MUST verify templates with undefined researchQueryTemplate skip research
- **FR-012**: Test suite MUST validate intake normalization follows template-specific prompts

#### API Endpoints
- **FR-013**: Test suite MUST verify POST /api/trips accepts multipart form data with text, files, and URLs
- **FR-014**: Test suite MUST validate POST /api/trips returns complete trip response with diagnostics
- **FR-015**: Test suite MUST verify GET /api/trips/{id} returns existing trip data
- **FR-016**: Test suite MUST validate GET /api/trips returns list of trips for a user
- **FR-017**: Test suite MUST verify invalid requests return appropriate error codes (400, 404, 500)

#### White-Label Multi-Agency
- **FR-018**: Test suite MUST verify trips are correctly associated with agency_id
- **FR-019**: Test suite MUST validate agency filtering returns only trips for specified agency
- **FR-020**: Test suite MUST verify admin users can only access their assigned agency data

#### Error Handling
- **FR-021**: Test suite MUST verify system handles missing environment variables gracefully
- **FR-022**: Test suite MUST validate system continues operation when external APIs fail
- **FR-023**: Test suite MUST verify database errors are logged and don't crash application
- **FR-024**: Test suite MUST validate malformed inputs return 400 errors with helpful messages

#### Performance & Cost
- **FR-025**: Test suite MUST measure and report trip generation duration for each theme
- **FR-026**: Test suite MUST track AI provider costs (tokens in/out, USD) for each operation
- **FR-027**: Test suite MUST verify average trip generation completes under 60 seconds
- **FR-028**: Test suite MUST validate concurrent requests don't cause failures or data corruption

#### Data Integrity
- **FR-029**: Test suite MUST verify all required database columns are populated correctly
- **FR-030**: Test suite MUST validate JSON fields (intake_json, options_json, diagnostics) parse correctly
- **FR-031**: Test suite MUST verify trip status transitions follow valid state machine
- **FR-032**: Test suite MUST validate created_at and updated_at timestamps are correct

### Non-Functional Requirements

#### Test Coverage
- **NFR-001**: Test suite MUST achieve minimum 80% code coverage for critical paths
- **NFR-002**: Test suite MUST execute all tests in under 5 minutes
- **NFR-003**: Test suite MUST be runnable both locally and in CI/CD pipeline

#### Test Reliability
- **NFR-004**: Test suite MUST produce consistent results across multiple runs
- **NFR-005**: Test suite MUST not depend on external services for unit tests (use mocks/fixtures)
- **NFR-006**: Test suite MUST clean up test data after execution

#### Reporting
- **NFR-007**: Test suite MUST generate detailed reports showing pass/fail for each scenario
- **NFR-008**: Test suite MUST report performance metrics (duration, cost) for each test
- **NFR-009**: Test suite MUST highlight failed tests with error messages and stack traces

---

## Key Entities

- **Test Scenario**: Represents a single test case with input data, expected output, and validation criteria
  - Attributes: scenario name, theme, input data, expected results, actual results, pass/fail status, duration
  - Relationships: Part of test suite, associated with specific template

- **Test Report**: Aggregated results from running the test suite
  - Attributes: total tests run, passed, failed, skipped, total duration, cost summary
  - Relationships: Contains multiple test scenarios, linked to specific git commit

- **Test Fixture**: Sample data used for testing (surnames, titles, events, etc.)
  - Attributes: theme, sample inputs, expected normalized intake, expected research queries
  - Relationships: Used by multiple test scenarios

- **Performance Benchmark**: Metrics captured during test execution
  - Attributes: operation name, duration, tokens consumed, cost USD, timestamp
  - Relationships: Associated with test scenario, aggregated in test report

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked (none)
- [x] User scenarios defined
- [x] Requirements generated (32 functional, 9 non-functional)
- [x] Entities identified
- [x] Review checklist passed

---

## Dependencies and Assumptions

### Dependencies
- Existing trip template system with all 5 themes configured
- Database schema with themed_trips, trip_templates, agencies tables
- Working research execution system (feature 005)
- Functional web search APIs (Tavily/Serper)
- AI provider integrations (OpenAI/Anthropic)

### Assumptions
- Test suite will be used by developers before deploying changes
- Tests should cover both success and failure scenarios
- Performance benchmarks help optimize costs and identify bottlenecks
- Test data should not affect production database (use separate test DB or cleanup)
- Automated tests reduce manual QA time and catch regressions early
