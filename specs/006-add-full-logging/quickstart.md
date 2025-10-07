# Quickstart Guide: Testing Logging & Admin Dashboard

**Feature**: 006-add-full-logging
**Phase**: 1 (Testing Guide)
**Date**: 2025-10-07

## Prerequisites

1. **Database Migration Applied**:
   ```bash
   npx wrangler d1 execute voygent-themed --local --file=./migrations/011_add_logging_tables.sql
   ```

2. **Dev Server Running**:
   ```bash
   npm run dev
   # Server should be running at http://localhost:8788
   ```

3. **Admin Account Created** (if not seeded by migration):
   ```bash
   npx wrangler d1 execute voygent-themed --local --command="
   INSERT INTO admin_users (id, email, password_hash, role, agency_id)
   VALUES ('admin-001', 'admin@voygent.ai', '\$2b\$10\$rKGZqHQHJXq1ZXcL9eJ0PeYGQvZ8WxJ5yB7jV2Jt9mYkL4Qp6xD8e', 'super_admin', NULL);
   "
   # Password: admin123 (CHANGE IN PRODUCTION!)
   ```

---

## Test Scenario 1: Verify Logging on Trip Creation

**Objective**: Confirm that all API requests are logged to the database with proper fields.

**Steps**:
1. Open browser to http://localhost:8788
2. Fill out trip intake form with sample data:
   - Surnames: "McLeod, Smith"
   - Adults: 2
   - Duration: 7 days
   - Interests: "Highland history, castles"
3. Submit form to create a trip
4. Query logs table:
   ```bash
   npx wrangler d1 execute voygent-themed --local --command="
   SELECT * FROM logs WHERE endpoint = '/api/trips' ORDER BY timestamp DESC LIMIT 10;
   "
   ```

**Expected Results**:
- ✅ At least 3 log entries: request, llm_call, response
- ✅ All entries share same `request_id`
- ✅ `correlation_id` matches trip ID
- ✅ PII sanitized in metadata (surnames masked: `M****d`, `S***h`)
- ✅ Duration captured for timed operations
- ✅ Status = 'success' for successful operations

---

## Test Scenario 2: Admin Dashboard Login

**Objective**: Verify role-based authentication works correctly.

**Steps**:
1. Navigate to http://localhost:8788/admin-dashboard.html
2. Should see login form (not dashboard)
3. Enter credentials:
   - Email: `admin@voygent.ai`
   - Password: `admin123`
4. Click "Log In"

**Expected Results**:
- ✅ Login successful, redirected to dashboard
- ✅ JWT token stored in httpOnly cookie
- ✅ Dashboard displays with user email in top bar: "Logged in as: admin@voygent.ai (super_admin)"
- ✅ Agency selector dropdown visible (because super_admin role)

**Failure Case**:
- Wrong password → Error message: "Invalid credentials"
- No account → Error message: "User not found"

---

## Test Scenario 3: Live Metrics Display

**Objective**: Verify dashboard displays real-time metrics correctly.

**Steps**:
1. Ensure logged into admin dashboard (Scenario 2)
2. Generate some traffic:
   - Open 5 browser tabs
   - In each tab, create a trip (or trigger any API endpoint)
3. Wait 10 seconds for metrics to update
4. Observe "Live Metrics" section

**Expected Results**:
- ✅ **RPM card** shows non-zero requests per minute
- ✅ **Error Rate card** shows 0% (or accurate percentage if errors occurred)
- ✅ **Avg Response Time card** shows milliseconds (e.g., "1,240 ms")
- ✅ **Active Requests card** shows 0 (assuming all requests completed)
- ✅ Metrics auto-refresh every 10 seconds (watch timestamp update)

---

## Test Scenario 4: Error Logging and Display

**Objective**: Verify errors are logged and displayed in "Recent Errors" section.

**Steps**:
1. Trigger an error (simulate by invalid API call):
   ```bash
   curl -X POST http://localhost:8788/api/trips \
     -H "Content-Type: application/json" \
     -d '{"invalid": "data"}'
   ```
2. Refresh admin dashboard
3. Check "Recent Errors" section

**Expected Results**:
- ✅ Error appears in recent errors table
- ✅ Displays: Timestamp, Trip ID (or "N/A"), Error Type, Severity
- ✅ Click on error row → Opens trace viewer with full error details
- ✅ Stack trace visible (if applicable)
- ✅ Error logged with severity = 'ERROR' or 'CRITICAL'

