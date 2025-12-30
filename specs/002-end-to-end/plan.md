# Implementation Plan: End-to-End Test Suite for Full MVP

**Branch**: `002-end-to-end` | **Date**: 2025-10-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-end-to-end/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a comprehensive end-to-end test suite using Playwright to validate the complete VoyGent V3 MVP user journey from theme selection through trip option selection. Tests will cover critical path validation, API endpoint correctness, performance monitoring, data integrity, and mobile responsiveness across both Phase 1 (destination research) and Phase 2 (trip building). All tests will use real external APIs (Amadeus, Viator, web search, AI providers) for high fidelity, with informational-only metrics for performance and cost tracking that never block test execution. Production readiness threshold: 100% P1 pass rate + 95% P2 pass rate.

## Technical Context

**Language/Version**: JavaScript (Node.js 18+)
**Primary Dependencies**: Playwright (end-to-end testing framework), wrangler CLI (Cloudflare development server)
**Storage**: D1 (SQLite) - local database for test environment
**Testing**: Playwright for E2E browser automation, API testing, and mobile viewport emulation
**Target Platform**: Cloudflare Pages Functions (serverless TypeScript backend), modern Chromium-based browsers (frontend)
**Project Type**: Web application with E2E test suite
**Performance Goals**: Test suite completes in <10 minutes, destination research measured at <60s (informational), trip building measured at <3min (informational)
**Constraints**: 100% P1 test pass rate required, 95% P2 pass rate required, <5% test flakiness acceptable, tests use real external APIs (no mocks)
**Scale/Scope**: 5 user stories (2 P1, 2 P2, 1 P3), 32 functional requirements, 12 success criteria, 12 edge cases, testing 10 concurrent users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Evaluation (Pre-Research)

#### ✅ Template-Driven Architecture (NON-NEGOTIABLE)
**Status**: PASS - Tests validate template-driven behavior, do not introduce hardcoded theme logic.

**Analysis**: E2E tests will use the existing "Heritage & Ancestry" template from the database as test fixture data. Tests verify that template-driven architecture works correctly by creating trips with template_id references and validating that behavior comes from database templates. No hardcoded theme logic is introduced.

#### ✅ Two-Phase Conversational Workflow
**Status**: PASS - Tests validate phase gate enforcement and two-phase workflow.

**Analysis**: User Story 1 (Critical Path) explicitly tests the complete two-phase journey. User Story 2 (API Validation) includes acceptance scenario #4 that validates phase gate enforcement (403 error when destinations not confirmed). Functional requirement FR-010 mandates phase gate testing. Tests verify the workflow rather than modify it.

#### ✅ Chat-Based Conversational Interface
**Status**: PASS - Tests validate chat interface functionality.

**Analysis**: User Story 1 tests chat message submission, User Story 5 validates mobile chat interface usability. Tests verify that chat interface works correctly without modifying the conversational approach.

#### ✅ Two-Tier Progress Feedback
**Status**: PASS - Tests validate progress feedback without exposing technical details.

**Analysis**: Functional requirements FR-012 and FR-024 validate that progress updates occur correctly. Tests verify user-facing progress messages are displayed but do not test admin telemetry visibility (out of scope per specification).

#### ✅ API Cost Optimization
**Status**: PASS - Tests track costs but never block execution based on cost thresholds.

**Analysis**: Success criterion SC-012 validates that average AI cost per trip is <$0.50 USD but is marked as informational only. Functional requirement FR-020 tracks telemetry costs. Clarification #4 confirms costs never fail tests or block execution. Tests support cost optimization by providing visibility without enforcing budget gates.

#### ✅ Mobile-First Responsive Design
**Status**: PASS - Tests validate mobile responsiveness at required breakpoints.

**Analysis**: User Story 5 (P3) includes 5 acceptance scenarios for mobile responsiveness at 320px, 768px, and 1024px breakpoints. Functional requirements FR-029 through FR-032 mandate mobile testing. Tests enforce the mobile-first principle.

#### ✅ Technology Stack (NON-NEGOTIABLE)
**Status**: PASS - Tests validate existing Cloudflare + D1 + vanilla JS stack.

**Analysis**: Tests run against the existing technology stack (Cloudflare Pages Functions, D1 database, vanilla HTML/CSS/JS frontend). Playwright is added as a dev dependency for testing purposes only, does not modify production stack.

#### ✅ Database Schema Rules
**Status**: PASS - Tests validate schema compliance.

**Analysis**: User Story 4 (Data Integrity) includes 6 acceptance scenarios that validate database records contain required fields (chat_history, research_destinations, destinations_confirmed, confirmed_destinations, status, telemetry_logs). Functional requirements FR-016 through FR-020 mandate data validation. Tests enforce schema rules.

#### ✅ Specification-First Development
**Status**: PASS - This feature follows specification workflow.

**Analysis**: Feature created with `/speckit.specify`, clarified with `/speckit.clarify`, now being planned with `/speckit.plan`. Full compliance with specification-first development principle.

#### ✅ Backend Endpoints (Standard Structure)
**Status**: PASS - Tests validate standard endpoint structure.

**Analysis**: User Story 2 (API Validation) tests all required endpoints: GET /api/templates, POST /api/trips, GET /api/trips/:id, POST /api/trips/:id/confirm-destinations, POST /api/trips/:id/select. Tests validate the standard endpoint structure rather than introduce deviations.

#### ✅ No V1 Copy-Paste
**Status**: PASS - Tests are new implementation for V3 architecture.

**Analysis**: E2E test suite is entirely new for V3. No V1 code is being copied. Tests validate V3's template-driven architecture and two-phase workflow that eliminate V1's hardcoded logic problems.

