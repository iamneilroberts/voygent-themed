# Implementation Plan: Full Logging and Admin Dashboard

**Branch**: `006-add-full-logging` | **Date**: 2025-10-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/neil/dev/lite-voygent-claude/specs/006-add-full-logging/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
    If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
    Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
    Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
    If violations exist: Document in Complexity Tracking
    If no justification possible: ERROR "Simplify approach first"
    Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 ’ research.md
    If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 ’ data-model.md (if needed), quickstart.md, agent-specific template file
7. Re-evaluate Constitution Check section
    If new violations: Refactor design, return to Phase 1
    Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 ’ Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Implement comprehensive logging and diagnostics infrastructure for voygent.ai with an admin dashboard that provides live and historical operational visibility. The system will capture all API requests, responses, errors, and external provider calls with structured logging including correlation IDs, severity levels, and PII sanitization. A role-based admin dashboard will display real-time metrics (RPM, error rates, active requests), historical analytics (7/30 day trends), cost tracking per provider/agency, request tracing for debugging, and alerting via both in-dashboard notifications and email. This enables proactive monitoring, rapid issue diagnosis, and cost optimization for the platform.

## Technical Context
**Language/Version**: TypeScript 5.x, JavaScript ES2022+, HTML5, CSS3
**Primary Dependencies**:
- Existing: D1 database (voygent-themed) with trips, messages, agencies tables
- Existing: Cloudflare Workers runtime with bindings (DB, AI, env vars)
- Existing: Cost calculation in provider.ts (tokens_in, tokens_out, cost_usd)
- Existing: admin.html (theme builder) - will be extended
- New: Logging library/module for structured logging
- New: Chart.js or similar for dashboard visualizations

**Storage**: Cloudflare D1 (SQLite at edge) - new tables for logs, metrics, aggregates
**Testing**: Manual testing via quickstart + automated log verification
**Target Platform**: Cloudflare Pages + Functions, modern browsers (Chrome, Firefox, Safari)
**Project Type**: Web (full-stack: backend TypeScript API + frontend JavaScript dashboard)

**Performance Goals**:
- Logging overhead <5ms per request (NFR-001)
- Dashboard load <2 seconds (NFR-002)
- Chart rendering <3 seconds for 30 days (NFR-003)
- Live metrics update <10 seconds (NFR-004)
- Support 1000 RPM logging (NFR-005)

**Constraints**:
- Must NOT impact existing API request performance
- Logging must be fail-safe (no errors bubble to user requests)
- PII must be sanitized before storage
- Role-based access control required
- 1-year log retention, aggregate metrics indefinite
- No new external dependencies for core logging (use native features)

**Scale/Scope**:
- Backend: New logging module (~300-400 lines)
- Backend: New middleware for request/response logging (~100 lines)
- Backend: New API endpoints for dashboard data (~400-500 lines)
- Backend: Database migration for 4-5 new tables
- Backend: Email notification service (~150 lines)
- Frontend: Complete dashboard rewrite (admin-dashboard.html ~600-800 lines)
- Frontend: Dashboard JavaScript (~800-1000 lines)
- Frontend: Dashboard CSS (~300-400 lines)
- Total: ~3500-4000 lines new code

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Critical Path Compliance
 **Does not block critical path**
- This feature is **operational infrastructure** - does not change the core trip planning flow
- Critical path remains: "Intake ’ Options(<=4) ’ Select ’ A/B ’ Save Trip ID"
- Logging is transparent to users; only affects admin visibility
- No changes to trip generation, research, or quote request flows
- **Status**: This is an operational enhancement, not a critical path feature

### Cheap-First Policy
 **No LLM usage**
- This feature uses **zero LLM calls** - purely data collection and display
- Logging captures existing model costs but doesn't generate new ones
- Dashboard queries D1 database, no AI provider calls
- Email notifications are plain text templates
- **Status**: N/A - no model usage

### No Inventory Claims
 **Uses appropriate language**
- Dashboard shows "estimated costs" based on actual API charges
- Performance metrics show "typical response times" with percentiles
- Error rates shown as percentages, not absolute guarantees
- Spec uses "MUST" for functional requirements, not availability SLAs
- **Status**: Language is appropriate for operational monitoring

### Reproducibility
 **Maintained**
