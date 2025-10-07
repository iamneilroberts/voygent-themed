# Phase 0: Research & Discovery - E2E Production Tests

**Feature**: End-to-End Production Tests for Cloudflare VoyGent
**Date**: 2025-10-07
**Status**: Complete

## Research Questions & Findings

### 1. Production API Architecture

**Question**: How does the production API handle HTTP requests? What are the exact endpoint URLs and methods?

**Findings**:
- **Base URL**: https://voygent.app
- **API Base**: https://voygent.app/api
- **Key Endpoints**:
  - `GET /api/templates` - List available trip templates
  - `POST /api/trips` - Create new trip from user input
  - `GET /api/trips?userId={id}` - List trips for a user
  - `GET /api/trips/{id}` - Get specific trip details (not yet tested)

**Request Format** (from code review of `functions/api/trips/index.ts`):
- POST /api/trips expects **multipart/form-data** (not JSON)
- Required field: `text` (user input describing trip)
- Optional fields: `theme` (explicit theme selection), `userId` (for tracking), `urls`, `files`
- Heritage-specific: `genealogy_url`, `departure_airport`, `transport_pref`, `hotel_type`

**Response Format**:
```typescript
{
  tripId: string,
  intake: { theme, surnames, suspected_origins, ... },
  options: [ { key, title, days, cities, cost_estimate, ... } ],
  status: 'options_ready',
  template: { id, name, icon },
  diagnostics: { timestamp, steps, totalCost }
}
```

**Production Secrets**: Configured via `wrangler pages secret put`:
- OPENAI_API_KEY, ANTHROPIC_API_KEY, SERPER_API_KEY, TAVILY_API_KEY
- AMADEUS_CLIENT_ID, AMADEUS_CLIENT_SECRET, GOOGLE_PLACES_API_KEY

### 2. Database Verification

**Question**: How can E2E tests verify data was saved to production D1? How should test data be identified for cleanup?

**Findings**:
- **Database**: voygent-themed (62077781-9458-4206-a5c6-f38dc419e599)
- **Tables**: themed_trips, themed_messages, trip_templates, agencies, provider_cache
- **Key Columns**:
  - themed_trips: id, user_id, agency_id, template, status, intake_json, options_json, diagnostics, created_at, updated_at
  - themed_messages: id, trip_id, role, content, tokens_in, tokens_out, cost_usd

**Verification Approach**:
1. Create trip via API, capture tripId from response
2. Query database using wrangler CLI: `wrangler d1 execute voygent-themed --command "SELECT * FROM themed_trips WHERE id = '{tripId}'"`
3. Validate fields: intake_json is valid JSON, options_json has 2-4 options, diagnostics includes cost tracking

**Test Data Identification**:
- Use unique user_id prefix: `e2e-test-{timestamp}-{random}`
- Example: `e2e-test-1759854000-abc123`
- Cleanup query: `DELETE FROM themed_trips WHERE user_id LIKE 'e2e-test-%'`

**Cleanup Strategy**:
1. Track all test user_ids in test report
2. After test suite completes, run cleanup: `DELETE FROM themed_messages WHERE trip_id IN (SELECT id FROM themed_trips WHERE user_id LIKE 'e2e-test-%')`
3. Then: `DELETE FROM themed_trips WHERE user_id LIKE 'e2e-test-%'`
4. Verify cleanup: `SELECT COUNT(*) FROM themed_trips WHERE user_id LIKE 'e2e-test-%'` (should be 0)

### 3. Test Execution Environment

**Question**: Should tests use TypeScript/Vitest or bash/curl? What HTTP client library is best?

**Findings**:
- **Existing Work**: We already have `test-production.sh` bash script from deployment (feature 007)
- **Bash Advantages**:
  - Simple, portable, no build step
  - curl is universally available
  - jq for JSON parsing
  - Easy to debug and modify
  - Can run in any CI/CD environment
- **TypeScript Advantages**:
  - Type safety, better error handling
  - Reuses existing test helpers from feature 007
  - Better suited for complex logic

**Recommendation**: **Use bash/curl for initial implementation**
- Build on existing test-production.sh script
- Simpler to maintain and debug
- Faster iteration during development
- Can migrate to TypeScript later if complexity grows

**HTTP Client**: `curl` with common options:
- `-s` (silent), `-X POST` (method), `-d` (form data), `-H` (headers)
- Response parsing with `jq` for JSON extraction

### 4. Production Variability

**Question**: What is the expected range for response times? How much cost variation is acceptable?

**Findings from Manual Testing** (2025-10-07):
- **Template Listing**: < 1 second (very fast, no AI calls)
- **Trip Creation**: 15-20 seconds (includes AI processing)
  - Breakdown: Intake normalization (2s) + Options generation (13-18s)
  - Cold start adds ~2-5 seconds
- **Cost per Trip**: ~$0.00084 (actual measured)
  - Intake: $0.000126 (gpt-4o-mini)
  - Options: $0.000719 (gpt-4o-mini)

**Expected Ranges** (for test assertions):
- Response time: 5-60 seconds (account for cold starts)
- Cost per trip: $0.0005 - $0.01 (depending on input complexity and model selection)
- Cold start: First request after idle may take up to 5 seconds extra

**Retry Logic**:
- Timeout: 60 seconds per request
- Retry transient failures (5xx errors) up to 2 times
- Don't retry 4xx errors (client errors)