### Result: ✅ ALL GATES PASSED - Proceed to Phase 0 Research

## Project Structure

### Documentation (this feature)

```
specs/002-end-to-end/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
├── checklists/
│   └── requirements.md  # Spec quality checklist (already exists)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
tests/                   # NEW: E2E test suite directory
├── e2e/
│   ├── critical-path.spec.js        # User Story 1: Critical path validation
│   ├── api-endpoints.spec.js        # User Story 2: API validation
│   ├── performance.spec.js          # User Story 3: Performance & reliability
│   ├── data-integrity.spec.js       # User Story 4: Data integrity & state
│   ├── mobile-responsive.spec.js    # User Story 5: Mobile responsiveness
│   └── edge-cases.spec.js           # Edge case scenarios
├── fixtures/
│   ├── templates.json               # Test fixture data (template IDs, messages)
│   └── preferences.json             # Test fixture data (user preferences)
├── helpers/
│   ├── database.js                  # Database setup/teardown utilities
│   ├── api-client.js                # API call helpers for tests
│   └── cost-tracker.js              # Cost accumulation tracking helper
└── playwright.config.js             # Playwright configuration

package.json             # UPDATED: Add Playwright dev dependency and test scripts
```

**Structure Decision**: This feature adds a new `tests/` directory at repository root with E2E tests organized by user story priority. Each test file maps to one user story from the specification, making it easy to track which tests validate which requirements. Test fixtures provide consistent sample data (template IDs, user inputs, preferences) for repeatable test execution. Helper utilities manage database state, API calls, and cost tracking to avoid duplication across test files.

## Complexity Tracking

*No constitution violations identified - this section is empty.*

---

## Phase 0: Research (Complete)

All research has been completed and documented in [research.md](./research.md).

**Key Decisions**:
- Use Playwright with TypeScript for E2E testing
- Real external APIs (no mocks) per clarification #1
- Hybrid fixture pattern (Fishery factories + JSON data)
- Polling with `expect.poll()` for async operations
- Custom reporters for performance and cost tracking (informational only)

**Output**: research.md

---

## Phase 1: Design & Contracts (Complete)

### Data Model

Entities defined in [data-model.md](./data-model.md):
- TestSuite, TestCase, TestResult, TestError
- TestReport, TestSummary, SuiteResult
- TestFixture, TestEnvironment
- ApiCall, PerformanceMetrics

### Contracts

JSON schemas generated in [contracts/](./contracts/):
- `test-config-schema.json` - Test configuration validation
- `test-report-schema.json` - Test report validation

### Quick Start Guide

Setup instructions documented in [quickstart.md](./quickstart.md).

### Agent Context

Updated `.claude/CLAUDE.md` with:
- JavaScript (Node.js 18+)
- Playwright testing framework
- D1 (SQLite) database

---

## Post-Design Constitution Check

Re-evaluating constitution compliance after Phase 1 design:

### ✅ Template-Driven Architecture (NON-NEGOTIABLE)
**Status**: PASS - Design preserves template-driven architecture.

**Analysis**: Test suite validates that the application uses templates from database. Test fixtures reference template IDs from database. No hardcoded theme logic introduced by tests.

### ✅ Two-Phase Conversational Workflow
**Status**: PASS - Design validates two-phase workflow.

**Analysis**: Tests explicitly validate Phase 1 (destination research) and Phase 2 (trip building) separation. `pollForTripStatus()` helper tracks status transitions through both phases.

### ✅ Chat-Based Conversational Interface
**Status**: PASS - Design validates chat interface.

**Analysis**: Tests verify chat message submission, AI responses, and chat history persistence. Mobile tests validate chat interface usability.

### ✅ Two-Tier Progress Feedback
**Status**: PASS - Design validates progress feedback.

**Analysis**: Tests verify progress updates appear to users. Admin telemetry testing is out of scope but doesn't violate principle.

### ✅ API Cost Optimization
**Status**: PASS - Design supports cost optimization.

**Analysis**: Cost tracking provides visibility into per-trip costs. Informational reporting (per clarification #4) supports optimization without blocking tests.

### ✅ Mobile-First Responsive Design
**Status**: PASS - Design enforces mobile-first principle.

**Analysis**: Mobile viewport testing (320px, 768px, 1024px) validates responsive design. Touch target testing (44x44px) validates mobile usability.

### ✅ Technology Stack (NON-NEGOTIABLE)
**Status**: PASS - Design validates existing stack.

**Analysis**: Tests validate Cloudflare Pages + Functions, D1 database, vanilla HTML/CSS/JS frontend. Playwright is added as dev dependency only.

### ✅ Database Schema Rules
**Status**: PASS - Design validates schema compliance.

**Analysis**: Data integrity tests validate all required fields (chat_history, research_destinations, destinations_confirmed, confirmed_destinations, status, telemetry_logs).

### ✅ Specification-First Development
**Status**: PASS - Design follows specification workflow.

**Analysis**: Feature followed full workflow: `/speckit.specify` → `/speckit.clarify` → `/speckit.plan`. Documentation complete.

### ✅ Backend Endpoints (Standard Structure)
**Status**: PASS - Design validates endpoint structure.

**Analysis**: API endpoint tests validate all required endpoints per constitution. Tests enforce standard structure rather than deviate from it.

### ✅ No V1 Copy-Paste
**Status**: PASS - Design is new for V3.

**Analysis**: E2E test suite is entirely new implementation. No V1 code copied.

### Result: ✅ ALL GATES PASSED - Design Complete

**No constitution violations introduced during design phase.**

---

## Next Steps

The planning phase is complete. Proceed to task generation:

```bash
/speckit.tasks
```

This will generate `tasks.md` with actionable implementation tasks based on this plan.

