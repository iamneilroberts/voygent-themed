# Phase 1: Data Model - E2E Production Tests

**Feature**: End-to-End Production Tests for Cloudflare VoyGent
**Date**: 2025-10-07
**Status**: Complete

## Overview

This document defines the data structures and contracts for the E2E production test suite. Since tests interact with a live production API rather than in-process code, the data model focuses on HTTP contracts, test metadata, and database verification structures.

---

## Test Scenario Data Model

Represents a single E2E test case that executes against production.

### Structure
```typescript
interface TestScenario {
  // Identification
  id: string;                    // Unique test ID (e.g., "heritage-basic-trip")
  name: string;                  // Human-readable test name
  category: string;              // Test category (api, theme, database, performance, error)
  theme?: string;                // Trip theme if applicable (heritage, tvmovie, etc.)

  // Test Input
  request: {
    method: 'GET' | 'POST';
    endpoint: string;            // Relative path (e.g., "/api/trips")
    formData?: Record<string, string>;  // Form fields for POST requests
    queryParams?: Record<string, string>; // Query params for GET requests
  };

  // Expected Outcome
  expected: {
    statusCode: number;          // Expected HTTP status (200, 400, 404)
    responseFields: string[];    // Required fields in response (e.g., ["tripId", "intake"])
    responseChecks?: {           // Custom validation checks
      field: string;
      condition: 'exists' | 'equals' | 'contains' | 'matches';
      value?: any;
    }[];
    databaseChecks?: {           // Database validation queries
      table: string;
      condition: string;         // SQL WHERE clause
      expectedCount?: number;
    }[];
  };

  // Test Execution Results
  actual?: {
    statusCode: number;
    responseBody: any;
    responseTime: number;        // Milliseconds
    cost?: number;               // USD if applicable
    errorMessage?: string;
  };

  // Test Status
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  startTime?: number;            // Unix timestamp
  endTime?: number;              // Unix timestamp
  duration?: number;             // Milliseconds
}
```

### Example: Heritage Theme Test
```json
{
  "id": "heritage-williams-scotland",
  "name": "Create heritage trip for Williams family in Scotland",
  "category": "theme",
  "theme": "heritage",
  "request": {
    "method": "POST",
    "endpoint": "/api/trips",
    "formData": {
      "theme": "heritage",
      "text": "Williams family from Scotland, interested in ancestral heritage sites",
      "userId": "e2e-test-1759854000-abc123"
    }
  },
  "expected": {
    "statusCode": 200,
    "responseFields": ["tripId", "intake", "options", "diagnostics"],
    "responseChecks": [
      { "field": "intake.theme", "condition": "equals", "value": "heritage" },
      { "field": "intake.surnames", "condition": "contains", "value": "Williams" },
      { "field": "options", "condition": "matches", "value": "length >= 2 && length <= 4" }
    ],
    "databaseChecks": [
      { "table": "themed_trips", "condition": "id = '{tripId}' AND status = 'options_ready'" }
    ]
  },
  "status": "pending"
}
```

---

## Test Report Data Model

Aggregates results from a full E2E test run.

### Structure
```typescript
interface TestReport {
  // Test Run Metadata
  runId: string;                 // Unique run identifier
  timestamp: number;             // Unix timestamp of test run start
  environment: {
    targetUrl: string;           // Production URL tested (https://voygent.app)
    testerHost: string;          // Host running tests (CI server, local machine)
    gitCommit?: string;          // Git commit hash of deployment being tested
  };

  // Test Execution Summary
  summary: {
    total: number;               // Total tests executed
    passed: number;              // Tests that passed
    failed: number;              // Tests that failed
    skipped: number;             // Tests skipped
    duration: number;            // Total duration in milliseconds
    totalCost: number;           // Total AI costs incurred (USD)
  };

  // Test Results
  scenarios: TestScenario[];     // All test scenarios with results

  // Performance Metrics
  performance: {
    avgResponseTime: number;     // Average response time across all tests (ms)
    maxResponseTime: number;     // Slowest response time (ms)
    minResponseTime: number;     // Fastest response time (ms)
    coldStartTests: string[];    // Test IDs that likely hit cold start
  };

  // Cost Tracking
  costs: {
    totalCost: number;           // Total USD spent on AI calls
    costByTheme: Record<string, number>; // Cost breakdown by theme
    avgCostPerTrip: number;      // Average cost per trip creation
  };

  // Cleanup Status
  cleanup: {
    testTripsCreated: string[];  // Trip IDs created during tests
    testUsersCreated: string[];  // User IDs used during tests
    cleanupSuccess: boolean;     // Whether cleanup completed successfully
    remainingRecords: number;    // Number of test records not cleaned up
  };

  // Failures
  failures: {
    testId: string;
    testName: string;
    error: string;
    responseBody?: any;
  }[];
}
```

