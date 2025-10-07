# Research & Design Decisions: Full Logging and Admin Dashboard

**Feature**: 006-add-full-logging
**Phase**: 0 (Research)
**Date**: 2025-10-07

## Research Questions & Decisions

### 1. How should logs be stored in D1?

**Question**: What database schema design will efficiently support querying, filtering, and aggregating logs while maintaining performance with high volume?

**Options Considered**:
- Single logs table with all fields
- Separate tables for logs, metrics, aggregates
- Time-series partitioning
- External logging service (Cloudflare Logs, Loki)

**Decision**: **Four-table design with aggregation layers**

**Rationale**:
- `logs` table: Raw log entries for detailed debugging and traces
- `metrics_snapshots` table: Pre-aggregated 5-minute windows for live dashboard
- `daily_aggregates` table: Rolled-up daily stats for historical charts (kept indefinitely)
- `admin_users` table: Authentication and role-based access

This layered approach prevents expensive queries on raw logs table. Dashboard queries hit pre-aggregated tables. Scheduled workers perform aggregation off the critical path.

---

### 2. What log fields are needed for debugging?

**Question**: What minimum set of fields enables complete request tracing and debugging without excessive storage overhead?

**Fields Selected**:
- `id` (TEXT PK): Unique log entry ID
- `request_id` (TEXT indexed): Unique per API request, for filtering all logs from one request
- `correlation_id` (TEXT indexed): Trip ID or user session, for tracing across multiple requests
- `timestamp` (INTEGER indexed): Unix epoch milliseconds
- `severity` (TEXT): DEBUG | INFO | WARN | ERROR | CRITICAL
- `operation` (TEXT): Descriptive operation name (e.g., "trip_creation", "llm_call", "db_query")
- `message` (TEXT): Human-readable log message
- `metadata` (TEXT JSON): Flexible structure for operation-specific data
- `duration_ms` (INTEGER): Operation duration (null if not applicable)
- `status` (TEXT): success | failure | timeout
- `agency_id` (TEXT): For multi-tenant filtering
- `endpoint` (TEXT indexed): API endpoint path (e.g., "/api/trips")

**Rationale**: These fields enable answering key debugging questions:
- "What happened during trip X?" → Filter by correlation_id
- "Why did this request fail?" → Filter by request_id, look at ERROR severity
- "Which endpoint is slowest?" → Group by endpoint, average duration_ms
- "What's our error rate?" → Count severity=ERROR / total logs

---

### 3. How to implement fail-safe logging?

**Question**: How do we ensure logging failures never cause user-facing API requests to fail?

**Decision**: **Try-catch wrapper with console.error fallback**

**Implementation Pattern**:
```typescript
async function logRequest(data: LogData) {
  try {
    await db.insert(logs).values(data);
  } catch (error) {
    console.error('[LOGGING FAILED]', error, data);
    // Do NOT throw - fail silently
  }
}
```

**Rationale**:
- All logging functions wrapped in try-catch
- Errors caught, logged to console (Cloudflare logs), but not propagated
- Request handlers never see logging exceptions
- Worst case: Lose one log entry, user request succeeds

---

### 4. How to calculate live metrics efficiently?

**Question**: How can we compute RPM, error rates, and avg response time for "last 5 minutes" without scanning entire logs table on every dashboard refresh?

**Decision**: **Pre-aggregated metrics_snapshots table updated by scheduled worker**

**Approach**:
- Scheduled Worker runs every 5 minutes (cron: `*/5 * * * *`)
- Queries logs for last 5 minutes: `WHERE timestamp >= (unixepoch() - 300)`
- Calculates:
  - `rpm` = COUNT(*) / 5
  - `error_rate` = COUNT(*) WHERE severity='ERROR' / COUNT(*)
  - `avg_response_ms` = AVG(duration_ms) WHERE operation LIKE '%_response'
  - `active_requests` = COUNT(*) WHERE status IS NULL (ongoing)
- Inserts row into `metrics_snapshots` table
- Dashboard queries latest row from `metrics_snapshots` (instant lookup)

**Rationale**: Moves expensive aggregation off critical path. Dashboard gets sub-10ms query times.

---

### 5. How to implement PII sanitization?

**Question**: What specific rules will mask PII (emails, surnames, genealogy data) while retaining debugging utility?

**Decision**: **Regex-based masking applied at log write time**

**Rules**:
1. **Emails**: Regex `/([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi`
   - Replace with: First char of local + `***@***.` + TLD
   - Example: `john.doe@example.com` → `j***@***.com`

2. **Surnames**: Keep first and last character, mask middle
   - Example: `Smith` → `S***h`, `Lee` → `L*e`

3. **Genealogy JSON**: Redact specific fields
   - `sources[].title` → `"REDACTED"`
   - `sources[].description` → `"REDACTED"`
   - Keep: surnames (already masked), origins (not PII)

**Implementation**: `PIISanitizer.sanitize(data)` function called before every log write. Operates on strings and objects recursively.

**Rationale**: Balance between privacy compliance and debugging utility. Can still identify request origin (`j***@***.com` vs `m***@***.com`) without exposing full email.

---

### 6. What chart library for dashboard?

**Question**: Which JavaScript charting library minimizes complexity while providing required visualizations?

**Options Considered**:
- Chart.js (simple, lightweight, CDN-hosted)
- D3.js (powerful, steep learning curve, requires build)
- Apache ECharts (feature-rich, larger bundle)
- Recharts (React-only)