- Uses Cloudflare D1 (already in use) for log storage
- Dashboard served via Cloudflare Pages (existing infrastructure)
- No environment-specific code (local and prod use same D1 bindings)
- Logging works identically in `wrangler dev` and production
- Email notifications use environment variables for configuration
- **Status**: Fully reproducible across environments

**Gate Status**:  PASS

## Project Structure

### Documentation (this feature)
```
specs/006-add-full-logging/
    spec.md              # Feature specification
    plan.md              # This file (/plan command output)
    research.md          # Phase 0 output (/plan command)
    data-model.md        # Phase 1 output (/plan command)
    quickstart.md        # Phase 1 output (/plan command)
    tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
migrations/
    011_add_logging_tables.sql     # NEW: Create logs, metrics, aggregates, admin_users tables

functions/api/
    _middleware.ts                 # MODIFY: Add request/response logging middleware
    lib/
        logger.ts                  # NEW: Structured logging module (300-400 lines)
        pii-sanitizer.ts           # NEW: PII masking utilities (100 lines)
        metrics-aggregator.ts      # NEW: Aggregate metrics calculation (200 lines)
        email-notifier.ts          # NEW: Email alert service (150 lines)
    admin/
        auth.ts                    # NEW: Admin authentication (100 lines)
        logs.ts                    # NEW: GET /api/admin/logs (with filters)
        metrics.ts                 # NEW: GET /api/admin/metrics (live + historical)
        traces.ts                  # NEW: GET /api/admin/traces/:tripId
        export.ts                  # NEW: GET /api/admin/export (JSON logs)
        alerts.ts                  # NEW: GET/POST /api/admin/alerts
    trips/
        index.ts                   # MODIFY: Add logging to trip creation
    research/
        index.ts                   # MODIFY: Add logging to research endpoint
    providers/
        *.ts                       # MODIFY: Add logging to provider endpoints

public/
    admin-dashboard.html           # NEW: Admin dashboard UI (replace/extend admin.html)
    js/
        admin-dashboard.js         # NEW: Dashboard logic (800-1000 lines)
        admin-charts.js            # NEW: Chart rendering (300 lines)
    css/
        admin-dashboard.css        # NEW: Dashboard styles (300-400 lines)
```

**Structure Decision**: Backend-heavy feature with significant database design work. The backend requires a new logging module, middleware integration across all endpoints, new admin API endpoints for dashboard data, and database schema changes. Frontend is a complete dashboard implementation with live-updating metrics, charts, and trace inspection. Both backend and frontend are substantial but the backend foundation (logging, data model) must be designed carefully first.

## Phase 0: Outline & Research
*Status*:  COMPLETE

### Research Questions
1. **How should logs be stored in D1?** - Decision: Four tables: `logs` (raw entries), `metrics_snapshots` (5-min aggregates), `daily_aggregates` (rolled-up stats), `admin_users` (auth)
2. **What log fields are needed for debugging?** - Decision: request_id (UUID), correlation_id (trip_id), timestamp, severity, operation, message, metadata (JSON), duration_ms, status, agency_id, sanitized_pii flag
3. **How to implement fail-safe logging?** - Decision: try/catch around all log writes, fallback to console.error, never throw errors to request handlers
4. **How to calculate live metrics efficiently?** - Decision: Query last 5 minutes of logs with GROUP BY for aggregates; index on timestamp and severity
5. **How to implement PII sanitization?** - Decision: Regex-based masking for emails (e***@***.com), surnames (keep first and last char), redact genealogy JSON fields
6. **What chart library for dashboard?** - Decision: Chart.js (lightweight, no build step, CDN-hosted)
7. **How to implement role-based access?** - Decision: Simple admin_users table with role column (super_admin | agency_admin), JWT token in cookie, middleware checks role
8. **How to send email alerts?** - Decision: Use Cloudflare Workers Email API or SMTP via fetch (configured via env vars), template-based HTML emails
9. **How to handle log retention/purging?** - Decision: Scheduled Worker (cron) runs daily, DELETEs logs older than 365 days, runs at 3 AM UTC (low traffic)

### Decisions Made

