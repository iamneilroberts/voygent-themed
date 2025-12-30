# Data Model: E2E Test Suite Entities

**Date**: 2025-10-09
**Feature**: End-to-End Test Suite for Full MVP
**Branch**: `002-end-to-end`

## Overview

This document defines the key entities and data structures for the E2E test suite. These are **testing artifacts**, not production application entities. They represent test configuration, test results, test fixtures, and test reports.

---

## Entities

### 1. TestSuite

Represents a collection of tests organized by user story or functional area.

**Attributes**:
- `name`: string - Test suite name (e.g., "Critical Path Validation", "API Endpoints")
- `priority`: 'P1' | 'P2' | 'P3' - Priority level from specification
- `testFiles`: string[] - Paths to test files in this suite
- `tags`: string[] - Tags for filtering (e.g., "@requiresApi", "@mobile")
- `timeout`: number - Maximum execution time in milliseconds
- `retries`: number - Number of retry attempts for flaky tests

**Relationships**:
- Has many TestCases
- Has many TestReports (one per execution)

**Validation Rules**:
- `name` must be unique across test suites
- `priority` must be P1, P2, or P3
- `timeout` must be between 60000ms (1 min) and 600000ms (10 min)
- `retries` must be between 0 and 3

**Example**:
```typescript
{
  name: "Critical Path Validation",
  priority: "P1",
  testFiles: ["tests/e2e/critical-path.spec.ts"],
  tags: ["@requiresApi", "@e2e"],
  timeout: 300000,
  retries: 2
}
```

---

### 2. TestCase

Represents an individual test scenario within a test suite.

**Attributes**:
- `id`: string - Unique identifier (generated from suite + test title)
- `title`: string - Test case title
- `suite`: string - Parent test suite name
- `file`: string - Test file path
- `line`: number - Line number in test file
- `tags`: string[] - Test-specific tags
- `expectedDuration`: number - Expected execution time (ms)
- `requiredFixtures`: string[] - Required test fixtures

**Relationships**:
- Belongs to one TestSuite
- Has many TestResults (one per execution)

**State Transitions**:
```
pending → running → (passed | failed | skipped | timedout)
```

**Validation Rules**:
- `id` must be unique across all test cases
- `title` must be non-empty
- `expectedDuration` should be based on historical data or estimates

**Example**:
```typescript
{
  id: "critical-path > should create trip with heritage template",
  title: "should create trip with heritage template",
  suite: "Critical Path Validation",
  file: "tests/e2e/critical-path.spec.ts",
  line: 42,
  tags: ["@requiresApi"],
  expectedDuration: 65000,
  requiredFixtures: ["heritage-template", "test-preferences"]
}
```

---

### 3. TestResult

Represents the outcome of a single test execution.

**Attributes**:
- `testId`: string - Reference to TestCase.id
- `status`: 'passed' | 'failed' | 'skipped' | 'timedout' - Test outcome
- `duration`: number - Actual execution time (ms)
- `startedAt`: Date - Test start timestamp
- `finishedAt`: Date - Test finish timestamp
- `retryCount`: number - How many retries occurred
- `error`: TestError | null - Error details if failed
- `screenshots`: string[] - Paths to failure screenshots
- `traces`: string[] - Paths to Playwright traces
- `apiCalls`: ApiCall[] - External API calls made during test
- `performanceMetrics`: PerformanceMetrics - Timing metrics

**Relationships**:
- Belongs to one TestCase
- Has one TestError (if failed)
- Has many ApiCalls
- Has one PerformanceMetrics

**Validation Rules**:
- `status` must be one of the allowed values
- `duration` must be > 0 if test ran
- `finishedAt` must be after `startedAt`
- `error` must be null if status is 'passed' or 'skipped'

