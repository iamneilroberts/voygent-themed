# Feature 011 Testing Guide

## Overview

Comprehensive testing for the template-driven trip system, including unit tests, integration tests, and manual testing procedures.

---

## Phase 12: Integration Tests

### Test Scenarios

#### T068: Culinary Heritage Scenario
**Purpose**: Test complete workflow for culinary trip template

**Steps**:
1. Create trip with culinary template
2. Verify research generation
3. Test research-viewed gate enforcement
4. Mark research as viewed
5. Generate trip options
6. Get flight estimates
7. Get hotel estimates
8. Track user selections

**Expected Results**:
- Research summary contains culinary keywords
- Options gate enforced until research viewed
- 3-4 trip options generated
- Price estimates include margin (10-25%)
- Selections tracked in database

---

#### T069: Scottish Heritage Scenario
**Purpose**: Test heritage-specific research and tour features

**Steps**:
1. Create trip with heritage template
2. Verify heritage-specific research (clan/surname)
3. Generate options with heritage focus
4. Get tour estimates for historical sites

**Expected Results**:
- Research mentions clan names, castles, historical sites
- Tour options include heritage tours
- Pricing includes margin

---

#### T070: Agent Handoff Workflow
**Purpose**: Test B2B2C handoff document creation and agent quoting

**Steps**:
1. Complete trip creation (any template)
2. Create handoff document
3. Retrieve handoff document
4. Export as JSON
5. Agent submits quote
6. List agent's quotes

**Expected Results**:
- Handoff document contains:
  - Chat history (last 100 messages)
  - Research summary
  - User preferences
  - All options shown
  - Selected options
  - Daily itinerary
  - Total estimate with margin
- JSON export is complete
- Agent quote >= total estimate
- Quote status updates from 'pending' to 'quoted'
- 30-day expiry set

---

#### T071: Diagnostics Integration
**Purpose**: Test Feature 006 diagnostics integration

**Steps**:
1. Get trip diagnostics
2. Stream logs in real-time
3. Filter logs by level and category
4. Check system health
5. Get provider statistics

**Expected Results**:
- Diagnostics show template used, providers called, costs
- Logs stream with correlation_id = trip_id
- Log filters work correctly
- Health check reports database connectivity
- Provider stats show call counts, tokens, costs

---

## Running Integration Tests

### Prerequisites

```bash
# 1. Start local development server
npm run dev

# 2. Ensure test database is accessible
npx wrangler d1 list

# 3. Verify environment variables set
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY
```

### Run All Tests

```bash
./scripts/run-integration-tests.sh
```

### Run Specific Test Suite

```bash
npx vitest run tests/integration/template-driven-workflow.test.ts -t "Culinary Heritage"
```

### Watch Mode (for development)

```bash
npx vitest watch tests/integration/
```

---

## Manual Testing

### Complete Trip Flow

```bash
# 1. Create trip
curl -X POST http://localhost:8788/api/trips \
  -F "text=I want to explore Italian culinary traditions" \
  -F "theme=culinary" \
  -F "userId=manual-test-user"

# Response: {"tripId": "...", "status": "research_ready"}

# 2. Get research
curl http://localhost:8788/api/trips/TRIP_ID/research

# 3. Mark research viewed
curl -X PATCH http://localhost:8788/api/trips/TRIP_ID/research

# 4. Generate options
curl -X POST http://localhost:8788/api/trips/TRIP_ID/options \
  -H "Content-Type: application/json" \
  -d '{"preferences": {"luxuryLevel": "comfort", "days": 7}}'

# 5. Get flight estimates
curl -X POST http://localhost:8788/api/trips/TRIP_ID/estimates/flights \
  -H "Content-Type: application/json" \
  -d '{"from": "JFK", "to": "FCO", "departureDate": "2025-06-15", "adults": 2}'

# 6. Get hotel estimates
curl -X POST http://localhost:8788/api/trips/TRIP_ID/estimates/hotels \
  -H "Content-Type: application/json" \
  -d '{"city": "Rome", "checkin": "2025-06-15", "checkout": "2025-06-22", "adults": 2}'

# 7. Track selections
curl -X POST http://localhost:8788/api/trips/TRIP_ID/selections \
  -H "Content-Type: application/json" \
  -d '{"selections": [{"type": "flight", "optionId": "flight_1", "optionData": {}}]}'

# 8. Create handoff
curl -X POST http://localhost:8788/api/trips/TRIP_ID/handoff \
  -H "Content-Type: application/json" \
  -d '{"userId": "manual-test-user"}'

# 9. Export handoff
curl http://localhost:8788/api/trips/TRIP_ID/handoff/export?format=json -o handoff.json

# 10. Submit agent quote
curl -X POST http://localhost:8788/api/agent/quotes \
  -H "Content-Type: application/json" \
  -d '{"handoffId": "HANDOFF_ID", "agentId": "agent-123", "quoteUsd": 5000, "notes": "Custom tour"}'
```

---

## Test Database Management

### Setup Test Data

