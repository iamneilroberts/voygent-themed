# Tasks: Comprehensive Test Suite for Template-Based Voygent Platform

**Feature**: 007-full-test-suite
**Branch**: `007-full-test-suite`
**Status**: Phase 3 (Task Generation Complete)

## Overview

This document contains the implementation tasks for building a comprehensive automated test suite for the Voygent platform. The test suite validates trip generation across all 5 themes, research execution, template system behavior, API endpoints, white-label functionality, error handling, and performance metrics.

**Total Tasks**: 32
**Estimated Effort**: ~2-3 days
**Dependencies**: Existing Voygent codebase with template system and research execution

---

## Task Execution Guidelines

### Parallel Execution

Tasks marked with **[P]** can be executed in parallel since they work on independent files:

```bash
# Example: Run unit tests in parallel
Task agent "Write template interpolation tests" & \
Task agent "Write template validation tests" & \
Task agent "Write intake normalization tests" & \
wait
```

### Sequential Dependencies

Tasks without [P] must be executed in order due to dependencies:
- Setup tasks (T001-T005) must complete before infrastructure tasks
- Infrastructure tasks (T006-T013) must complete before test writing
- All test writing must complete before validation tasks (T030-T032)

---

## Phase 1: Setup (5 tasks)

### T001: Install and configure Vitest with Workers pool

**Status**: ⬜ Not Started
**Dependencies**: None
**Files**: `package.json`, `package-lock.json`

**Description**:
Install Vitest test framework and @cloudflare/vitest-pool-workers to run tests in Cloudflare Workers runtime environment.

**Steps**:
1. Install dependencies: `npm install --save-dev vitest @cloudflare/vitest-pool-workers`
2. Verify installation in package.json devDependencies
3. Add test scripts to package.json:
   ```json
   "scripts": {
     "test": "vitest run",
     "test:watch": "vitest watch",
     "test:coverage": "vitest run --coverage"
   }
   ```

**Acceptance Criteria**:
- vitest and @cloudflare/vitest-pool-workers appear in package.json devDependencies
- npm run test executes successfully (even if no tests exist yet)

---

### T002: Create vitest.config.ts with Workers pool configuration

**Status**: ⬜ Not Started
**Dependencies**: T001
**Files**: `vitest.config.ts` (new)

**Description**:
Configure Vitest to use Cloudflare Workers pool for testing Pages Functions.

**Implementation**:
```typescript
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: {
            TEST_MODE: 'true'
          }
        }
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['functions/api/**/*.ts'],
      exclude: ['functions/api/**/*.test.ts', 'tests/**']
    }
  }
});
```

**Acceptance Criteria**:
- vitest.config.ts exists at repository root
- Configuration uses Workers pool
- Coverage reporting configured for functions/api directory

---

### T003: Set up test D1 database binding and run migrations

**Status**: ⬜ Not Started
**Dependencies**: T001
**Files**: `wrangler.toml`

**Description**:
Create a separate D1 database for testing and configure wrangler.toml binding.

**Steps**:
1. Create test database: `wrangler d1 create voygent-test`
2. Note the database ID from output
3. Add TEST_DB binding to wrangler.toml:
   ```toml
   [[d1_databases]]
   binding = "TEST_DB"
   database_name = "voygent-test"
   database_id = "YOUR-DATABASE-ID-HERE"
   ```
4. Run all migrations on test database:
   ```bash
   for migration in migrations/*.sql; do
     wrangler d1 execute voygent-test --file "$migration"
   done
   ```

**Acceptance Criteria**:
- voygent-test database exists in Cloudflare D1
- TEST_DB binding configured in wrangler.toml
- All migrations applied to test database (verify with: `wrangler d1 execute voygent-test --command "SELECT name FROM sqlite_master WHERE type='table'"`)

---

### T004: Create test helpers directory structure

**Status**: ⬜ Not Started
**Dependencies**: None
**Files**: Directory structure

**Description**:
Create the directory structure for test files, fixtures, and helpers.

**Steps**:
1. Create directories:
   ```bash
   mkdir -p tests/integration
   mkdir -p tests/unit
   mkdir -p tests/fixtures
   mkdir -p tests/helpers
   ```
2. Create placeholder .gitkeep files if needed

**Structure**:
```
tests/
├── integration/     # End-to-end test files
├── unit/           # Unit test files
├── fixtures/       # Test data (JSON files)
└── helpers/        # Test utilities (mocks, assertions)
```

**Acceptance Criteria**:
- All four directories exist
- Directory structure matches plan.md specification

---

### T005: Configure CI/CD pipeline for test execution

**Status**: ⬜ Not Started
**Dependencies**: T001, T002, T003
**Files**: `.github/workflows/test.yml` (new)