**Example**:
```typescript
{
  testId: "critical-path > should create trip with heritage template",
  status: "passed",
  duration: 63245,
  startedAt: new Date("2025-10-09T10:15:30Z"),
  finishedAt: new Date("2025-10-09T10:16:33Z"),
  retryCount: 0,
  error: null,
  screenshots: [],
  traces: ["trace-abc123.zip"],
  apiCalls: [/* ... */],
  performanceMetrics: {/* ... */}
}
```

---

### 4. TestError

Represents detailed error information when a test fails.

**Attributes**:
- `message`: string - Error message
- `stack`: string - Stack trace
- `type`: 'assertion' | 'timeout' | 'api' | 'network' | 'unknown' - Error category
- `expected`: any | null - Expected value (for assertion errors)
- `actual`: any | null - Actual value (for assertion errors)
- `diff`: string | null - Visual diff (for assertion errors)

**Relationships**:
- Belongs to one TestResult

**Validation Rules**:
- `message` must be non-empty
- For `type: 'assertion'`, `expected` and `actual` should be populated
- `stack` should include file paths and line numbers

**Example**:
```typescript
{
  message: "Expected status to be 201, but got 500",
  stack: "Error: Expected status...\n  at tests/e2e/critical-path.spec.ts:48:5",
  type: "assertion",
  expected: 201,
  actual: 500,
  diff: "- 201\n+ 500"
}
```

---

### 5. TestReport

Represents aggregated results from a complete test run.

**Attributes**:
- `id`: string - Unique report ID (timestamp-based)
- `startedAt`: Date - Test run start time
- `finishedAt`: Date - Test run finish time
- `duration`: number - Total execution time (ms)
- `environment`: TestEnvironment - Environment configuration
- `summary`: TestSummary - Pass/fail statistics
- `suiteResults`: SuiteResult[] - Results per test suite
- `flakinessRate`: number - Percentage of flaky tests (0-100)
- `totalCost`: number - Total API costs in USD
- `costByProvider`: Record<string, number> - Costs broken down by API provider

**Relationships**:
- Has many SuiteResults
- Has one TestEnvironment
- Has one TestSummary

**Validation Rules**:
- `finishedAt` must be after `startedAt`
- `duration` should match `finishedAt - startedAt`
- `flakinessRate` must be between 0 and 100
- `totalCost` must be >= 0

**Example**:
```typescript
{
  id: "report-2025-10-09-101530",
  startedAt: new Date("2025-10-09T10:15:30Z"),
  finishedAt: new Date("2025-10-09T10:25:15Z"),
  duration: 585000,
  environment: {/* ... */},
  summary: {
    total: 28,
    passed: 27,
    failed: 1,
    skipped: 0,
    flaky: 0,
    passRate: 96.43
  },
  suiteResults: [/* ... */],
  flakinessRate: 0,
  totalCost: 0.47,
  costByProvider: {
    amadeus: 0.24,
    viator: 0.00,
    serper: 0.003,
    openrouter: 0.227
  }
}
```

---

### 6. TestSummary

Represents aggregated pass/fail statistics.

**Attributes**:
- `total`: number - Total number of tests
- `passed`: number - Number of passed tests
- `failed`: number - Number of failed tests
- `skipped`: number - Number of skipped tests
- `flaky`: number - Number of flaky tests (passed after retry)
- `passRate`: number - Percentage of tests passed (0-100)

**Validation Rules**:
- `total` must equal `passed + failed + skipped`
- `passRate` must be between 0 and 100
- `passRate` should equal `(passed / total) * 100`

---

### 7. SuiteResult

Represents results for a single test suite within a test report.

**Attributes**:
- `suiteName`: string - Test suite name
- `priority`: 'P1' | 'P2' | 'P3' - Suite priority
- `passed`: number - Tests passed
- `failed`: number - Tests failed
- `skipped`: number - Tests skipped
- `duration`: number - Suite execution time (ms)
- `passRate`: number - Suite pass rate (0-100)

**Relationships**:
- Belongs to one TestReport