1. **Database Schema** (4 new tables):
   - **logs**: Primary log storage
     - id (TEXT PK), request_id (TEXT indexed), correlation_id (TEXT indexed)
     - timestamp (INTEGER indexed), severity (TEXT), operation (TEXT)
     - message (TEXT), metadata (TEXT JSON), duration_ms (INTEGER)
     - status (TEXT), agency_id (TEXT), endpoint (TEXT indexed)
   - **metrics_snapshots**: 5-minute aggregated metrics
     - id (TEXT PK), timestamp (INTEGER indexed), rpm (INTEGER)
     - error_rate (REAL), avg_response_ms (INTEGER), active_requests (INTEGER)
     - agency_id (TEXT, nullable for global metrics)
   - **daily_aggregates**: Long-term stats (kept indefinitely)
     - id (TEXT PK), date (TEXT indexed YYYY-MM-DD)
     - total_requests (INTEGER), total_errors (INTEGER), total_cost_usd (REAL)
     - avg_response_ms (INTEGER), p95_response_ms (INTEGER), p99_response_ms (INTEGER)
     - provider_breakdown_json (TEXT), endpoint_breakdown_json (TEXT)
     - agency_id (TEXT, nullable)
   - **admin_users**: Authentication
     - id (TEXT PK), email (TEXT UNIQUE), password_hash (TEXT)
     - role (TEXT: 'super_admin' | 'agency_admin'), agency_id (TEXT nullable)
     - created_at (INTEGER), last_login (INTEGER)

2. **Logging Module Design**:
   - Singleton logger instance: `Logger.getInstance(env.DB)`
   - Methods: `logRequest()`, `logResponse()`, `logError()`, `logProvider()`
   - Auto-generates request_id (UUID) if not present
   - Sanitizes PII via `PIISanitizer.sanitize(data)` before storage
   - Calculates duration via `Date.now() - startTime`
   - Stores metadata as JSON string: `JSON.stringify(metadata)`
   - Fail-safe: Catches all errors, logs to console.error, returns gracefully

3. **Middleware Integration**:
   - `_middleware.ts` intercepts all `/api/*` requests
   - Before handler: Generate request_id, store startTime, log request
   - After handler: Calculate duration, log response (status, size, duration)
   - Error handler: Catch exceptions, log error with stack trace, return 500
   - Attach request_id to context for downstream use: `context.requestId`

4. **Admin Dashboard Layout**:
   - Top bar: Auth status, agency selector (super-admin only), refresh button
   - Section 1: Live Metrics (4 cards: RPM, Error %, Avg Response, Active Requests)
   - Section 2: Recent Errors (table with last 20 errors, click to view trace)
   - Section 3: Historical Charts (tabs: Requests, Errors, Response Time, Costs)
   - Section 4: Performance Panel (slowest endpoints, slowest providers, DB queries)
   - Section 5: Search & Trace (input for trip_id, displays full trace)
   - Section 6: Export (date range picker, severity filter, export JSON button)
   - Auto-refresh: Poll `/api/admin/metrics` every 10 seconds for live section

5. **Admin API Endpoints**:
   - `GET /api/admin/logs?limit=20&severity=ERROR&start_time=X&end_time=Y&agency_id=Z`
   - `GET /api/admin/metrics?period=5m|7d|30d&agency_id=Z` ’ Returns live or historical aggregates
   - `GET /api/admin/traces/:tripId` ’ Returns all logs with correlation_id=tripId
   - `GET /api/admin/export?start=YYYY-MM-DD&end=YYYY-MM-DD&severity=X&agency_id=Z` ’ JSON file download
   - `POST /api/admin/alerts` ’ Manually trigger alert check (for testing)
   - Auth: All endpoints require `Authorization: Bearer <JWT>` header, validate role

6. **Alerting Logic**:
   - **In-Dashboard Alerts**: Dashboard JS checks error_rate from `/api/admin/metrics?period=5m`
     - If error_rate > 0.05 (5%), show red banner: "High error rate detected"
     - If latest log has severity=CRITICAL, show red banner: "Critical error occurred"
   - **Email Alerts**: Scheduled Worker runs every 5 minutes
     - Query logs for last 15 minutes, calculate error_rate
     - If error_rate > 0.10 (10%), send email to all admin_users
     - If any CRITICAL severity logs, send email immediately (deduplicate within 15 min window)
     - Email template: Subject "[Voygent Alert] {error_type}", Body with timestamp, agency, error count, dashboard link