```bash
# Create test templates
curl -X POST http://localhost:8788/api/admin/templates \
  -H "Content-Type: application/json" \
  -d @test-data/heritage-template.json

curl -X POST http://localhost:8788/api/admin/templates \
  -H "Content-Type: application/json" \
  -d @test-data/culinary-template.json
```

### Cleanup Test Data

```bash
# List test trips
npx wrangler d1 execute voygent-test --remote --command="
  SELECT id, template_id, status, created_at
  FROM themed_trips
  WHERE user_id LIKE 'test-%'
  ORDER BY created_at DESC;
"

# Delete test trips (after verifying)
npx wrangler d1 execute voygent-test --remote --command="
  DELETE FROM themed_trips WHERE user_id LIKE 'test-%';
"

# Delete test handoffs
npx wrangler d1 execute voygent-test --remote --command="
  DELETE FROM handoff_documents WHERE user_id LIKE 'test-%';
"
```

---

## Performance Testing

### Response Time Benchmarks

| Endpoint | Expected Time | Max Acceptable |
|----------|--------------|----------------|
| POST /api/trips | 2-5s | 10s |
| GET /api/trips/:id/research | <100ms | 500ms |
| PATCH /api/trips/:id/research | <200ms | 1s |
| POST /api/trips/:id/options | 3-8s | 15s |
| POST /api/trips/:id/estimates/* | <500ms | 2s |
| POST /api/trips/:id/handoff | <1s | 3s |
| GET /api/trips/:id/diagnostics | <500ms | 2s |
| GET /api/trips/:id/logs | <200ms | 1s |

### Load Testing

```bash
# Install k6 if not already installed
brew install k6  # macOS
# or download from https://k6.io/

# Run load test
k6 run tests/load/template-workflow.js
```

---

## Error Scenario Testing

### Test Cases

1. **Invalid Template ID**
   ```bash
   curl -X POST http://localhost:8788/api/trips \
     -F "text=test" \
     -F "theme=non-existent"
   # Expected: 404 Template not found
   ```

2. **Research Gate Violation**
   ```bash
   curl -X POST http://localhost:8788/api/trips/TRIP_ID/options
   # Expected: 403 Research must be viewed
   ```

3. **Missing Required Fields**
   ```bash
   curl -X POST http://localhost:8788/api/trips/TRIP_ID/estimates/flights \
     -H "Content-Type: application/json" \
     -d '{"from": "JFK"}'
   # Expected: 400 Missing required fields
   ```

4. **Expired Handoff**
   ```bash
   # Create handoff, wait 31 days (or manually update expires_at)
   curl -X POST http://localhost:8788/api/agent/quotes \
     -H "Content-Type: application/json" \
     -d '{"handoffId": "EXPIRED_ID", "agentId": "agent-123", "quoteUsd": 5000}'
   # Expected: 400 Handoff expired
   ```

5. **Deprecated A/B Endpoint**
   ```bash
   curl -X PATCH http://localhost:8788/api/trips/TRIP_ID/ab
   # Expected: 410 Gone with deprecation warning
   ```

---

## Frontend Testing

### Browser Testing Matrix

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✓ |
| Firefox | 88+ | ✓ |
| Safari | 14+ | ✓ |
| Edge | 90+ | ✓ |
| Mobile Safari | iOS 14+ | ✓ |
| Chrome Mobile | Latest | ✓ |

### Manual Frontend Tests

1. **Diagnostic Window**
   - [ ] Opens correctly
   - [ ] Tabs switch properly
   - [ ] Logs stream in real-time
   - [ ] Filters work
   - [ ] Export generates JSON

2. **Research Viewer**
   - [ ] Displays research summary
   - [ ] Acknowledge button works
   - [ ] Gate enforced correctly

3. **Template Selector**
   - [ ] Shows all active templates
   - [ ] Selection highlights
   - [ ] Callback fires

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Feature 011 Integration Tests

on:
  push:
    branches: [011-transform-voygent-to]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Start development server
        run: npm run dev &

      - name: Wait for server
        run: sleep 10

      - name: Run integration tests
        run: ./scripts/run-integration-tests.sh

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

---

## Test Coverage

### Target Coverage

- **API Endpoints**: 90%+
- **Services**: 85%+
- **Validators**: 95%+
- **Frontend Components**: 80%+

### Generate Coverage Report

```bash
npx vitest run --coverage
```

---

## Troubleshooting

### Common Issues

1. **Server not running**
   ```
   Error: ECONNREFUSED localhost:8788
   Solution: Run `npm run dev` first
   ```

2. **Database connection failed**
   ```
   Error: D1 database not found
   Solution: Check wrangler.toml configuration
   ```

3. **Test timeouts**
   ```
   Error: Test exceeded timeout
   Solution: Increase timeout in vitest.config.ts
   ```

4. **API key not set**
   ```
   Error: Provider API call failed
   Solution: Set OPENAI_API_KEY, ANTHROPIC_API_KEY in .env
   ```

---

## Next Steps

After all integration tests pass:

1. Run performance benchmarks
2. Execute load tests
3. Verify error handling
4. Test browser compatibility
5. Review test coverage
6. Document any test failures
7. Create bug reports for issues found
8. Proceed to Phase 13 (Polish & Deployment)