**Description**:
Create GitHub Actions workflow to run tests on every push and pull request.

**Implementation**:
```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - name: Create test database
        run: wrangler d1 create voygent-test || true
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      - name: Run migrations
        run: |
          for migration in migrations/*.sql; do
            wrangler d1 execute voygent-test --file "$migration"
          done
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      - run: npm run test
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-report
          path: coverage/
```

**Acceptance Criteria**:
- Workflow file exists at .github/workflows/test.yml
- Tests run automatically on push/PR
- Test reports uploaded as artifacts

---

## Phase 2: Test Infrastructure (8 tasks)

### T006: Create test database utilities (test-db.ts)

**Status**: ⬜ Not Started
**Dependencies**: T003, T004
**Files**: `tests/helpers/test-db.ts` (new)

**Description**:
Create utilities for setting up, seeding, and cleaning up test database.

**Implementation**:
```typescript
import type { D1Database } from '@cloudflare/workers-types';

export async function setupTestDatabase(db: D1Database) {
  // Seed trip templates (all 5 themes)
  const templates = [
    { theme: 'heritage', researchQueryTemplate: '{surname} family heritage sites ancestral homes castles historical tours travel destinations' },
    { theme: 'tvmovie', researchQueryTemplate: '{title} filming locations movie sets TV show locations travel destinations' },
    { theme: 'historical', researchQueryTemplate: '{event} historical sites museums memorials travel destinations' },
    { theme: 'culinary', researchQueryTemplate: '{cuisine} {region} restaurants cooking classes food tours culinary experiences' },
    { theme: 'adventure', researchQueryTemplate: '{destination} {activity} adventure tours outdoor activities travel destinations' }
  ];

  for (const template of templates) {
    await db.prepare('INSERT OR IGNORE INTO trip_templates (theme, researchQueryTemplate) VALUES (?, ?)')
      .bind(template.theme, template.researchQueryTemplate)
      .run();
  }
}

export async function cleanupTestData(db: D1Database) {
  // Delete test trips and messages
  await db.prepare('DELETE FROM themed_messages WHERE trip_id IN (SELECT id FROM themed_trips WHERE user_id LIKE ?)')
    .bind('test-user-%')
    .run();

  await db.prepare('DELETE FROM themed_trips WHERE user_id LIKE ?')
    .bind('test-user-%')
    .run();
}

export function generateTestUserId(): string {
  return `test-user-${crypto.randomUUID()}`;
}

export function generateTestAgencyId(): string {
  return `test-agency-${crypto.randomUUID()}`;
}
```

**Acceptance Criteria**:
- setupTestDatabase() seeds templates for all 5 themes
- cleanupTestData() removes all test records
- generateTestUserId() and generateTestAgencyId() create unique IDs

---

### T007: Create AI provider mocks (mock-providers.ts)

**Status**: ⬜ Not Started
**Dependencies**: T004
**Files**: `tests/helpers/mock-providers.ts` (new)

**Description**:
Create mock implementations of callProvider() that return pre-defined responses.

**Implementation**:
```typescript
import type { ProviderConfig, ProviderRequest, ProviderResponse } from '../../../functions/api/lib/provider';

export function mockCallProvider(fixtureResponses: Record<string, string>) {
  return async (config: ProviderConfig, request: ProviderRequest): Promise<ProviderResponse> => {
    // Match by prompt prefix to find appropriate fixture
    const key = Object.keys(fixtureResponses).find(k =>
      request.systemPrompt.includes(k) || request.userPrompt.includes(k)
    ) || 'default';

    const content = fixtureResponses[key];

    if (!content) {
      throw new Error(`No mock response for key: ${key}`);
    }

    return {
      content,
      tokensIn: estimateTokens(request.systemPrompt + request.userPrompt),
      tokensOut: estimateTokens(content),
      costUsd: 0.001 // Mock cost
    };
  };
}

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

export function createMockProviderError(message: string) {
  return async (): Promise<ProviderResponse> => {
    throw new Error(message);
  };
}
```

**Acceptance Criteria**:
- mockCallProvider() returns responses matching fixture keys
- estimateTokens() provides reasonable token estimates
- createMockProviderError() simulates API failures

---

### T008: Create web search mocks (mock-search.ts)

**Status**: ⬜ Not Started
**Dependencies**: T004
**Files**: `tests/helpers/mock-search.ts` (new)

**Description**:
Create mock implementations of Serper and Tavily web search APIs.