7. **PII Sanitization Rules**:
   - Emails: Regex `/([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi` ’ `e***@***.com`
   - Surnames: Keep first and last character ’ `Smith` ’ `S***h`
   - Genealogy data: Redact JSON fields: `{sources: [{title: "REDACTED"}]}`
   - Apply before storing in logs table, not on retrieval (sanitized at write time)

8. **Performance Optimizations**:
   - Indexes on logs: (timestamp DESC), (request_id), (correlation_id), (endpoint, timestamp)
   - Batch insert logs (buffer up to 10 logs or 1 second, whichever first)
   - Dashboard queries use metrics_snapshots for live data (pre-aggregated every 5 min)
   - Historical charts query daily_aggregates (avoid scanning raw logs)
   - Log purging uses `DELETE FROM logs WHERE timestamp < (unixepoch() - 31536000)` with LIMIT 1000 per batch

9. **Error Handling**:
   - Logging failure: Catch error, log to console.error, continue request processing (fail-safe)
   - Dashboard API errors: Return 500 with `{error: "message"}`, log to console
   - Missing auth: Return 401 with `{error: "Unauthorized"}`
   - Invalid role/agency: Return 403 with `{error: "Forbidden"}`
   - Chart rendering errors: Show error message in chart container, don't break entire dashboard

### Output
 research.md created with all 9 design decisions documented

## Phase 1: Design & Deliverables
*Prerequisites: research.md complete*
*Status*:  COMPLETE

### Deliverables

1. **data-model.md**: Complete database schema design
   - 4 new tables: logs, metrics_snapshots, daily_aggregates, admin_users
   - All columns, types, constraints, indexes
   - Relationships: logs.agency_id ’ agencies.id, admin_users.agency_id ’ agencies.id
   - Migration file structure (011_add_logging_tables.sql)
   - Sample data for testing

2. **quickstart.md**: Manual testing and verification guide
   - Setup: Create admin user via SQL INSERT
   - Test 1: Generate trip, verify logs are created
   - Test 2: Open dashboard, verify live metrics appear
   - Test 3: Trigger error, verify error appears in recent errors list
   - Test 4: Search for trip ID, verify trace displays correctly
   - Test 5: Test role-based access (super-admin vs agency-admin)
   - Test 6: Export logs, verify JSON format
   - Test 7: Trigger email alert (manually via POST /api/admin/alerts)
   - Test 8: Verify log purging (manually run purge function with test data)
   - Test 9: Load test with 100 concurrent requests, verify logging overhead <5ms
   - Test 10: Verify dashboard performance with 100K logs in database

3. **contracts/logging.ts**: TypeScript interfaces
   - LogEntry interface
   - MetricsSnapshot interface
   - DailyAggregate interface
   - AdminUser interface
   - LogQuery interface (request params)
   - TraceResponse interface
   - AlertConfig interface

### Validation
-  Data model supports all 48 functional requirements
-  Indexes optimize all dashboard queries (timestamp, request_id, correlation_id, endpoint)
-  PII sanitization integrated into logging flow
-  Role-based access enforced at API level
-  Quickstart covers all 7 acceptance scenarios from spec
-  Performance targets achievable with current design (5ms overhead, 2s load, 10s refresh)

### Output
 data-model.md with full schema and migration SQL
 quickstart.md with 10 comprehensive test scenarios
 contracts/logging.ts with TypeScript interfaces

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

### Task Generation Strategy

1. **Database Foundation** (3 tasks):
   - Create migration 011_add_logging_tables.sql with 4 new tables + indexes
   - Create seed data for admin_users table (at least 1 super-admin)
   - Run migration locally and verify schema

2. **Logging Infrastructure** (5 tasks):
   - Implement Logger class in lib/logger.ts with logRequest, logResponse, logError, logProvider methods
   - Implement PIISanitizer class in lib/pii-sanitizer.ts with email, surname, genealogy masking
   - Implement batch logging (buffer 10 logs or 1 second)
   - Add middleware to _middleware.ts for request/response logging
   - Test logging with existing endpoints (create trip, verify log entry)

3. **Metrics & Aggregation** (4 tasks):
   - Implement MetricsAggregator class in lib/metrics-aggregator.ts
   - Create Scheduled Worker for 5-minute metrics snapshots
   - Create Scheduled Worker for daily aggregates rollup
   - Create Scheduled Worker for log purging (runs daily at 3 AM UTC)

