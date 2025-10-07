# Data Model: Test Suite Entities

**Feature**: 007-full-test-suite
**Phase**: 1 (Design)
**Status**: Complete

## Overview

This document defines the data structures used by the comprehensive test suite for the Voygent platform. These entities represent test scenarios, fixtures, reports, and benchmarks.

---

## Test Entities

### Test Scenario

Represents a single test case with input data, expected output, and validation criteria.

**Attributes**:
- `scenarioName` (string): Unique identifier for the test scenario (e.g., "heritage-williams-scotland")
- `theme` (string): Trip theme being tested ("heritage", "tvmovie", "historical", "culinary", "adventure")
- `inputData` (object): Test input (user text, files, URLs, theme)
- `expectedResults` (object): Expected output after processing (normalized intake, trip options, research data)
- `actualResults` (object): Actual output from test execution (populated during test run)
- `status` (enum): Test result ("passed", "failed", "skipped", "error")
- `duration` (number): Test execution time in milliseconds
- `errorMessage` (string, optional): Error details if test failed
- `assertions` (array): List of assertions performed and their results

**Relationships**:
- Part of test suite (test file)
- Associated with specific template configuration
- Uses test fixtures for input data
- Contributes to test report

**Example**:
```json
{
  "scenarioName": "heritage-williams-scotland",
  "theme": "heritage",
  "inputData": {
    "text": "I want to explore my Williams family heritage in Scotland",
    "theme": "heritage"
  },
  "expectedResults": {
    "intake": {
      "surnames": ["Williams"],
      "suspected_origins": ["Scotland"]
    },
    "optionsCount": { "min": 2, "max": 4 },
    "researchExecuted": true
  },
  "actualResults": {
    "tripId": "abc123",
    "intake": { "surnames": ["Williams"], "suspected_origins": ["Scotland"] },
    "options": [{}, {}, {}],
    "diagnostics": { "research": [{}] }
  },
  "status": "passed",
  "duration": 15234,
  "assertions": [
    { "name": "trip structure valid", "passed": true },
    { "name": "research data present", "passed": true },
    { "name": "options count in range", "passed": true }
  ]
}
```

---

### Test Report

Aggregated results from running the test suite.

**Attributes**:
- `reportId` (string): Unique identifier for this test run
- `timestamp` (string): ISO 8601 timestamp when tests ran
- `branch` (string): Git branch name
- `commit` (string): Git commit hash
- `totalTests` (number): Total number of test scenarios executed
- `passed` (number): Number of tests that passed
- `failed` (number): Number of tests that failed
- `skipped` (number): Number of tests skipped
- `totalDuration` (number): Total execution time in milliseconds
- `costSummary` (object): Aggregated AI cost data
- `coveragePercent` (number): Code coverage percentage
- `scenarios` (array): List of all test scenarios with results

**Relationships**:
- Contains multiple test scenarios
- Linked to specific git commit
- Includes performance benchmarks

**Example**:
```json
{
  "reportId": "test-run-2025-10-07-12-34-56",
  "timestamp": "2025-10-07T12:34:56Z",
  "branch": "007-full-test-suite",
  "commit": "abc123def456",
  "totalTests": 45,
  "passed": 43,
  "failed": 2,
  "skipped": 0,
  "totalDuration": 243567,
  "costSummary": {
    "totalCostUsd": 0.45,
    "averageCostPerTrip": 0.01,
    "totalTokensIn": 45000,
    "totalTokensOut": 60000
  },
  "coveragePercent": 85.3,
  "scenarios": [
    { "scenarioName": "heritage-williams-scotland", "status": "passed", "duration": 15234 },
    { "scenarioName": "tvmovie-game-of-thrones", "status": "passed", "duration": 18345 }
  ]
}
```

---

### Test Fixture

Sample data used for testing (surnames, titles, events, etc.).

**Attributes**:
- `fixtureName` (string): Unique identifier for the fixture (e.g., "heritage-williams")
- `theme` (string): Associated trip theme
- `inputText` (string): Sample user input text
- `files` (array, optional): Sample file data (genealogy documents, images)
- `urls` (array, optional): Sample URLs (genealogy sites)
- `expectedIntake` (object): Expected normalized intake JSON
- `expectedResearchQuery` (string): Expected research query after interpolation
- `mockAIResponse` (object): Pre-defined AI response for this scenario
- `mockSearchResults` (array): Pre-defined web search results

**Relationships**:
- Used by multiple test scenarios
- Defines expected outputs for validation
- Provides mock data for AI and search APIs

**Example**:
```json
{
  "fixtureName": "heritage-williams-scotland",
  "theme": "heritage",
  "inputText": "I want to explore my Williams family heritage in Scotland",
  "expectedIntake": {
    "surnames": ["Williams"],
    "suspected_origins": ["Scotland"],
    "duration_days": 7,
    "budget_tier": "comfort",
    "theme": "heritage"
  },
  "expectedResearchQuery": "Williams family heritage sites ancestral homes castles historical tours travel destinations",
  "mockAIResponse": {
    "intake": "{\"surnames\": [\"Williams\"], \"suspected_origins\": [\"Scotland\"], ...}",
    "options": "{\"options\": [{\"title\": \"Scottish Heritage Trail\", ...}]}",
    "researchSynthesis": "The Williams surname has strong Scottish roots..."
  },
  "mockSearchResults": [
    {
      "title": "Williams Clan Heritage Sites in Scotland",
      "url": "https://example.com/williams-heritage",
      "snippet": "Explore the ancestral homeland of the Williams clan in the Scottish Highlands..."
    }
  ]
}
```