**Implementation**:
```typescript
import type { SearchResult } from '../../../functions/api/lib/providers/search';

export function mockSerperWebSearch(fixtures: Record<string, SearchResult[]>) {
  return async (env: any, params: { q: string }): Promise<any> => {
    const results = fixtures[params.q] || fixtures['default'] || [];

    return {
      provider: 'serper',
      query: params.q,
      results: results.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet
      })),
      cached: false,
      search_date: new Date().toISOString()
    };
  };
}

export function mockTavilyWebSearch(fixtures: Record<string, SearchResult[]>) {
  return async (env: any, params: { q: string }): Promise<any> => {
    const results = fixtures[params.q] || fixtures['default'] || [];

    return {
      provider: 'tavily',
      query: params.q,
      results: results.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet
      })),
      cached: false,
      search_date: new Date().toISOString()
    };
  };
}
```

**Acceptance Criteria**:
- mockSerperWebSearch() returns fixture data matching query
- mockTavilyWebSearch() returns fixture data matching query
- Both return 'default' fixtures when query not found

---

### T009: Create custom assertions (assertions.ts)

**Status**: ⬜ Not Started
**Dependencies**: T004
**Files**: `tests/helpers/assertions.ts` (new)

**Description**:
Create reusable assertion functions for validating trip structure and research data.

**Implementation**:
```typescript
import { expect } from 'vitest';

export function validateTripStructure(trip: any) {
  // Required top-level properties
  expect(trip).toHaveProperty('tripId');
  expect(trip).toHaveProperty('intake');
  expect(trip).toHaveProperty('options');
  expect(trip).toHaveProperty('diagnostics');

  // Options validation
  expect(trip.options).toBeInstanceOf(Array);
  expect(trip.options.length).toBeGreaterThanOrEqual(2);
  expect(trip.options.length).toBeLessThanOrEqual(4);

  // Each option structure
  trip.options.forEach((option: any) => {
    expect(option).toHaveProperty('title');
    expect(option).toHaveProperty('cities');
    expect(option).toHaveProperty('itinerary');
    expect(option).toHaveProperty('estimated_budget');
    expect(option).toHaveProperty('highlights');

    expect(option.cities).toBeInstanceOf(Array);
    expect(option.estimated_budget).toBeGreaterThan(0);
  });
}

export function validateResearchData(research: any[]) {
  expect(research).toBeInstanceOf(Array);

  research.forEach((step) => {
    expect(step).toMatchObject({
      step: expect.stringContaining('_research'),
      query: expect.any(String),
      results: expect.arrayContaining([
        expect.objectContaining({
          title: expect.any(String),
          url: expect.stringMatching(/^https?:\/\//),
          snippet: expect.any(String)
        })
      ]),
      analysis: expect.any(String),
      timestamp: expect.any(Number)
    });

    expect(step.query.length).toBeGreaterThan(0);
    expect(step.analysis.length).toBeGreaterThan(0);
  });
}

export function validatePerformance(duration: number, cost: number, thresholds: { maxDuration: number, maxCost: number }) {
  expect(duration).toBeLessThan(thresholds.maxDuration);
  expect(cost).toBeLessThan(thresholds.maxCost);
}
```

**Acceptance Criteria**:
- validateTripStructure() checks all required fields and constraints
- validateResearchData() validates research array structure
- validatePerformance() enforces duration and cost thresholds

---

### T010: Create heritage test fixtures **[P]**

**Status**: ⬜ Not Started
**Dependencies**: T004
**Files**: `tests/fixtures/heritage-inputs.json` (new), `tests/fixtures/ai-responses.json` (new), `tests/fixtures/research-results.json` (new)

**Description**:
Create JSON fixtures for heritage theme test scenarios with sample inputs and expected outputs.

**heritage-inputs.json**:
```json
{
  "williams_scotland": {
    "text": "I want to explore my Williams family heritage in Scotland",
    "theme": "heritage",
    "expected": {
      "surnames": ["Williams"],
      "suspected_origins": ["Scotland"],
      "theme": "heritage"
    }
  },
  "mcleod_detailed": {
    "text": "McLeod family trip to Scotland, interested in castles and historical sites, 10 days, comfort budget",
    "theme": "heritage",
    "expected": {
      "surnames": ["McLeod"],
      "suspected_origins": ["Scotland"],
      "interests": ["castles", "historical sites"],
      "duration_days": 10,
      "budget_tier": "comfort",
      "theme": "heritage"
    }
  }
}
```

**ai-responses.json** (partial):
```json
{
  "heritage_intake": "{\"surnames\": [\"Williams\"], \"suspected_origins\": [\"Scotland\"], \"duration_days\": 7, \"budget_tier\": \"comfort\", \"theme\": \"heritage\"}",
  "heritage_options": "{\"options\": [{\"title\": \"Scottish Heritage Trail\", \"cities\": [\"Edinburgh\", \"Inverness\", \"Isle of Skye\"], \"itinerary\": [...], \"estimated_budget\": 3500}]}",
  "heritage_research_synthesis": "The Williams surname has strong Scottish roots, particularly in the Highlands region..."
}
```