---

## Test Scenario 5: Request Trace Search

**Objective**: Verify complete request tracing for debugging.

**Steps**:
1. Create a trip (note the trip ID from response, e.g., "trip-abc123")
2. In admin dashboard, go to "Search & Trace" section
3. Enter trip ID in search box: `trip-abc123`
4. Click "Search"

**Expected Results**:
- ✅ Trace viewer displays all logs with `correlation_id = trip-abc123`
- ✅ Logs shown in chronological order (oldest first)
- ✅ Each log shows: Timestamp, Operation, Message, Duration, Status
- ✅ LLM calls visible with metadata: model, tokens, cost
- ✅ Errors highlighted in red
- ✅ Slow operations (>1000ms) highlighted in yellow

---

## Test Scenario 6: Historical Charts (7-Day Trends)

**Objective**: Verify historical analytics display correctly.

**Note**: This test requires at least 1 day of historical data. For immediate testing, manually insert `daily_aggregates`:

```bash
npx wrangler d1 execute voygent-themed --local --command="
INSERT INTO daily_aggregates (id, date, total_requests, total_errors, total_cost_usd, avg_response_ms, p95_response_ms, p99_response_ms, agency_id)
VALUES
  ('agg-001', '2025-10-01', 1200, 15, 2.45, 850, 1400, 2100, NULL),
  ('agg-002', '2025-10-02', 1450, 22, 3.12, 920, 1550, 2350, NULL),
  ('agg-003', '2025-10-03', 980, 8, 1.89, 780, 1200, 1890, NULL),
  ('agg-004', '2025-10-04', 1320, 18, 2.87, 890, 1480, 2200, NULL),
  ('agg-005', '2025-10-05', 1580, 25, 3.56, 950, 1600, 2450, NULL),
  ('agg-006', '2025-10-06', 1420, 20, 3.01, 880, 1520, 2280, NULL),
  ('agg-007', '2025-10-07', 1100, 12, 2.34, 810, 1350, 2050, NULL);
"
```

**Steps**:
1. In admin dashboard, navigate to "Historical Analytics" section
2. Select "7 Days" tab
3. Observe charts

**Expected Results**:
- ✅ **Request Volume Chart**: Line chart showing daily requests (7 data points)
- ✅ **Error Rate Chart**: Line chart showing error % per day
- ✅ **Response Time Chart**: Line chart showing avg response time (ms)
- ✅ **Cost Chart**: Line chart showing daily spend ($USD)
- ✅ Charts render in <3 seconds (NFR-003)
- ✅ X-axis shows dates, Y-axis shows values with units

---

## Test Scenario 7: Role-Based Access (Agency Admin)

**Objective**: Verify agency-admin users only see their agency's data.

**Setup**: Create an agency and agency-admin user:
```bash
npx wrangler d1 execute voygent-themed --local --command="
INSERT INTO agencies (id, name, custom_domain, contact_email)
VALUES ('agency-001', 'McLeod Heritage Tours', 'mcleod.voygent.ai', 'info@mcleod.com');

INSERT INTO admin_users (id, email, password_hash, role, agency_id)
VALUES ('admin-002', 'agency@mcleod.com', '\$2b\$10\$rKGZqHQHJXq1ZXcL9eJ0PeYGQvZ8WxJ5yB7jV2Jt9mYkL4Qp6xD8e', 'agency_admin', 'agency-001');
"
# Password: admin123
```

**Steps**:
1. Log out from super_admin account
2. Log in as `agency@mcleod.com` / `admin123`
3. Observe dashboard

**Expected Results**:
- ✅ Login successful
- ✅ Top bar shows: "Logged in as: agency@mcleod.com (agency_admin)"
- ✅ **Agency selector NOT visible** (agency-admin scoped to their agency only)
- ✅ All metrics filtered by `agency_id = 'agency-001'`
- ✅ Logs only show entries with `agency_id = 'agency-001'`
- ✅ Cannot see other agencies' data

**Verification Query**:
```bash
npx wrangler d1 execute voygent-themed --local --command="
SELECT COUNT(*) as count FROM logs WHERE agency_id != 'agency-001';
"
# Should return 0 when logged in as agency_admin
```

---

## Test Scenario 8: Log Export (JSON)