### Example Test Report
```json
{
  "runId": "e2e-run-1759854000",
  "timestamp": 1759854000,
  "environment": {
    "targetUrl": "https://voygent.app",
    "testerHost": "github-actions-runner-3",
    "gitCommit": "7b995348"
  },
  "summary": {
    "total": 8,
    "passed": 7,
    "failed": 1,
    "skipped": 0,
    "duration": 125000,
    "totalCost": 0.042
  },
  "performance": {
    "avgResponseTime": 18500,
    "maxResponseTime": 32000,
    "minResponseTime": 800,
    "coldStartTests": ["heritage-williams-scotland"]
  },
  "costs": {
    "totalCost": 0.042,
    "costByTheme": {
      "heritage": 0.0084,
      "tvmovie": 0.0091,
      "historical": 0.0079,
      "culinary": 0.0088,
      "adventure": 0.0078
    },
    "avgCostPerTrip": 0.0084
  },
  "cleanup": {
    "testTripsCreated": ["abc123", "def456", "ghi789"],
    "testUsersCreated": ["e2e-test-1759854000-abc123"],
    "cleanupSuccess": true,
    "remainingRecords": 0
  },
  "failures": [
    {
      "testId": "adventure-patagonia",
      "testName": "Create adventure trip for Patagonia hiking",
      "error": "Response timeout after 60 seconds",
      "responseBody": null
    }
  ]
}
```

---

## Cleanup Record Data Model

Tracks test data that needs to be removed from production database.

### Structure
```typescript
interface CleanupRecord {
  runId: string;                 // Associated test run ID
  userId: string;                // Test user ID (e.g., "e2e-test-1759854000-abc123")
  tripIds: string[];             // Trip IDs created by this user
  messageIds: string[];          // Message IDs associated with trips
  createdAt: number;             // Timestamp when record was created
  cleanupStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  cleanupAttempts: number;       // Number of cleanup attempts
  lastCleanupAttempt?: number;   // Timestamp of last attempt
  errorMessage?: string;         // Error if cleanup failed
}
```

### Example Cleanup Record
```json
{
  "runId": "e2e-run-1759854000",
  "userId": "e2e-test-1759854000-abc123",
  "tripIds": ["abc123", "def456"],
  "messageIds": ["msg001", "msg002"],
  "createdAt": 1759854000,
  "cleanupStatus": "completed",
  "cleanupAttempts": 1,
  "lastCleanupAttempt": 1759854200
}
```

---

## Production API Contracts

### GET /api/templates

**Request**: None (simple GET)

**Response** (200 OK):
```typescript
{
  templates: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    exampleInputs: string[];
    tags: string[];
    isFeatured: boolean;
    displayOrder: number;
  }>
}
```

**Test Validation**:
- Status code is 200
- Response contains `templates` array
- Array has at least 1 template
- Each template has required fields: id, name, description, icon

---

### POST /api/trips

**Request** (multipart/form-data):
```typescript
{
  text: string;           // Required: User input describing trip
  theme?: string;         // Optional: Explicit theme selection
  userId?: string;        // Optional: User identifier
  urls?: string;          // Optional: Additional URLs
  files?: File[];         // Optional: Uploaded files
}
```

**Response** (200 OK):
```typescript
{
  tripId: string;
  intake: {
    theme: string;
    surnames?: string[];
    suspected_origins?: string[];
    titles?: string[];
    events?: string[];
    cuisines?: string[];
    regions?: string[];
    destinations?: string[];
    activities?: string[];
    duration_days?: number;
    party?: {
      adults: number;
      children: number[];
    };
    interests?: string[];
  };
  options: Array<{
    key: string;
    title: string;
    whyOverall: string;
    days: Array<{
      d: number;
      city: string;
      country: string;
      am: string;
      pm: string;
      drive?: string;
      rail?: string;
      why: string;
    }>;
    splurges?: string[];
    cost_estimate: {
      lodging_per_night: number;
      transport_total: number;
      activities_per_day: number;
      meals_per_day: number;
      total_per_person: number;
      breakdown_notes: string;
    };
    highlights: string[];
  }>;
  status: string;
  template: {
    id: string;
    name: string;
    icon: string;
  };
  diagnostics: {
    timestamp: string;
    template: { id: string; name: string };
    steps: Array<{
      step: string;
      model?: string;
      tokensIn?: number;
      tokensOut?: number;
      costUsd?: number;
      query?: string;
      results?: any;
    }>;
    intake: { model: string; tokensIn: number; tokensOut: number; costUsd: number };
    options: { model: string; tokensIn: number; tokensOut: number; costUsd: number };
    totalCost: number;
  };
}
```

**Response** (400 Bad Request):
```typescript
{
  error: string;  // Error message (e.g., "No input provided")
}
```