**research-results.json** (partial):
```json
{
  "Williams family heritage sites Scotland": [
    {
      "title": "Williams Clan Heritage Sites in Scotland",
      "url": "https://example.com/williams-heritage",
      "snippet": "Explore the ancestral homeland of the Williams clan in the Scottish Highlands..."
    }
  ]
}
```

**Acceptance Criteria**:
- heritage-inputs.json contains 2+ realistic test scenarios
- ai-responses.json includes intake, options, and research synthesis for heritage
- research-results.json includes mock search results for heritage queries

---

### T011: Create tvmovie test fixtures **[P]**

**Status**: ⬜ Not Started
**Dependencies**: T004
**Files**: `tests/fixtures/tvmovie-inputs.json` (new), update `tests/fixtures/ai-responses.json`, update `tests/fixtures/research-results.json`

**Description**:
Create JSON fixtures for TV/movie theme test scenarios.

**tvmovie-inputs.json**:
```json
{
  "game_of_thrones": {
    "text": "Game of Thrones filming locations trip",
    "theme": "tvmovie",
    "expected": {
      "titles": ["Game of Thrones"],
      "theme": "tvmovie"
    }
  },
  "lotr_new_zealand": {
    "text": "Lord of the Rings New Zealand tour, 14 days",
    "theme": "tvmovie",
    "expected": {
      "titles": ["Lord of the Rings"],
      "destinations": ["New Zealand"],
      "duration_days": 14,
      "theme": "tvmovie"
    }
  }
}
```

**Acceptance Criteria**:
- tvmovie-inputs.json contains 2+ realistic test scenarios
- ai-responses.json updated with tvmovie responses
- research-results.json updated with tvmovie search results

---

### T012: Create historical test fixtures **[P]**

**Status**: ⬜ Not Started
**Dependencies**: T004
**Files**: `tests/fixtures/historical-inputs.json` (new), update `tests/fixtures/ai-responses.json`, update `tests/fixtures/research-results.json`

**Description**:
Create JSON fixtures for historical theme test scenarios.

**historical-inputs.json**:
```json
{
  "dday_normandy": {
    "text": "D-Day historical sites in France",
    "theme": "historical",
    "expected": {
      "events": ["D-Day"],
      "destinations": ["France", "Normandy"],
      "theme": "historical"
    }
  },
  "medieval_england": {
    "text": "Medieval England castles and battlefields, 7 days",
    "theme": "historical",
    "expected": {
      "periods": ["Medieval"],
      "destinations": ["England"],
      "interests": ["castles", "battlefields"],
      "duration_days": 7,
      "theme": "historical"
    }
  }
}
```

**Acceptance Criteria**:
- historical-inputs.json contains 2+ realistic test scenarios
- ai-responses.json updated with historical responses
- research-results.json updated with historical search results

---

### T013: Create culinary and adventure fixtures **[P]**

**Status**: ⬜ Not Started
**Dependencies**: T004
**Files**: `tests/fixtures/culinary-inputs.json` (new), `tests/fixtures/adventure-inputs.json` (new), update `tests/fixtures/ai-responses.json`, update `tests/fixtures/research-results.json`

**Description**:
Create JSON fixtures for culinary and adventure theme test scenarios.

**culinary-inputs.json**:
```json
{
  "tuscany_cooking": {
    "text": "Italian cuisine cooking classes in Tuscany",
    "theme": "culinary",
    "expected": {
      "cuisines": ["Italian"],
      "regions": ["Tuscany"],
      "activities": ["cooking classes"],
      "theme": "culinary"
    }
  }
}
```

**adventure-inputs.json**:
```json
{
  "patagonia_hiking": {
    "text": "Patagonia hiking and glacier trekking, 12 days",
    "theme": "adventure",
    "expected": {
      "destinations": ["Patagonia"],
      "activities": ["hiking", "glacier trekking"],
      "duration_days": 12,
      "theme": "adventure"
    }
  }
}
```

**Acceptance Criteria**:
- culinary-inputs.json contains 2+ realistic test scenarios
- adventure-inputs.json contains 2+ realistic test scenarios
- ai-responses.json updated with culinary and adventure responses
- research-results.json updated with culinary and adventure search results

---

## Phase 3: Unit Tests (6 tasks) - Can run in parallel **[P]**

### T014: Write template interpolation tests **[P]**

**Status**: ⬜ Not Started
**Dependencies**: T006-T009
**Files**: `tests/unit/template-interpolation.test.ts` (new)