**Validation Rules**:
- `passRate` must be between 0 and 100
- For P1 suites: `passRate` must be 100% (per SC-001)
- For P2 suites: `passRate` must be >= 95% (per SC-002)

---

### 8. TestFixture

Represents test data used across multiple tests.

**Attributes**:
- `name`: string - Fixture name (e.g., "heritage-template", "test-preferences")
- `type`: 'template' | 'preferences' | 'user-input' | 'api-response' - Fixture category
- `data`: any - Fixture data (JSON)
- `environment`: 'local' | 'staging' | 'production' - Environment this fixture applies to
- `createdAt`: Date - When fixture was created
- `updatedAt`: Date - When fixture was last modified

**Relationships**:
- Used by many TestCases

**Validation Rules**:
- `name` must be unique per environment
- `data` must be valid JSON
- For type 'template': `data.id` and `data.name` are required
- For type 'preferences': `data` must match PreferencesSchema

**Example**:
```typescript
{
  name: "heritage-template",
  type: "template",
  data: {
    id: "heritage-ancestry-001",
    name: "Heritage & Ancestry",
    description: "Explore your family roots"
  },
  environment: "local",
  createdAt: new Date("2025-10-09T10:00:00Z"),
  updatedAt: new Date("2025-10-09T10:00:00Z")
}
```

---

### 9. TestEnvironment

Represents the environment configuration for a test run.

**Attributes**:
- `name`: 'local' | 'staging' | 'production' - Environment name
- `appUrl`: string - Application base URL
- `databaseUrl`: string - Database connection string
- `apiKeys`: ApiKeyConfig - External API keys configuration
- `nodeVersion`: string - Node.js version
- `playwrightVersion`: string - Playwright version
- `ciEnvironment`: string | null - CI environment name (e.g., "GitHub Actions")

**Validation Rules**:
- `appUrl` must be a valid URL
- `databaseUrl` must be a valid connection string
- `apiKeys` must not be logged or exposed in reports

**Example**:
```typescript
{
  name: "local",
  appUrl: "http://localhost:8788",
  databaseUrl: ".wrangler/state/v3/d1/...",
  apiKeys: {
    amadeus: "***", // Redacted
    viator: "***",
    serper: "***",
    openrouter: "***"
  },
  nodeVersion: "20.10.0",
  playwrightVersion: "1.41.0",
  ciEnvironment: null
}
```

---

### 10. ApiCall

Represents a single external API call made during a test.

**Attributes**:
- `provider`: string - API provider name (e.g., "amadeus", "viator", "openrouter")
- `endpoint`: string - API endpoint path
- `method`: 'GET' | 'POST' | 'PUT' | 'DELETE' - HTTP method
- `statusCode`: number - HTTP response status code
- `duration`: number - Request duration (ms)
- `timestamp`: Date - When the call was made
- `testId`: string - Test that made the call
- `cost`: number - Estimated cost in USD
- `metadata`: Record<string, any> - Additional call metadata (model, tokens, etc.)

**Relationships**:
- Belongs to one TestResult

**Validation Rules**:
- `statusCode` must be a valid HTTP status code (100-599)
- `duration` must be > 0
- `cost` must be >= 0

**Example**:
```typescript
{
  provider: "amadeus",
  endpoint: "/v2/shopping/flight-offers",
  method: "GET",
  statusCode: 200,
  duration: 1847,
  timestamp: new Date("2025-10-09T10:16:15Z"),
  testId: "critical-path > should create trip with heritage template",
  cost: 0.008,
  metadata: {
    originLocationCode: "JFK",
    destinationLocationCode: "LAX",
    adults: 1
  }
}
```

---

### 11. PerformanceMetrics

Represents timing and performance measurements for a test.