**Test Validation**:
- Status code is 200 for valid requests
- Status code is 400 for missing/invalid input
- Response contains tripId, intake, options, status, diagnostics
- options array has 2-4 elements
- Each option has required fields: key, title, days, cost_estimate
- diagnostics.totalCost is a number > 0

---

### GET /api/trips?userId={userId}

**Request**: Query parameter `userId` (required)

**Response** (200 OK):
```typescript
{
  trips: Array<{
    id: string;
    user_id: string;
    template: string;
    title?: string;
    status: string;
    created_at: number;
    updated_at: number;
  }>
}
```

**Response** (400 Bad Request):
```typescript
{
  error: string;
  details: string;
}
```

**Test Validation**:
- Status code is 200 with valid userId
- Status code is 400 without userId
- Response contains `trips` array
- Each trip has required fields: id, user_id, template, status

---

## Database Verification Queries

### Verify Trip Creation

**Query**:
```sql
SELECT id, user_id, template, status, intake_json, options_json, diagnostics
FROM themed_trips
WHERE id = '{tripId}'
```

**Expected Result**:
- 1 row returned
- status = 'options_ready'
- intake_json is valid JSON (can be parsed)
- options_json is valid JSON and contains 2-4 options
- diagnostics is valid JSON and contains cost tracking

**Validation Command**:
```bash
wrangler d1 execute voygent-themed \
  --command "SELECT * FROM themed_trips WHERE id = '{tripId}'" \
  --remote --json
```

---

### Verify Research Data

**Query**:
```sql
SELECT diagnostics
FROM themed_trips
WHERE id = '{tripId}'
```

**Expected Result**:
- diagnostics JSON contains steps array
- At least one step with `step` containing "research"
- Research step has: query, results, analysis

---

### Count Test Data (for cleanup verification)

**Query**:
```sql
SELECT COUNT(*) as count
FROM themed_trips
WHERE user_id LIKE 'e2e-test-%'
```

**Expected Result**:
- count = 0 (after successful cleanup)
- count > 0 (indicates orphaned test data)

---

## Performance Baseline Data Model

Expected performance metrics for production environment.

### Structure
```typescript
interface PerformanceBaseline {
  theme: string;
  expectedDuration: {
    min: number;    // Minimum expected duration (ms)
    avg: number;    // Average expected duration (ms)
    max: number;    // Maximum acceptable duration (ms)
  };
  expectedCost: {
    min: number;    // Minimum expected cost (USD)
    avg: number;    // Average expected cost (USD)
    max: number;    // Maximum acceptable cost (USD)
  };
  tolerance: {
    durationVariance: number;  // Acceptable variance % (e.g., 0.25 = 25%)
    costVariance: number;      // Acceptable cost variance % (e.g., 0.20 = 20%)
  };
}
```

### Baselines by Theme

```json
{
  "heritage": {
    "expectedDuration": { "min": 10000, "avg": 18000, "max": 60000 },
    "expectedCost": { "min": 0.0005, "avg": 0.0084, "max": 0.02 },
    "tolerance": { "durationVariance": 0.5, "costVariance": 0.3 }
  },
  "tvmovie": {
    "expectedDuration": { "min": 10000, "avg": 20000, "max": 60000 },
    "expectedCost": { "min": 0.0006, "avg": 0.0091, "max": 0.02 },
    "tolerance": { "durationVariance": 0.5, "costVariance": 0.3 }
  },
  "historical": {
    "expectedDuration": { "min": 10000, "avg": 17000, "max": 60000 },
    "expectedCost": { "min": 0.0005, "avg": 0.0079, "max": 0.02 },
    "tolerance": { "durationVariance": 0.5, "costVariance": 0.3 }
  },
  "culinary": {
    "expectedDuration": { "min": 10000, "avg": 19000, "max": 60000 },
    "expectedCost": { "min": 0.0006, "avg": 0.0088, "max": 0.02 },
    "tolerance": { "durationVariance": 0.5, "costVariance": 0.3 }
  },
  "adventure": {
    "expectedDuration": { "min": 10000, "avg": 16000, "max": 60000 },
    "expectedCost": { "min": 0.0005, "avg": 0.0078, "max": 0.02 },
    "tolerance": { "durationVariance": 0.5, "costVariance": 0.3 }
  }
}
```

**Note**: Baselines are approximate based on initial production testing (2025-10-07). Wide tolerances account for cold starts and production variability.

---

## Summary

This data model defines:
1. **TestScenario**: Structure for individual E2E test cases
2. **TestReport**: Aggregated test run results with metrics
3. **CleanupRecord**: Tracking for production data cleanup
4. **API Contracts**: Production endpoint request/response formats
5. **Database Queries**: Verification queries for production D1
6. **Performance Baselines**: Expected metrics with tolerances

All data structures are designed to support automated E2E testing against the live production environment at voygent.app while ensuring proper cleanup and reporting.