**Description**:
Unit tests for template query placeholder replacement logic.

**Test Cases**:
1. Replace {surname} placeholder with single surname
2. Replace {surname} placeholder with multiple surnames
3. Replace {title} placeholder
4. Replace {event} placeholder
5. Replace {cuisine} and {region} placeholders together
6. Remove unused placeholders gracefully
7. Handle missing data (undefined placeholders)

**Implementation Template**:
```typescript
import { describe, test, expect } from 'vitest';
import { interpolateResearchQuery } from '../../functions/api/lib/research-utils';

describe('Template Query Interpolation', () => {
  test('replaces {surname} placeholder with single surname', () => {
    const template = '{surname} family heritage sites';
    const intake = { surnames: ['Williams'] };
    const result = interpolateResearchQuery(template, intake);
    expect(result).toBe('Williams family heritage sites');
  });

  // Add 6 more tests...
});
```

**Acceptance Criteria**:
- All 7 test cases implemented and passing
- Tests cover happy path and edge cases
- No external dependencies (unit tests only)

---

### T015: Write template validation tests **[P]**

**Status**: ⬜ Not Started
**Dependencies**: T006-T009
**Files**: `tests/unit/template-validation.test.ts` (new)

**Description**:
Unit tests for template configuration validation logic.

**Test Cases**:
1. Valid template with all required fields
2. Template missing required field (e.g., researchQueryTemplate)
3. Template with invalid field type
4. Template with empty researchQueryTemplate
5. Template with undefined researchSynthesisPrompt (should be optional)
6. Multiple templates loaded correctly
7. Template selection by theme
8. Invalid theme returns appropriate error

**Acceptance Criteria**:
- All 8 test cases implemented and passing
- Tests validate required vs optional fields
- Error messages are descriptive

---

### T016: Write intake normalization tests **[P]**

**Status**: ⬜ Not Started
**Dependencies**: T006-T009, T010-T013
**Files**: `tests/unit/intake-normalization.test.ts` (new)

**Description**:
Unit tests for intake parsing and normalization using mocked AI responses.

**Test Cases**:
1. Parse heritage input with surname and origin
2. Parse tvmovie input with title
3. Parse historical input with event
4. Parse culinary input with cuisine and region
5. Parse adventure input with destination and activity
6. Extract duration_days from text
7. Extract budget_tier from text
8. Handle missing optional fields gracefully
9. Validate required fields per theme
10. Return appropriate error for invalid input

**Acceptance Criteria**:
- All 10 test cases implemented and passing
- Uses mock AI provider responses from fixtures
- Tests cover all 5 themes

---

### T017: Write error handling tests **[P]**

**Status**: ⬜ Not Started
**Dependencies**: T006-T009
**Files**: `tests/unit/error-handling.test.ts` (new)

**Description**:
Unit tests for error scenarios and graceful degradation.

**Test Cases**:
1. AI provider returns HTTP 500 error
2. AI provider returns malformed JSON
3. Web search API fails
4. Database connection timeout
5. Missing environment variables
6. Invalid user input (empty text)
7. Research failure doesn't block trip generation