**Attributes**:
- `destinationResearchTime`: number | null - Time to complete Phase 1 (ms)
- `tripBuildingTime`: number | null - Time to complete Phase 2 (ms)
- `totalApiTime`: number - Total time spent in API calls (ms)
- `totalAiTime`: number - Total time spent in AI generation (ms)
- `pollingIterations`: number - Number of polling attempts
- `retryCount`: number - Number of retries due to failures

**Relationships**:
- Belongs to one TestResult

**Validation Rules**:
- All time fields must be >= 0 if not null
- `destinationResearchTime` target: < 60000ms (informational per clarification #2)
- `tripBuildingTime` target: < 180000ms (informational per clarification #2)

**Example**:
```typescript
{
  destinationResearchTime: 58340,
  tripBuildingTime: 172450,
  totalApiTime: 45230,
  totalAiTime: 185560,
  pollingIterations: 77,
  retryCount: 0
}
```

---

## Entity Relationships Diagram

```
TestSuite (1) ──< TestCase (N)
    │
    │ (1)
    ↓
TestReport
    │
    │ (1)
    ├─→ TestEnvironment
    │
    │ (1)
    ├─→ TestSummary
    │
    │ (N)
    └─→ SuiteResult

TestCase (1) ──< TestResult (N)
    │
    │ (1)
    ├─→ TestError (0..1)
    │
    │ (1)
    ├─→ PerformanceMetrics
    │
    │ (N)
    └─→ ApiCall

TestFixture (N) ←── (N) TestCase
```

---

## State Transitions

### TestCase Status Flow

```
┌─────────┐
│ pending │
└────┬────┘
     │
     ↓
┌─────────┐
│ running │
└────┬────┘
     │
     ├─→ passed (success)
     ├─→ failed (assertion failed, API error, etc.)
     ├─→ skipped (conditional skip, API unavailable)
     └─→ timedout (exceeded timeout threshold)
```

### Test Retry Flow

```
failed (retryCount < maxRetries)
   ↓
running (retry attempt)
   ↓
passed (flaky) OR failed (persistent)
```

---

## Validation Schemas

### PreferencesSchema

```typescript
interface Preferences {
  duration_min: number; // 1-30 days
  duration_max: number; // 1-30 days (must be >= duration_min)
  departure_airport: string; // IATA code (3 letters)
  travelers: number; // 1-10
  luxury_level: 'budget' | 'moderate' | 'luxury';
}
```

### ApiKeyConfigSchema

```typescript
interface ApiKeyConfig {
  amadeus: string;
  amadeusSecret: string;
  viator: string;
  serper: string;
  zai: string;
  openrouter: string;
}
```

---

## Key Design Decisions

1. **Test Results are Immutable**: Once a TestResult is created, it should not be modified. Retries create new TestResults.

2. **Costs are Estimates**: API costs are calculated estimates, not actual charges. Actual billing should be verified in provider dashboards.

3. **Performance Metrics are Informational**: Per clarifications #2 and #4, timing and cost metrics never cause test failures. They are tracked for visibility and optimization only.

4. **Fixtures are Environment-Specific**: The same fixture name (e.g., "heritage-template") can have different data in local vs. production environments (different template IDs).

5. **Flakiness Tracking**: Tests that pass after retry are marked as "flaky" and tracked separately. Target: <5% flakiness rate (per SC-010).

6. **API Calls are Tracked per Test**: Every external API call is logged with timing and cost for per-test cost analysis.

---

## Notes

- All timestamps use UTC timezone
- All costs are in USD
- All durations are in milliseconds
- File paths use absolute paths from repository root
- Test IDs follow format: `{suite} > {title}`

This data model supports all requirements from the specification:
- ✅ Test infrastructure (FR-001 through FR-005)
- ✅ API testing (FR-006 through FR-010)
- ✅ Performance tracking (FR-021 through FR-024)
- ✅ Cost tracking (FR-020, SC-012)
- ✅ Flakiness measurement (SC-010)
- ✅ Success criteria validation (SC-001 through SC-012)
