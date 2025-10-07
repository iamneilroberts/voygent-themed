# Research: Comprehensive Test Suite Implementation

**Feature**: 007-full-test-suite
**Phase**: 0 (Research & Technical Decisions)
**Status**: Complete

## Research Questions & Decisions

### 1. What test framework is compatible with Cloudflare Pages Functions?

**Decision**: Vitest with @cloudflare/vitest-pool-workers

**Rationale**:
- Vitest is a modern, fast test framework with excellent TypeScript support
- @cloudflare/vitest-pool-workers executes tests in actual Workers runtime environment
- Avoids Node.js compatibility issues (native fetch, D1 database, Workers APIs)
- Faster than Jest for TypeScript projects
- Better developer experience with watch mode and UI

**Alternatives Considered**:
- Jest: Requires extensive mocking for Workers APIs, slower, less TypeScript-native
- Mocha/Chai: Older ecosystem, lacks Workers runtime support
- Miniflare (standalone): Good for unit tests but harder to integrate with test framework

---

### 2. How to mock AI provider API calls?

**Decision**: Create mock implementations that return pre-defined responses from fixtures

**Implementation**:
```typescript
// tests/helpers/mock-providers.ts
export function mockCallProvider(fixtureResponses: Record<string, string>) {
  return async (config: ProviderConfig, request: ProviderRequest) => {
    const key = `${request.systemPrompt.slice(0, 50)}-${request.userPrompt.slice(0, 50)}`;
    const content = fixtureResponses[key] || fixtureResponses['default'];
    return {
      content,
      tokensIn: estimateTokens(request.systemPrompt + request.userPrompt),
      tokensOut: estimateTokens(content),
      costUsd: 0.001 // Mock cost
    };
  };
}
```

**Rationale**:
- Eliminates expensive API calls during testing
- Ensures deterministic test results
- Allows testing of specific AI response scenarios
- Prevents rate limiting and API failures

---

### 3. How to set up isolated test database?

**Decision**: Use separate D1 database binding for tests, populate with seed data, clean up after

**Implementation**:
```typescript
// tests/helpers/test-db.ts
export async function setupTestDatabase(db: D1Database) {
  // Run migrations
  await runMigrations(db);

  // Seed templates
  await seedTemplates(db);

  // Return cleanup function
  return async () => {
    await db.prepare('DELETE FROM themed_trips WHERE user_id LIKE ?').bind('test-user-%').run();
    await db.prepare('DELETE FROM themed_messages WHERE trip_id LIKE ?').bind('test-trip-%').run();
  };
}
```

**Configuration** (wrangler.toml):
```toml
[[d1_databases]]
binding = "TEST_DB"
database_name = "voygent-test"
database_id = "test-database-id"
```

**Rationale**:
- Separate database prevents test data from polluting production
- Real D1 database validates actual persistence logic (not mocked)
- Cleanup ensures tests don't affect each other
- Seed data ensures templates and agencies exist for tests

---

### 4. How to test research execution without calling real web search APIs?

**Decision**: Mock Tavily/Serper responses with fixtures

**Implementation**:
```typescript
// tests/helpers/mock-search.ts
export function mockSerperWebSearch(fixtures: Record<string, SearchResult>) {
  return async (env: any, params: { q: string }) => {
    const results = fixtures[params.q] || fixtures['default'];
    return {
      provider: 'serper',
      query: params.q,
      results,
      cached: false,
      search_date: new Date().toISOString()
    };
  };
}
```

**Fixture Example** (fixtures/research-results.json):
```json
{
  "Williams family heritage sites Scotland": {
    "results": [
      {
        "title": "Williams Clan Heritage Sites in Scotland",
        "url": "https://example.com/williams-heritage",
        "snippet": "Explore the ancestral homeland of the Williams clan..."
      }
    ]
  }
}
```

**Rationale**:
- Eliminates dependency on external APIs
- Ensures consistent test results
- Allows testing of specific search result scenarios
- Faster test execution (no network calls)

---

### 5. How to measure performance and cost in tests?

**Decision**: Capture timing data and token counts, aggregate in test report

**Implementation**:
```typescript
// Performance measurement
const startTime = Date.now();
const response = await generateTrip(input);
const duration = Date.now() - startTime;

expect(duration).toBeLessThan(60000); // < 60 seconds

// Cost tracking
const totalCost = response.diagnostics.intake.costUsd +
                  response.diagnostics.options.costUsd;
expect(totalCost).toBeLessThan(0.10); // < $0.10 per trip

// Aggregate in report
testReport.benchmarks.push({
  scenario: 'heritage-williams',
  duration,
  cost: totalCost,
  tokensIn: response.diagnostics.intake.tokensIn + response.diagnostics.options.tokensIn,
  tokensOut: response.diagnostics.intake.tokensOut + response.diagnostics.options.tokensOut
});
```

**Rationale**:
- Identifies performance bottlenecks
- Tracks cost trends over time
- Validates performance requirements (< 60s, < $0.10)
- Helps optimize expensive operations

---

### 6. How to handle concurrent test execution?

**Decision**: Use unique user IDs and agency IDs for each test to avoid conflicts

**Implementation**:
```typescript
const testId = crypto.randomUUID();
const userId = `test-user-${testId}`;
const agencyId = `test-agency-${testId}`;

// Use in test
const trip = await createTrip(userId, agencyId, input);

// Cleanup
await db.prepare('DELETE FROM themed_trips WHERE user_id = ?').bind(userId).run();
```

**Rationale**:
- Allows parallel test execution (faster)
- No conflicts between concurrent tests
- Easier cleanup (filter by user ID)
- Matches production multi-user behavior

---

### 7. What assertions are needed for trip validation?

**Decision**: Verify structure, required fields, data types, and business logic