**Objective**: Verify logs can be exported in JSON format.

**Steps**:
1. In admin dashboard, go to "Export" section
2. Set filters:
   - Date Range: Last 7 days
   - Severity: All
   - Agency: All (if super_admin) or agency-scoped (if agency_admin)
3. Click "Export JSON"

**Expected Results**:
- ✅ Browser downloads `logs-export-YYYY-MM-DD.json` file
- ✅ JSON file contains array of log entries
- ✅ Each entry has all fields: id, request_id, correlation_id, timestamp, severity, operation, message, metadata, duration_ms, status, agency_id, endpoint
- ✅ PII already sanitized in export (not re-masked)
- ✅ Agency-admin export only includes their agency's logs

**Sample JSON Structure**:
```json
[
  {
    "id": "log-001",
    "request_id": "req-001",
    "correlation_id": "trip-123",
    "timestamp": 1696723200000,
    "severity": "INFO",
    "operation": "trip_creation",
    "message": "Trip creation started",
    "metadata": "{\"user_id\":\"user-456\"}",
    "duration_ms": null,
    "status": null,
    "agency_id": null,
    "endpoint": "/api/trips"
  },
  ...
]
```

---

## Test Scenario 9: Email Alerts (Manual Trigger)

**Objective**: Verify email notifications work for critical errors.

**Note**: Email provider (Mailchannels) must be configured in environment variables.

**Setup**: Set environment variable in `.dev.vars`:
```
ALERT_EMAIL_TO=your-email@example.com
```

**Steps**:
1. Trigger a critical error (manually insert):
   ```bash
   npx wrangler d1 execute voygent-themed --local --command="
   INSERT INTO logs (id, request_id, correlation_id, timestamp, severity, operation, message, status, endpoint)
   VALUES ('log-critical-001', 'req-err-001', 'trip-err-123', unixepoch(), 'CRITICAL', 'database_failure', 'Unable to connect to D1 database', 'failure', '/api/trips');
   "
   ```
2. Manually trigger alert check (or wait for scheduled worker):
   ```bash
   curl -X POST http://localhost:8788/api/admin/alerts \
     -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
   ```
3. Check email inbox

**Expected Results**:
- ✅ Email received at `ALERT_EMAIL_TO` address
- ✅ Subject: `[Voygent Alert] Critical Error - database_failure`
- ✅ Body includes: Timestamp, Error type, Affected agency (if applicable), Link to dashboard trace
- ✅ HTML formatted email (not plain text)
- ✅ No duplicate emails within 15-minute window (deduplication)

---

## Test Scenario 10: Performance & Load Testing

**Objective**: Verify logging overhead is <5ms per request (NFR-001).

**Setup**: Install Apache Bench (if not installed):
```bash
sudo apt install apache2-utils  # Ubuntu/Debian
# OR
brew install httpd  # macOS
```

**Steps**:
1. Baseline test (no logging):
   ```bash
   # Temporarily disable logging (comment out middleware)
   ab -n 1000 -c 10 http://localhost:8788/api/trips
   # Note average response time
   ```

2. With logging enabled:
   ```bash
   ab -n 1000 -c 10 http://localhost:8788/api/trips
   # Note average response time
   ```

3. Calculate overhead:
   ```
   Overhead = (Time_with_logging - Time_baseline) / 1000 requests
   ```

4. Check database size:
   ```bash
   npx wrangler d1 execute voygent-themed --local --command="
   SELECT COUNT(*) as log_count FROM logs;
   "
   ```

**Expected Results**:
- ✅ Logging overhead < 5ms per request (NFR-001)
- ✅ All 1000 requests logged successfully (no data loss)
- ✅ No errors during load test (logging is fail-safe)
- ✅ Dashboard still responsive during/after load test
- ✅ Database queries remain fast (<10ms) with 1000+ logs

---

## Test Scenario 11: Log Purging (Manual Test)

**Objective**: Verify old logs are purged correctly without affecting system performance.

