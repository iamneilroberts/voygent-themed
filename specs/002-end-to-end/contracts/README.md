# Test Suite Contracts

This directory contains JSON schemas that define the structure and validation rules for E2E test configuration and reporting.

## Schemas

### test-config-schema.json

Defines the structure for test configuration including:
- Environment settings (local/staging/production)
- API keys for external services
- Test execution settings (timeout, retries, workers)
- Performance thresholds (informational only)
- Cost thresholds (informational only)
- Success criteria (P1: 100%, P2: 95%, flakiness: <5%)
- Test fixtures (templates, preferences)
- Reporting configuration

**Usage**: Validate test configuration files before test execution.

**Example Configuration**:
```json
{
  "environment": "local",
  "appUrl": "http://localhost:8788",
  "databaseUrl": ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/...",
  "apiKeys": {
    "amadeus": "test_key_xxx",
    "amadeusSecret": "test_secret_xxx",
    "viator": "test_viator_xxx",
    "serper": "test_serper_xxx",
    "openrouter": "test_openrouter_xxx"
  },
  "testSettings": {
    "timeout": 120000,
    "retries": 2,
    "workers": 4,
    "fullyParallel": true
  },
  "successCriteria": {
    "p1PassRate": 100,
    "p2PassRate": 95,
    "maxFlakinessRate": 5
  }
}
```

### test-report-schema.json

Defines the structure for test execution reports including:
- Test run metadata (timestamps, duration, environment)
- Test summary (total, passed, failed, skipped, flaky)
- Suite-level results with priority-based pass rates
- Performance metrics (Phase 1/2 timing, API response times)
- Cost tracking (per provider, per test, total)
- Production readiness assessment (based on success criteria)
- Individual test results (optional)

**Usage**: Validate generated test reports for consistency and completeness.

**Example Report**:
```json
{
  "id": "report-2025-10-09-101530",
  "startedAt": "2025-10-09T10:15:30Z",
  "finishedAt": "2025-10-09T10:25:15Z",
  "duration": 585000,
  "environment": {
    "name": "local",
    "appUrl": "http://localhost:8788",
    "nodeVersion": "20.10.0",
    "playwrightVersion": "1.41.0"
  },
  "summary": {
    "total": 28,
    "passed": 27,
    "failed": 1,
    "skipped": 0,
    "flaky": 0,
    "passRate": 96.43
  },
  "suiteResults": [
    {
      "suiteName": "Critical Path Validation",
      "priority": "P1",
      "passed": 6,
      "failed": 0,
      "skipped": 0,
      "duration": 245000,
      "passRate": 100
    },
    {
      "suiteName": "API Endpoint Validation",
      "priority": "P1",
      "passed": 6,
      "failed": 0,
      "skipped": 0,
      "duration": 85000,
      "passRate": 100
    }
  ],
  "flakinessRate": 0,
  "costTracking": {
    "totalCost": 0.47,
    "costByProvider": {
      "amadeus": 0.24,
      "viator": 0.00,
      "serper": 0.003,
      "openrouter": 0.227
    },
    "avgCostPerTrip": 0.42
  },
  "productionReadiness": {
    "isReady": false,
    "criteria": {
      "p1PassRate": {
        "value": 100,
        "target": 100,
        "met": true
      },
      "p2PassRate": {
        "value": 94.44,
        "target": 95,
        "met": false
      },
      "flakinessRate": {
        "value": 0,
        "target": 5,
        "met": true
      }
    },
    "reasoning": "P2 pass rate (94.44%) is below the required 95% threshold. One P2 test failed."
  }
}
```

## Validation

### Using AJV (Recommended)

```bash
npm install ajv ajv-formats --save-dev
```

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import testConfigSchema from './test-config-schema.json';
import testReportSchema from './test-report-schema.json';

const ajv = new Ajv();
addFormats(ajv);

// Validate test configuration
const validateConfig = ajv.compile(testConfigSchema);
const isValidConfig = validateConfig(yourConfigObject);
if (!isValidConfig) {
  console.error(validateConfig.errors);
}

// Validate test report
const validateReport = ajv.compile(testReportSchema);
const isValidReport = validateReport(yourReportObject);
if (!isValidReport) {
  console.error(validateReport.errors);
}
```

### Using JSON Schema CLI

```bash
npm install -g ajv-cli
ajv validate -s test-config-schema.json -d your-config.json
ajv validate -s test-report-schema.json -d your-report.json
```

## Production Readiness Criteria

Per clarification #3, a build is considered **production-ready** when:

1. **P1 Pass Rate**: 100% (all P1 tests must pass)
2. **P2 Pass Rate**: ≥95% (at least 95% of P2 tests must pass)
3. **Flakiness Rate**: <5% (less than 5% of tests are flaky)

The `productionReadiness` section in test reports automatically evaluates these criteria and provides a boolean `isReady` flag plus reasoning.

**Note**: Performance metrics (SC-004, SC-005) and cost metrics (SC-012) are **informational only** per clarifications #2 and #4. They do not affect production readiness.

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Validate test report
        run: |
          npx ajv validate \
            -s specs/002-end-to-end/contracts/test-report-schema.json \
            -d test-results/report.json

      - name: Check production readiness
        run: |
          READY=$(jq -r '.productionReadiness.isReady' test-results/report.json)
          if [ "$READY" != "true" ]; then
            echo "Build is not production-ready"
            jq '.productionReadiness.reasoning' test-results/report.json
            exit 1
          fi
```

## Schema Versioning

These schemas follow semantic versioning:
- **MAJOR**: Breaking changes to required fields or field types
- **MINOR**: New optional fields or validation rules
- **PATCH**: Documentation updates, clarifications

Current versions:
- `test-config-schema.json`: 1.0.0
- `test-report-schema.json`: 1.0.0

## Related Documentation

- [spec.md](../spec.md): Feature specification
- [data-model.md](../data-model.md): Entity definitions
- [quickstart.md](../quickstart.md): Getting started guide
- [research.md](../research.md): Research findings and patterns