**Implementation**:
```typescript
// tests/helpers/assertions.ts
export function validateTripStructure(trip: any) {
  expect(trip).toHaveProperty('tripId');
  expect(trip).toHaveProperty('intake');
  expect(trip).toHaveProperty('options');
  expect(trip).toHaveProperty('diagnostics');

  expect(trip.options).toBeArray();
  expect(trip.options.length).toBeGreaterThanOrEqual(2);
  expect(trip.options.length).toBeLessThanOrEqual(4);

  trip.options.forEach((option: any) => {
    expect(option).toHaveProperty('title');
    expect(option).toHaveProperty('cities');
    expect(option).toHaveProperty('itinerary');
    expect(option).toHaveProperty('estimated_budget');
    expect(option).toHaveProperty('highlights');
    expect(option.cities).toBeArray();
    expect(option.estimated_budget).toBeGreaterThan(0);
  });
}

export function validateResearchData(research: any[]) {
  expect(research).toBeArray();
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
  });
}
```

**Rationale**:
- Reusable assertions reduce code duplication
- Comprehensive validation catches structural issues
- Type-safe assertions catch data type errors
- Business logic validation ensures correctness

---

### 8. How to test template query interpolation?

**Decision**: Unit tests with sample templates and intake data, verify placeholder replacement

**Implementation**:
```typescript
// tests/unit/template-interpolation.test.ts
describe('Query Interpolation', () => {
  test('replaces {surname} placeholder', () => {
    const template = '{surname} family heritage sites';
    const intake = { surnames: ['Williams'] };
    const result = interpolateResearchQuery(template, intake);
    expect(result).toBe('Williams family heritage sites');
  });

  test('replaces multiple placeholders', () => {
    const template = '{cuisine} {region} restaurants';
    const intake = { cuisines: ['Italian'], regions: ['Tuscany'] };
    const result = interpolateResearchQuery(template, intake);
    expect(result).toBe('Italian Tuscany restaurants');
  });

  test('removes unused placeholders', () => {
    const template = '{cuisine} {region} restaurants';
    const intake = { cuisines: ['Italian'], regions: [] };
    const result = interpolateResearchQuery(template, intake);
    expect(result).toBe('Italian  restaurants'); // Region removed
  });
});
```

**Rationale**:
- Fast unit tests provide immediate feedback
- Covers all placeholder types
- Tests edge cases (missing data, empty arrays)
- Independent of database and API calls

---

### 9. How to validate database persistence?

**Decision**: Query test database after operations, compare actual vs expected data

**Implementation**:
```typescript
// Integration test
test('saves research to diagnostics column', async () => {
  const input = heritageInputs.williams;
  const response = await POST('/api/trips', { body: input });

  const tripId = response.tripId;
  const dbTrip = await db.prepare('SELECT * FROM themed_trips WHERE id = ?')
    .bind(tripId)
    .first();

  expect(dbTrip).toBeTruthy();
  expect(dbTrip.diagnostics).toBeTruthy();

  const diagnostics = JSON.parse(dbTrip.diagnostics);
  expect(diagnostics.research).toBeArray();
  expect(diagnostics.research.length).toBeGreaterThan(0);

  validateResearchData(diagnostics.research);
});
```

**Rationale**:
- Verifies actual database writes (not just in-memory state)
- Catches serialization errors (JSON.stringify/parse)
- Validates data integrity across layers
- Ensures API and database agree on data

---

### 10. How to structure test fixtures?

**Decision**: JSON files with realistic inputs per theme, expected outputs, and edge cases

**Structure**:
```
fixtures/
├── heritage-inputs.json          # Sample inputs for heritage theme
├── tvmovie-inputs.json           # Sample inputs for TV/movie theme
├── historical-inputs.json        # Sample inputs for historical theme
├── culinary-inputs.json          # Sample inputs for culinary theme
├── adventure-inputs.json         # Sample inputs for adventure theme
├── templates.json                # Sample template configurations
├── ai-responses.json             # Mocked AI provider responses
└── research-results.json         # Mocked web search results
```

**Example** (heritage-inputs.json):
```json
{
  "williams": {
    "text": "I want to explore my Williams family heritage in Scotland",
    "theme": "heritage",
    "expected": {
      "surnames": ["Williams"],
      "suspected_origins": ["Scotland"],
      "theme": "heritage"
    }
  },
  "mcleod_detailed": {
    "text": "McLeod family trip to Scotland, interested in castles and historical sites",
    "theme": "heritage",
    "expected": {
      "surnames": ["McLeod"],
      "suspected_origins": ["Scotland"],
      "interests": ["castles", "historical sites"],
      "theme": "heritage"
    }
  }
}
```

**Rationale**:
- Realistic test data ensures tests match production scenarios
- Multiple scenarios per theme cover happy path and edge cases
- Expected outputs enable automated validation
- Easy to add new test cases without changing code

---

## Implementation Summary

**Test Framework**: Vitest + @cloudflare/vitest-pool-workers
**Mock Strategy**: Mock AI providers, web search; use real D1 database
**Test Data**: JSON fixtures with realistic inputs and expected outputs
**Database**: Separate test D1 database with cleanup between tests
**Assertions**: Custom validation functions for trip structure and research data
**Performance**: Measure duration and cost, validate against thresholds
**Concurrency**: Unique user/agency IDs per test for isolation

**Key Files**:
- `tests/helpers/test-db.ts`: Database setup and cleanup
- `tests/helpers/mock-providers.ts`: AI provider mocks
- `tests/helpers/mock-search.ts`: Web search mocks
- `tests/helpers/assertions.ts`: Custom assertions
- `tests/fixtures/*.json`: Test data and expected outputs

**Next Steps**: Phase 1 (Design) - Create data-model.md and quickstart.md