**Decision**: **Chart.js 4.x via CDN**

**Rationale**:
- No build step required (CDN script tag)
- Lightweight (~200KB minified)
- Supports all needed chart types: line (trends), bar (breakdowns), pie (providers)
- Simple API: `new Chart(ctx, config)`
- Responsive by default
- Wide browser support

**Charts Needed**:
1. Line chart: Request volume over time (7/30 days)
2. Line chart: Error rate trend (7 days)
3. Line chart: Avg response time trend (7 days)
4. Line chart: Daily cost trend (7/30 days)
5. Pie chart: Provider breakdown (OpenAI vs Anthropic)
6. Bar chart: Endpoint usage (top 10)

---

### 7. How to implement role-based access?

**Question**: What authentication mechanism supports super-admin and agency-admin roles without excessive complexity?

**Decision**: **JWT tokens with role claim, stored in httpOnly cookie**

**Flow**:
1. Admin logs in via POST `/api/admin/auth/login` with email + password
2. Backend verifies credentials against `admin_users` table (bcrypt hash)
3. Backend generates JWT with claims: `{userId, email, role, agencyId}`
4. JWT stored in httpOnly cookie (prevents XSS)
5. All `/api/admin/*` endpoints check JWT in middleware
6. Middleware extracts role and agencyId from JWT
7. For agency-admin role: Filter all queries by `WHERE agency_id = {agencyId}`
8. For super-admin role: No filtering, sees all agencies

**Table Schema**:
```sql
CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK(role IN ('super_admin', 'agency_admin')),
  agency_id TEXT REFERENCES agencies(id), -- NULL for super_admin
  created_at INTEGER DEFAULT (unixepoch())
);
```

**Rationale**: JWT is stateless (no session storage), httpOnly cookie prevents token theft, role claim enables simple middleware checks.

---

### 8. How to send email alerts?

**Question**: What email delivery mechanism works within Cloudflare Workers constraints?

**Options Considered**:
- Cloudflare Email Routing API (outbound not supported)
- SendGrid API (requires account)
- SMTP via fetch (requires external SMTP server)
- Mailchannels API (Cloudflare-recommended, free tier)

**Decision**: **Mailchannels API via fetch**

**Implementation**:
```typescript
async function sendEmail(to: string, subject: string, html: string) {
  await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      from: {email: 'alerts@voygent.ai'},
      personalizations: [{to: [{email: to}]}],
      subject,
      content: [{type: 'text/html', value: html}]
    })
  });
}
```

**Email Templates**:
1. **Critical Error**:
   - Subject: `[Voygent Alert] Critical Error - {error_type}`
   - Body: Timestamp, agency, error message, link to dashboard trace

2. **High Error Rate**:
   - Subject: `[Voygent Alert] High Error Rate - {error_rate}%`
   - Body: Time range, error count, total requests, link to dashboard

**Rationale**: Mailchannels is Cloudflare-recommended, has generous free tier, simple REST API.

---

### 9. How to handle log retention/purging?

**Question**: What mechanism ensures logs are purged after 1 year without impacting performance?

**Decision**: **Scheduled Worker runs daily at 3 AM UTC**

**Implementation**:
```typescript
// Scheduled Worker (cron: "0 3 * * *")
async function purgeLogs(db: D1Database) {
  const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);

  // Delete in batches to avoid timeout
  let deleted = 0;
  do {
    const result = await db.run(
      'DELETE FROM logs WHERE timestamp < ? LIMIT 1000',
      [oneYearAgo]
    );
    deleted = result.changes || 0;
  } while (deleted === 1000); // Continue if batch was full

  // Keep metrics_snapshots for 1 year too
  await db.run(
    'DELETE FROM metrics_snapshots WHERE timestamp < ?',
    [oneYearAgo]
  );

  // daily_aggregates are NEVER deleted (kept indefinitely)
}
```

**Rationale**:
- Runs at 3 AM UTC (lowest global traffic)
- Batch deletion (1000 rows at a time) prevents timeouts
- Keeps daily_aggregates forever (small table, high value for trends)
- Automated (no manual cleanup needed)

---

## Summary of Key Decisions

| Decision Area | Choice | Rationale |
|---------------|--------|-----------|
| **Database Schema** | 4 tables (logs, metrics_snapshots, daily_aggregates, admin_users) | Layered aggregation for performance |
| **Log Fields** | 12 core fields including request_id, correlation_id, severity, metadata | Complete tracing with minimal redundancy |
| **Fail-Safe Logging** | Try-catch with console.error fallback | Never impact user requests |
| **Live Metrics** | Pre-aggregated via scheduled worker | <10ms dashboard queries |
| **PII Sanitization** | Regex masking at write time | Privacy + debugging utility |
| **Chart Library** | Chart.js 4.x via CDN | Simple, lightweight, no build step |
| **Access Control** | JWT with role claim, httpOnly cookie | Stateless, secure, role-based filtering |
| **Email Alerts** | Mailchannels API | Cloudflare-recommended, free tier |
| **Log Purging** | Scheduled Worker, daily at 3 AM, batch deletes | Automated, low-impact |

## Next Phase

Phase 1 will produce:
1. **data-model.md**: Complete SQL schema for all 4 tables with indexes and relationships
2. **quickstart.md**: 10 manual test scenarios covering all acceptance criteria
3. **contracts/logging.ts**: TypeScript interfaces for all entities and API contracts

**Ready for Phase 1**: ✅ All research questions answered, no blocking ambiguities remain.