**Acceptance Criteria**:
- All 7 test cases implemented and passing
- Error messages are logged appropriately
- System degrades gracefully (doesn't crash)

---

### T018: Write data integrity tests **[P]**

**Status**: ⬜ Not Started
**Dependencies**: T006-T009
**Files**: `tests/unit/data-integrity.test.ts` (new)

**Description**:
Unit tests for database column validation and JSON parsing.

**Test Cases**:
1. intake_json parses correctly
2. options_json parses correctly
3. diagnostics parses correctly
4. Malformed JSON in diagnostics returns appropriate error
5. created_at timestamp is valid ISO 8601
6. updated_at timestamp is valid ISO 8601
7. Trip status transitions follow valid state machine
8. Foreign key constraints enforced (agency_id, user_id)
9. Required columns are NOT NULL

**Acceptance Criteria**:
- All 9 test cases implemented and passing
- Tests validate JSON serialization/deserialization
- Tests validate database constraints

---

### T019: Write research query building tests **[P]**

**Status**: ⬜ Not Started
**Dependencies**: T006-T009, T010-T013
**Files**: `tests/unit/research-query-builder.test.ts` (new)

**Description**:
Unit tests for building research queries from templates and intake data.

**Test Cases**:
1. Build heritage query with surname and origin
2. Build tvmovie query with title
3. Build historical query with event
4. Build culinary query with cuisine and region
5. Build adventure query with destination and activity
6. Handle missing optional fields in query

**Acceptance Criteria**:
- All 6 test cases implemented and passing
- Queries match expected format
- Missing fields don't break query construction

---

## Phase 4: Theme Integration Tests (5 tasks) - Can run in parallel **[P]**

### T020: Write heritage theme integration tests **[P]**

**Status**: ⬜ Not Started
**Dependencies**: T006-T013
**Files**: `tests/integration/theme-heritage.test.ts` (new)

**Description**:
End-to-end integration tests for heritage theme trip generation.

**Test Scenarios**:
1. Generate trip for Williams surname in Scotland
2. Verify intake normalization extracts surnames and origins
3. Verify research executes with correct query
4. Verify research results saved to diagnostics
5. Verify 2-4 trip options returned
6. Verify each option has required fields
7. Verify trip persisted to database
8. Verify GET /api/trips/{id} returns trip with diagnostics
9. Test with multiple surnames
10. Test with genealogy interests
11. Test with specific destination preference
12. Test error handling (research fails)

**Implementation Template**:
```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, cleanupTestData, generateTestUserId } from '../helpers/test-db';
import { mockCallProvider } from '../helpers/mock-providers';
import { mockSerperWebSearch } from '../helpers/mock-search';
import { validateTripStructure, validateResearchData } from '../helpers/assertions';
import heritageInputs from '../fixtures/heritage-inputs.json';
import aiResponses from '../fixtures/ai-responses.json';
import researchResults from '../fixtures/research-results.json';

describe('Heritage Theme Integration Tests', () => {
  let testUserId: string;
  let testDb: D1Database;

  beforeEach(async () => {
    testUserId = generateTestUserId();
    testDb = env.TEST_DB;
    await setupTestDatabase(testDb);
  });

  afterEach(async () => {
    await cleanupTestData(testDb);
  });

  test('generates trip for Williams surname in Scotland', async () => {
    const input = heritageInputs.williams_scotland;
    const response = await POST('/api/trips', { body: input });

    validateTripStructure(response);
    expect(response.intake.surnames).toContain('Williams');
    expect(response.intake.suspected_origins).toContain('Scotland');
    expect(response.diagnostics.research).toBeDefined();
    validateResearchData(response.diagnostics.research);
  });

  // Add 11 more tests...
});
```

**Acceptance Criteria**:
- All 12 test scenarios implemented and passing
- Tests use fixtures and mocks (no real API calls)
- Tests clean up data after execution
- Tests validate full trip generation flow

---

### T021: Write tvmovie theme integration tests **[P]**

**Status**: ⬜ Not Started
**Dependencies**: T006-T013
**Files**: `tests/integration/theme-tvmovie.test.ts` (new)

**Description**:
End-to-end integration tests for TV/movie theme trip generation.

**Test Scenarios**:
1. Generate trip for Game of Thrones
2. Verify intake extracts title
3. Verify research includes filming locations
4. Verify options include multiple countries (Northern Ireland, Iceland, Croatia)
5. Generate trip for Lord of the Rings in New Zealand
6. Verify duration preference respected
7. Test with TV series vs movie
8. Test with multiple titles
9. Test error handling (unknown title)
10. Verify trip persisted to database

**Acceptance Criteria**:
- All 10 test scenarios implemented and passing
- Tests cover various TV shows and movies
- Tests validate filming location research

---

### T022: Write historical theme integration tests **[P]**

**Status**: ⬜ Not Started
**Dependencies**: T006-T013
**Files**: `tests/integration/theme-historical.test.ts` (new)

**Description**:
End-to-end integration tests for historical theme trip generation.

**Test Scenarios**:
1. Generate trip for D-Day in Normandy
2. Verify intake extracts event and location
3. Verify research includes historical sites
4. Verify options include museums and memorials
5. Generate trip for Medieval England
6. Verify period-specific research
7. Test with historical figure vs event
8. Test with time period only
9. Test error handling (ambiguous event)
10. Verify trip persisted to database

**Acceptance Criteria**:
- All 10 test scenarios implemented and passing
- Tests cover various historical events and periods
- Tests validate historical research accuracy

---

### T023: Write culinary theme integration tests **[P]**

**Status**: ⬜ Not Started
**Dependencies**: T006-T013
**Files**: `tests/integration/theme-culinary.test.ts` (new)

**Description**:
End-to-end integration tests for culinary theme trip generation.

**Test Scenarios**:
1. Generate trip for Italian cuisine in Tuscany
2. Verify intake extracts cuisine and region
3. Verify research includes cooking classes and restaurants
4. Verify options include food tours
5. Test with cuisine only (no region specified)
6. Verify multi-region options when location not specified
7. Test with specific dietary preferences
8. Test error handling (unknown cuisine)
9. Verify trip persisted to database

**Acceptance Criteria**:
- All 9 test scenarios implemented and passing
- Tests cover various cuisines and regions
- Tests validate culinary activity inclusion

---

### T024: Write adventure theme integration tests **[P]**

**Status**: ⬜ Not Started
**Dependencies**: T006-T013
**Files**: `tests/integration/theme-adventure.test.ts` (new)

**Description**:
End-to-end integration tests for adventure theme trip generation.

**Test Scenarios**:
1. Generate trip for Patagonia hiking
2. Verify intake extracts destination and activity
3. Verify research includes trails and outdoor activities
4. Verify options include adventure tours
5. Test with activity only (destination not specified)
6. Verify activity-based destination selection
7. Test with multiple activities
8. Test with difficulty level preference
9. Test error handling (unsafe activity)
10. Verify trip persisted to database

**Acceptance Criteria**:
- All 10 test scenarios implemented and passing
- Tests cover various destinations and activities
- Tests validate outdoor activity focus

---

## Phase 5: Cross-Cutting Integration Tests (5 tasks)

### T025: Write research execution tests

**Status**: ⬜ Not Started
**Dependencies**: T006-T024
**Files**: `tests/integration/research-execution.test.ts` (new)

**Description**:
Integration tests specifically for research execution and database persistence.

**Test Scenarios**:
1. Research executes for theme with researchQueryTemplate
2. Research skipped for theme without researchQueryTemplate
3. Research results saved to diagnostics column
4. Research data includes query, results, analysis, timestamp
5. Research failure doesn't block trip generation
6. Multiple research steps executed in sequence
7. Research synthesis includes AI analysis
8. Verify research query interpolation from intake

**Acceptance Criteria**:
- All 8 test scenarios implemented and passing
- Tests validate research execution flow
- Tests verify database persistence of research data

---

### T026: Write API endpoint tests

**Status**: ⬜ Not Started
**Dependencies**: T006-T013
**Files**: `tests/integration/api-endpoints.test.ts` (new)

**Description**:
Integration tests for API endpoints (POST, GET, PATCH).

**Test Scenarios**:
1. POST /api/trips accepts multipart form data
2. POST /api/trips returns complete trip response
3. GET /api/trips/{id} returns existing trip
4. GET /api/trips/{id} returns 404 for invalid ID
5. GET /api/trips filters by user_id
6. GET /api/trips filters by agency_id
7. POST /api/trips with invalid input returns 400
8. POST /api/trips with missing required field returns 400
9. API endpoints return proper CORS headers
10. API endpoints handle authentication (if applicable)

**Acceptance Criteria**:
- All 10 test scenarios implemented and passing
- Tests validate API request/response structure
- Tests verify error codes and messages

---

### T027: Write white-label agency tests

**Status**: ⬜ Not Started
**Dependencies**: T006-T013
**Files**: `tests/integration/white-label-agency.test.ts` (new)

**Description**:
Integration tests for multi-agency isolation and white-label functionality.

**Test Scenarios**:
1. Trips correctly associated with agency_id
2. GET /api/trips filters by agency_id
3. Agency A cannot access Agency B trips
4. Admin user sees only their agency's data
5. Trip template overrides work per agency
6. Agency branding applied to trip options

**Acceptance Criteria**:
- All 6 test scenarios implemented and passing
- Tests validate agency isolation
- Tests verify white-label customization

---

### T028: Write performance benchmark tests

**Status**: ⬜ Not Started
**Dependencies**: T006-T024
**Files**: `tests/integration/performance.test.ts` (new)

**Description**:
Integration tests for performance and cost benchmarks.

**Test Scenarios**:
1. Heritage trip generation completes under 20 seconds
2. TV/movie trip generation completes under 18 seconds
3. Historical trip generation completes under 16 seconds
4. Culinary trip generation completes under 15 seconds
5. Adventure trip generation completes under 15 seconds
6. Research execution completes under 5 seconds
7. Total AI cost per trip under $0.10
8. Intake normalization under $0.002
9. Options generation under $0.008
10. Concurrent requests don't cause failures

**Implementation Template**:
```typescript
import { describe, test, expect } from 'vitest';
import { validatePerformance } from '../helpers/assertions';

describe('Performance Benchmarks', () => {
  test('heritage trip generation under 20 seconds', async () => {
    const startTime = Date.now();
    const response = await generateHeritageTrip();
    const duration = Date.now() - startTime;

    const totalCost = response.diagnostics.intake.costUsd +
                     response.diagnostics.options.costUsd;

    validatePerformance(duration, totalCost, {
      maxDuration: 20000,
      maxCost: 0.015
    });
  });

  // Add 9 more tests...
});
```

**Acceptance Criteria**:
- All 10 test scenarios implemented and passing
- Tests measure duration and cost accurately
- Tests validate performance thresholds

---

### T029: Write full trip generation flow tests

**Status**: ⬜ Not Started
**Dependencies**: T006-T028
**Files**: `tests/integration/trip-generation.test.ts` (new)

**Description**:
End-to-end integration tests for complete trip generation flow across all themes.

**Test Scenarios**:
1. Full flow: POST /api/trips → verify database → GET /api/trips/{id}
2. Intake normalization → research → options → persistence
3. Diagnostics include all steps (intake, research, options)
4. Trip status transitions correctly
5. created_at and updated_at timestamps valid
6. All JSON fields parse correctly
7. Foreign key relationships preserved
8. Concurrent trips don't interfere

**Acceptance Criteria**:
- All 8 test scenarios implemented and passing
- Tests validate complete end-to-end flow
- Tests verify data integrity across all steps

---

## Phase 6: Validation & Reporting (3 tasks)

### T030: Run full test suite and verify all tests pass

**Status**: ⬜ Not Started
**Dependencies**: T014-T029
**Files**: None (execution task)

**Description**:
Execute the complete test suite and verify all tests pass.

**Steps**:
1. Run full test suite: `npm run test`
2. Review test output for any failures
3. Fix any failing tests
4. Re-run until all tests pass
5. Verify test execution time under 5 minutes (NFR-002)

**Expected Output**:
```
Test Files  15 passed (15)
     Tests  85+ passed (85+)
  Duration  < 300s (5 minutes)
```

**Acceptance Criteria**:
- All test files pass (15 files)
- All test scenarios pass (85+ tests)
- Total execution time under 5 minutes
- No errors or warnings

---

### T031: Generate test coverage report

**Status**: ⬜ Not Started
**Dependencies**: T030
**Files**: `coverage/` (generated)

**Description**:
Generate code coverage report and verify >80% coverage on critical paths.

**Steps**:
1. Run coverage: `npm run test:coverage`
2. Review coverage report
3. Identify uncovered critical paths
4. Add tests to cover gaps (if needed)
5. Re-run coverage until >80% achieved

**Expected Output**:
```
 % Coverage report from v8
----------------------------|---------|----------|---------|---------
File                        | % Stmts | % Branch | % Funcs | % Lines
----------------------------|---------|----------|---------|---------
All files                   |   85.34 |    78.92 |   89.12 |   85.34
 functions/api/lib/         |   92.45 |    88.34 |   95.23 |   92.45
  research-executor.ts      |   98.12 |    95.45 |  100.00 |   98.12
  research-utils.ts         |  100.00 |   100.00 |  100.00 |  100.00
  trip-templates.ts         |   87.23 |    82.11 |   90.12 |   87.23
----------------------------|---------|----------|---------|---------
```

**Acceptance Criteria**:
- Overall code coverage >80%
- Critical paths (trip generation, research, templates) >85%
- Coverage report saved to coverage/ directory

---

### T032: Document test results and update quickstart.md

**Status**: ⬜ Not Started
**Dependencies**: T030, T031
**Files**: `specs/007-full-test-suite/quickstart.md` (update)

**Description**:
Update quickstart.md with actual test results, findings, and any troubleshooting tips discovered during testing.

**Steps**:
1. Document actual test execution times
2. Document actual coverage percentages
3. Add any troubleshooting tips discovered
4. Update expected output sections with actual output
5. Add examples of common test failures and fixes

**Updates to quickstart.md**:
- Section "Running Tests" → Add actual test counts
- Section "Performance Benchmarks" → Add actual timings
- Section "Interpreting Test Results" → Add real examples
- Section "Troubleshooting" → Add discovered issues

**Acceptance Criteria**:
- quickstart.md updated with real test results
- All commands verified to work
- Troubleshooting section includes real issues encountered

---

## Summary

**Total Tasks**: 32
**Parallel Groups**:
- Tasks T014-T019 (6 unit tests) [P]
- Tasks T020-T024 (5 theme integration tests) [P]
- Tasks T010-T013 (4 fixture creation tasks) [P]

**Sequential Dependencies**:
1. Setup (T001-T005) → Infrastructure (T006-T013)
2. Infrastructure → Unit Tests (T014-T019) + Theme Tests (T020-T024)
3. Theme Tests → Cross-Cutting Tests (T025-T029)
4. All Tests → Validation (T030-T032)

**Estimated Timeline**:
- Day 1: Setup and Infrastructure (T001-T013) - ~4 hours
- Day 2: Unit Tests and Theme Tests in parallel (T014-T024) - ~6 hours
- Day 3: Cross-Cutting Tests and Validation (T025-T032) - ~6 hours

**Ready to Execute**: All tasks are defined with clear acceptance criteria, file paths, and implementation guidance.