---

### Performance Benchmark

Metrics captured during test execution.

**Attributes**:
- `benchmarkId` (string): Unique identifier
- `scenarioName` (string): Associated test scenario
- `operation` (string): Operation being measured ("trip_generation", "research_execution", "api_call")
- `duration` (number): Execution time in milliseconds
- `tokensIn` (number): Input tokens consumed (AI provider)
- `tokensOut` (number): Output tokens generated (AI provider)
- `costUsd` (number): Estimated cost in USD
- `timestamp` (string): When measurement was taken
- `metadata` (object): Additional context (theme, provider, model)

**Relationships**:
- Associated with test scenario
- Aggregated in test report
- Used for trend analysis

**Example**:
```json
{
  "benchmarkId": "bench-heritage-williams-001",
  "scenarioName": "heritage-williams-scotland",
  "operation": "trip_generation",
  "duration": 15234,
  "tokensIn": 1500,
  "tokensOut": 2000,
  "costUsd": 0.008,
  "timestamp": "2025-10-07T12:34:56Z",
  "metadata": {
    "theme": "heritage",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "includesResearch": true
  }
}
```

---

## Test Data Structures

### Mock AI Response

Structure for pre-defined AI provider responses.

**Format**:
```typescript
interface MockAIResponse {
  intake: string;           // JSON string of normalized intake
  options: string;          // JSON string of trip options
  researchSynthesis: string; // AI analysis of research results
}
```

**Example** (fixtures/ai-responses.json):
```json
{
  "heritage-williams": {
    "intake": "{\"surnames\": [\"Williams\"], \"suspected_origins\": [\"Scotland\"], \"duration_days\": 7, \"budget_tier\": \"comfort\", \"theme\": \"heritage\"}",
    "options": "{\"options\": [{\"title\": \"Scottish Heritage Trail\", \"cities\": [\"Edinburgh\", \"Inverness\", \"Isle of Skye\"], \"itinerary\": [...], \"estimated_budget\": 3500}]}",
    "researchSynthesis": "The Williams surname has strong Scottish roots, particularly in the Highlands region. Key heritage sites include Edinburgh Castle, Culloden Battlefield, and various clan centers in the Highlands."
  }
}
```

---

### Mock Search Result

Structure for pre-defined web search responses.

**Format**:
```typescript
interface MockSearchResult {
  title: string;
  url: string;
  snippet: string;
}
```

**Example** (fixtures/research-results.json):
```json
{
  "Williams family heritage sites Scotland": [
    {
      "title": "Williams Clan Heritage Sites in Scotland",
      "url": "https://example.com/williams-heritage",
      "snippet": "Explore the ancestral homeland of the Williams clan in the Scottish Highlands, including castles, battlefields, and clan centers."
    },
    {
      "title": "Scottish Heritage Travel: Williams Ancestry",
      "url": "https://example.com/scottish-heritage",
      "snippet": "Discover your Williams family roots with guided tours of historic sites in Edinburgh, Inverness, and the Highlands."
    }
  ]
}
```

---

## Database Schema (Test Data)

### Test Database Tables

The test suite uses the same database schema as production, but with a separate D1 database binding.

**Tables Used**:
- `themed_trips`: Stores test trip data (cleaned up after tests)
- `themed_messages`: Stores test message data (cleaned up after tests)
- `trip_templates`: Seeded with template configurations before tests
- `agencies`: Seeded with test agency data before tests

**Test Data Conventions**:
- User IDs start with `test-user-` prefix
- Agency IDs start with `test-agency-` prefix
- Trip IDs are generated normally but associated with test users
- Cleanup deletes all records where `user_id LIKE 'test-user-%'`

---

## Validation Functions

### Trip Structure Validation

Custom assertion to validate trip response structure.

**Function Signature**:
```typescript
function validateTripStructure(trip: any): void
```

**Validates**:
- Required properties exist (tripId, intake, options, diagnostics)
- Options array has 2-4 elements
- Each option has required fields (title, cities, itinerary, estimated_budget, highlights)
- Data types are correct (arrays, numbers, strings)

---

### Research Data Validation

Custom assertion to validate research execution results.

**Function Signature**:
```typescript
function validateResearchData(research: any[]): void
```

**Validates**:
- Research array is not empty (if research should have executed)
- Each research step has required fields (step, query, results, analysis, timestamp)
- Results array contains valid search results (title, url, snippet)
- Query string is not empty
- Analysis string is not empty

---

### Performance Validation

Custom assertion to validate performance benchmarks.

**Function Signature**:
```typescript
function validatePerformance(benchmark: PerformanceBenchmark, thresholds: Thresholds): void
```

**Validates**:
- Duration is under threshold (e.g., < 60 seconds)
- Cost is under threshold (e.g., < $0.10 per trip)
- Tokens consumed are reasonable (e.g., < 5000 tokens total)

---

## Summary

**Entities**: Test Scenario, Test Report, Test Fixture, Performance Benchmark
**Structures**: Mock AI Response, Mock Search Result
**Validation**: Trip structure, Research data, Performance metrics

All test entities are designed to support comprehensive testing of the Voygent platform across all 5 themes, with realistic fixtures, mocked external dependencies, and detailed reporting.