**Setup**: Insert old test logs:
```bash
npx wrangler d1 execute voygent-themed --local --command="
-- Insert logs from 2 years ago (should be purged)
INSERT INTO logs (id, request_id, timestamp, severity, operation, message, endpoint)
VALUES
  ('old-log-001', 'old-req-001', unixepoch() - 63072000, 'INFO', 'test_operation', 'Old log 1', '/api/test'),
  ('old-log-002', 'old-req-002', unixepoch() - 63072000, 'INFO', 'test_operation', 'Old log 2', '/api/test');

-- Insert recent logs (should NOT be purged)
INSERT INTO logs (id, request_id, timestamp, severity, operation, message, endpoint)
VALUES
  ('new-log-001', 'new-req-001', unixepoch() - 86400, 'INFO', 'test_operation', 'Recent log 1', '/api/test'),
  ('new-log-002', 'new-req-002', unixepoch() - 86400, 'INFO', 'test_operation', 'Recent log 2', '/api/test');
"
```

**Steps**:
1. Run purge function (manually trigger):
   ```typescript
   // In Cloudflare Workers dashboard or via wrangler
   // Trigger scheduled worker for log purging
   ```

2. Or run SQL directly:
   ```bash
   npx wrangler d1 execute voygent-themed --local --command="
   DELETE FROM logs WHERE timestamp < (unixepoch() - 31536000);
   "
   ```

3. Verify results:
   ```bash
   npx wrangler d1 execute voygent-themed --local --command="
   SELECT COUNT(*) as old_logs FROM logs WHERE timestamp < (unixepoch() - 31536000);
   SELECT COUNT(*) as recent_logs FROM logs WHERE timestamp >= (unixepoch() - 31536000);
   "
   ```

**Expected Results**:
- ✅ `old_logs` count = 0 (all old logs purged)
- ✅ `recent_logs` count = 2 (recent logs retained)
- ✅ `daily_aggregates` table NOT affected (kept indefinitely)
- ✅ Purge operation completes in <5 seconds (even with 100K logs)

---

## Smoke Test Checklist

Run through all scenarios quickly to verify basic functionality:

- [ ] Logs created on API requests (Scenario 1)
- [ ] Admin login works (Scenario 2)
- [ ] Live metrics display (Scenario 3)
- [ ] Errors logged and displayed (Scenario 4)
- [ ] Request tracing works (Scenario 5)
- [ ] Historical charts render (Scenario 6)
- [ ] Role-based access enforced (Scenario 7)
- [ ] Export functionality works (Scenario 8)
- [ ] Email alerts triggered (Scenario 9)
- [ ] Performance acceptable (Scenario 10)
- [ ] Log purging works (Scenario 11)

**Time Estimate**: Full test suite = ~60 minutes | Smoke test = ~15 minutes

---

## Troubleshooting

### Issue: No logs appearing in database
- **Check**: Is middleware properly integrated? (`_middleware.ts` wrapping all `/api/*` requests)
- **Check**: Is logger initialized with database binding? (`Logger.getInstance(env.DB)`)
- **Debug**: Add `console.log('LOG WRITTEN:', id)` after each log write
- **Verify**: Query logs table directly via wrangler CLI

### Issue: Dashboard shows "Unauthorized"
- **Check**: Is JWT token present in cookie? (Inspect cookies in browser DevTools)
- **Check**: Is admin user in `admin_users` table? (Query database)
- **Check**: Is JWT secret configured? (`JWT_SECRET` environment variable)
- **Debug**: Check browser console for network errors (401 responses)

### Issue: Charts not rendering
- **Check**: Is Chart.js loaded? (Check browser console for errors)
- **Check**: Does data exist? (Query `daily_aggregates` table)
- **Check**: Is canvas element present? (`<canvas id="requestsChart">`)
- **Debug**: Check API response from `/api/admin/metrics?period=7d`

### Issue: Email alerts not sending
- **Check**: Is `ALERT_EMAIL_TO` environment variable set?
- **Check**: Is Mailchannels API configured? (Check wrangler.toml)
- **Check**: Are there CRITICAL errors in logs? (Query `SELECT * FROM logs WHERE severity='CRITICAL'`)
- **Debug**: Check Cloudflare Workers logs for email API errors

---

## Success Criteria

All 11 test scenarios pass with expected results. Key metrics:
- ✅ Logging overhead < 5ms per request
- ✅ Dashboard loads in < 2 seconds
- ✅ Charts render in < 3 seconds
- ✅ Live metrics update within 10 seconds
- ✅ Role-based access working correctly
- ✅ PII sanitization functioning
- ✅ Email alerts triggering correctly
- ✅ Log purging working without issues

**Ready for Production**: Once all scenarios pass and performance targets met.