### 5. Data Cleanup Strategy

**Question**: How should test data be tagged? When should cleanup run? What if cleanup fails?

**Findings**:
- **Tagging**: Use `e2e-test-{timestamp}` prefix for user_id
- **Cleanup Timing**: After full test suite completes (in afterAll hook or at script end)
- **Cleanup Order**: Delete themed_messages first (foreign key constraint), then themed_trips
- **Orphaned Data**: If cleanup fails, next test run should still work (new unique IDs)
- **Manual Cleanup**: Provide separate script: `cleanup-e2e-test-data.sh`

**Implementation**:
```bash
cleanup_test_data() {
  echo "Cleaning up test data..."

  # Delete messages first
  wrangler d1 execute voygent-themed --command \
    "DELETE FROM themed_messages WHERE trip_id IN (SELECT id FROM themed_trips WHERE user_id LIKE 'e2e-test-%')" --remote

  # Delete trips
  wrangler d1 execute voygent-themed --command \
    "DELETE FROM themed_trips WHERE user_id LIKE 'e2e-test-%'" --remote

  # Verify
  local remaining=$(wrangler d1 execute voygent-themed --command \
    "SELECT COUNT(*) as count FROM themed_trips WHERE user_id LIKE 'e2e-test-%'" --remote --json | jq -r '.[0].results[0].count')

  if [ "$remaining" -eq 0 ]; then
    echo "✓ Cleanup successful"
  else
    echo "⚠ Warning: $remaining test trips remain"
  fi
}
```

### 6. Existing Test Infrastructure

**Question**: Can existing test helpers from feature 007 be reused? Is there CI/CD integration?

**Findings**:
- **Feature 007**: Created comprehensive unit and integration test suite
  - Location: `tests/unit/`, `tests/integration/`
  - Helpers: `tests/helpers/test-db.ts`, `tests/helpers/migrations.ts`
  - Framework: Vitest with @cloudflare/vitest-pool-workers
- **Reusability**: Limited - feature 007 tests run against local/dev environment, not production
- **CI/CD**: No existing CI/CD configuration found

**Key Differences**:
- Feature 007: Tests local code with mocked APIs
- Feature 008: Tests live production with real APIs and database
- Cannot reuse test-db.ts helpers (they create in-memory databases)
- Can reference fixtures and test patterns

**New Infrastructure Needed**:
1. Production API client (HTTP wrapper)
2. Production database verification (wrangler d1 commands)
3. Test cleanup utilities
4. Report generation
5. CI/CD integration script (GitHub Actions or similar)

## Summary of Key Decisions

### Technology Choices
- **Test Framework**: Bash + curl + jq (simple, portable)
- **HTTP Client**: curl with standard options
- **JSON Parsing**: jq for response validation
- **Database Access**: wrangler d1 execute commands

### Test Design
- **Test Isolation**: Unique user_id prefix (`e2e-test-{timestamp}-{uuid}`)
- **Cleanup Strategy**: After suite completion, delete by user_id pattern
- **Response Validation**: Check status codes, JSON structure, field presence
- **Performance Benchmarks**: Measure and report duration/cost, allow ranges

### Test Coverage
- **Primary Focus**: One test per theme (5 total) + template listing + error cases
- **Secondary**: Database verification, performance measurement
- **Out of Scope**: Exhaustive edge case testing (covered by feature 007)

### CI/CD Integration
- **Initial**: Manual execution via command line
- **Future**: GitHub Actions workflow for post-deployment validation

## Open Questions & Risks

### Resolved
- ✅ Request format (form data vs JSON) - RESOLVED: form data with `text` field
- ✅ Cleanup approach - RESOLVED: user_id prefix pattern matching
- ✅ Test framework choice - RESOLVED: bash/curl for simplicity

### Remaining
- ⚠️ **Performance variability**: How to handle cold starts in assertions?
  - **Mitigation**: Use wide ranges (5-60s) and mark tests as flaky
- ⚠️ **Cost accumulation**: Running E2E tests frequently could add up
  - **Mitigation**: Limit test frequency, document cost per run
- ⚠️ **Production impact**: Could test traffic affect real users?
  - **Mitigation**: Use minimal test cases, cleanup promptly, run during low-traffic periods

## Recommendations for Implementation

1. **Start with bash script** - Build on existing test-production.sh
2. **Implement cleanup first** - Ensure we don't pollute production
3. **Add database verification** - Prove data persists correctly
4. **Measure everything** - Track duration, costs, success rates
5. **Document thoroughly** - Make it easy for others to run and debug
6. **Consider CI/CD integration** - Automate post-deployment validation

## References

**Code Reviewed**:
- `/functions/api/trips/index.ts` - Trip creation endpoint
- `/functions/api/templates/index.ts` - Template listing endpoint
- `/tests/helpers/test-db.ts` - Test database utilities (feature 007)
- `/test-production.sh` - Existing production test script

**Documentation Reviewed**:
- DEPLOYMENT_SUMMARY.md - Production deployment details
- specs/007-full-test-suite/ - Existing test suite documentation

**Production Resources**:
- Database: voygent-themed (62077781-9458-4206-a5c6-f38dc419e599)
- Deployment: https://voygent.app (7b995348.voygent-themed.pages.dev)
- Secrets: Configured via wrangler pages secret