4. **Admin API Endpoints** (6 tasks):
   - Implement admin authentication in api/admin/auth.ts (JWT generation, validation)
   - Implement GET /api/admin/logs endpoint with filters
   - Implement GET /api/admin/metrics endpoint (live + historical)
   - Implement GET /api/admin/traces/:tripId endpoint
   - Implement GET /api/admin/export endpoint (JSON download)
   - Implement POST /api/admin/alerts endpoint (manual trigger)

5. **Email Alerting** (3 tasks):
   - Implement EmailNotifier class in lib/email-notifier.ts
   - Create email templates (critical error, high error rate)
   - Create Scheduled Worker for alert checking (runs every 5 minutes)

6. **Dashboard Frontend** (8 tasks):
   - Create admin-dashboard.html structure (6 sections: live metrics, errors, charts, performance, search, export)
   - Implement authentication flow in admin-dashboard.js (login, JWT storage, logout)
   - Implement live metrics polling (every 10 seconds)
   - Implement recent errors table with click-to-trace
   - Implement Chart.js integration for historical charts (4 charts: requests, errors, response time, costs)
   - Implement search & trace viewer
   - Implement export functionality
   - Style dashboard with admin-dashboard.css

7. **Integration with Existing Endpoints** (4 tasks):
   - Add logging to POST /api/trips (trip creation)
   - Add logging to POST /api/research (research endpoint)
   - Add logging to provider calls in lib/provider.ts (callProvider function)
   - Add logging to all endpoints in functions/api/providers/*.ts

8. **Testing & Validation** (3 tasks):
   - Execute all 10 quickstart test scenarios
   - Performance test: 100 concurrent requests, measure logging overhead
   - Load test: Insert 100K logs, verify dashboard performance

9. **Documentation** (2 tasks):
   - Update README with admin dashboard access instructions
   - Document environment variables needed (email provider config)

### Ordering Strategy
1. Database foundation first (migrations, schema)
2. Core logging infrastructure (Logger, PIISanitizer)
3. Middleware integration (request/response logging)
4. Metrics aggregation (scheduled workers)
5. Admin API endpoints (depends on logging + metrics)
6. Email alerting (depends on metrics)
7. Dashboard frontend (depends on admin API)
8. Integration with existing endpoints (depends on Logger)
9. Testing and validation
10. Documentation

### Estimated Output
~38-42 tasks in tasks.md, mostly sequential with some parallelization possible:
- Frontend tasks can run parallel to backend tasks after APIs are defined
- CSS styling can happen parallel to JS logic
- Email alerting can happen parallel to dashboard frontend

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks following constitutional principles)
**Phase 5**: Validation (run quickstart.md manual tests)

## Complexity Tracking

### Potential Constitutional Concerns
**None identified** - This feature has zero constitutional violations:

-  Does not block critical path (operational infrastructure only)
-  No LLM usage (purely data collection and display)
-  Appropriate language (estimates, typical values)
-  Fully reproducible (Cloudflare D1 + Pages, works locally and prod)

### Complexity Justifications
*Not applicable - no deviations from constitutional principles*

### Additional Complexity Notes
- This is a **large feature** (~3500-4000 lines new code) but well-scoped
- Database design is critical - must index correctly for performance
- Fail-safe logging is essential - cannot break existing requests
- PII sanitization must be bulletproof - regulatory requirement
- Role-based access must be secure - admin dashboard is sensitive

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) 
- [x] Phase 1: Design complete (/plan command) 
- [x] Phase 2: Task planning complete (/plan command - describe approach only) 
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS 
- [x] Post-Design Constitution Check: PASS (no new violations) 
- [x] Clarifications resolved (5 questions answered) 
- [x] No complexity deviations 

**Design Artifacts**:
- [x] research.md (9 design decisions documented) 
- [x] data-model.md (4 tables, full schema, migration SQL) 
- [x] quickstart.md (10 test scenarios) 
- [x] contracts/logging.ts (TypeScript interfaces) 
- [ ] tasks.md (to be generated by /tasks command)

---
*Based on Constitution - See `/home/neil/dev/lite-voygent-claude/.specify/constitution.md`*
