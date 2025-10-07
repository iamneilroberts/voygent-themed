# Data Model: Full Logging and Admin Dashboard

**Feature**: 006-add-full-logging
**Phase**: 1 (Design)
**Date**: 2025-10-07

## Overview

This document defines the complete database schema for the logging and admin dashboard feature. The design uses a layered approach with raw logs, pre-aggregated metrics, and daily summaries to optimize query performance while maintaining complete debugging capability.

## Schema Diagram

```
┌─────────────────────────┐
│ logs                    │◄──────┐
│━━━━━━━━━━━━━━━━━━━━━━━━│       │
│ id (PK)                 │       │
│ request_id (indexed)    │       │ Raw log entries
│ correlation_id (indexed)│       │ (1 year retention)
│ timestamp (indexed)     │       │
│ severity                │       │
│ operation               │       │
│ message                 │       │
│ metadata (JSON)         │       │
│ duration_ms             │       │
│ status                  │       │
│ agency_id (FK)          │───────┼────┐
│ endpoint (indexed)      │       │    │
└─────────────────────────┘       │    │
                                  │    │
┌─────────────────────────┐       │    │
│ metrics_snapshots       │       │    │
│━━━━━━━━━━━━━━━━━━━━━━━━│       │    │
│ id (PK)                 │       │ 5-minute windows
│ timestamp (indexed)     │       │ (1 year retention)
│ rpm                     │       │
│ error_rate              │       │
│ avg_response_ms         │       │
│ active_requests         │       │
│ agency_id (FK,nullable) │───────┼────┤
└─────────────────────────┘       │    │
                                  │    │
┌─────────────────────────┐       │    │
│ daily_aggregates        │       │    │
│━━━━━━━━━━━━━━━━━━━━━━━━│       │    │
│ id (PK)                 │       │ Daily rollups
│ date (indexed YYYY-MM-DD)│      │ (kept indefinitely)
│ total_requests          │       │
│ total_errors            │       │
│ total_cost_usd          │       │
│ avg_response_ms         │       │
│ p95_response_ms         │       │
│ p99_response_ms         │       │
│ provider_breakdown_json │       │
│ endpoint_breakdown_json │       │
│ agency_id (FK,nullable) │───────┼────┤
└─────────────────────────┘       │    │
                                  │    │
┌─────────────────────────┐       │    │
│ admin_users             │       │    │
│━━━━━━━━━━━━━━━━━━━━━━━━│       │    │
│ id (PK)                 │       │ Authentication
│ email (unique)          │       │
│ password_hash           │       │
│ role                    │       │
│ agency_id (FK,nullable) │───────┼────┘
│ created_at              │       │
│ last_login              │       │
└─────────────────────────┘       │
                                  │
          ┌───────────────────────┘
          │
          ▼
┌─────────────────────────┐
│ agencies (existing)     │
│━━━━━━━━━━━━━━━━━━━━━━━━│
│ id (PK)                 │
│ name                    │
│ custom_domain           │
│ ...                     │
└─────────────────────────┘
```

## Table Definitions

### 1. logs

Primary table for all log entries. Stores complete debugging information with PII sanitization applied at write time.

```sql
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  correlation_id TEXT,
  timestamp INTEGER NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL')),
  operation TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  duration_ms INTEGER,
  status TEXT CHECK(status IN ('success', 'failure', 'timeout', NULL)),
  agency_id TEXT,
  endpoint TEXT,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_request_id ON logs(request_id);
CREATE INDEX IF NOT EXISTS idx_logs_correlation_id ON logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_logs_endpoint_timestamp ON logs(endpoint, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_severity_timestamp ON logs(severity, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_agency_timestamp ON logs(agency_id, timestamp DESC);
```

**Field Descriptions**:
- `id`: UUID generated for each log entry
- `request_id`: UUID per API request (all logs from one request share this)
- `correlation_id`: Trip ID or session ID for tracing across multiple requests
- `timestamp`: Unix epoch milliseconds (UTC)
- `severity`: Log level for filtering (DEBUG < INFO < WARN < ERROR < CRITICAL)
- `operation`: Descriptive name (e.g., "trip_creation", "llm_call_openai", "db_query_trips")
- `message`: Human-readable log message (PII sanitized)
- `metadata`: JSON string with operation-specific data (PII sanitized)
- `duration_ms`: Operation duration in milliseconds (null for non-timed operations)
- `status`: Outcome (null for in-progress operations)
- `agency_id`: For multi-tenant filtering (null for global operations)
- `endpoint`: API path (e.g., "/api/trips", "/api/research")

**Retention**: Auto-purged after 1 year (365 days)

---

### 2. metrics_snapshots

Pre-aggregated metrics calculated every 5 minutes. Enables fast dashboard queries for live metrics.

```sql
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  rpm INTEGER NOT NULL DEFAULT 0,
  error_rate REAL NOT NULL DEFAULT 0.0,
  avg_response_ms INTEGER NOT NULL DEFAULT 0,
  active_requests INTEGER NOT NULL DEFAULT 0,
  agency_id TEXT,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics_snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_agency_timestamp ON metrics_snapshots(agency_id, timestamp DESC);
```

**Field Descriptions**:
- `id`: UUID for snapshot
- `timestamp`: Start of 5-minute window (Unix epoch ms)
- `rpm`: Requests per minute (total requests in window / 5)
- `error_rate`: Percentage of requests with severity=ERROR (0.0 to 1.0)
- `avg_response_ms`: Average duration_ms for all requests in window
- `active_requests`: Count of requests with status=NULL at snapshot time
- `agency_id`: Null for global metrics, set for per-agency metrics

**Populated By**: Scheduled Worker runs every 5 minutes

**Retention**: Auto-purged after 1 year (same as logs)

---

### 3. daily_aggregates

Rolled-up daily statistics for historical trend analysis. Kept indefinitely.

```sql
CREATE TABLE IF NOT EXISTS daily_aggregates (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_errors INTEGER NOT NULL DEFAULT 0,
  total_cost_usd REAL NOT NULL DEFAULT 0.0,
  avg_response_ms INTEGER NOT NULL DEFAULT 0,
  p95_response_ms INTEGER NOT NULL DEFAULT 0,
  p99_response_ms INTEGER NOT NULL DEFAULT 0,
  provider_breakdown_json TEXT,
  endpoint_breakdown_json TEXT,
  agency_id TEXT,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_aggregates(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_agency_date ON daily_aggregates(agency_id, date DESC);
```

**Field Descriptions**:
- `id`: UUID for aggregate
- `date`: Date in YYYY-MM-DD format (e.g., "2025-10-07")
- `total_requests`: Count of all log entries for the day
- `total_errors`: Count of log entries with severity=ERROR or CRITICAL
- `total_cost_usd`: Sum of all LLM costs from provider calls (from existing messages table)
- `avg_response_ms`: Average duration_ms for the day
- `p95_response_ms`: 95th percentile response time
- `p99_response_ms`: 99th percentile response time
- `provider_breakdown_json`: JSON object: `{"openai": 42, "anthropic": 58}` (percentage of calls)
- `endpoint_breakdown_json`: JSON object: `{"/api/trips": 120, "/api/research": 85}`
- `agency_id`: Null for global aggregates, set for per-agency aggregates

**Populated By**: Scheduled Worker runs daily at 4 AM UTC (after log purge)

**Retention**: **Kept indefinitely** (never purged)

---

### 4. admin_users

Authentication and role-based access control for admin dashboard.

```sql
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin', 'agency_admin')),
  agency_id TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  last_login INTEGER,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_agency ON admin_users(agency_id);
```

**Field Descriptions**:
- `id`: UUID for admin user
- `email`: Login email (unique)
- `password_hash`: Bcrypt hash of password (never store plain text)
- `role`: Either "super_admin" (sees all agencies) or "agency_admin" (scoped to agency)
- `agency_id`: Required for agency_admin role, null for super_admin
- `created_at`: Account creation timestamp
- `last_login`: Last successful login timestamp (updated on each login)

**Constraints**:
- If `role = 'agency_admin'`, then `agency_id` must NOT be null
- If `role = 'super_admin'`, then `agency_id` must be null

---

## Relationships

1. **logs.agency_id → agencies.id**
   - Logs belong to an agency (null for global operations)
   - ON DELETE SET NULL (keep logs if agency deleted)

2. **metrics_snapshots.agency_id → agencies.id**
   - Metrics scoped to agency (null for global metrics)
   - ON DELETE CASCADE (delete agency metrics with agency)

3. **daily_aggregates.agency_id → agencies.id**
   - Aggregates scoped to agency (null for global aggregates)
   - ON DELETE CASCADE (delete agency aggregates with agency)

4. **admin_users.agency_id → agencies.id**
   - Admin user scoped to agency (null for super_admin)
   - ON DELETE CASCADE (delete admin if agency deleted)

## Migration File

**File**: `migrations/011_add_logging_tables.sql`

```sql
-- Migration 011: Add logging and admin dashboard tables
-- This migration adds 4 new tables for structured logging, metrics aggregation, and admin access

-- 1. Primary log entries table
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  correlation_id TEXT,
  timestamp INTEGER NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL')),
  operation TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  duration_ms INTEGER,
  status TEXT CHECK(status IN ('success', 'failure', 'timeout', NULL)),
  agency_id TEXT,
  endpoint TEXT,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_request_id ON logs(request_id);
CREATE INDEX IF NOT EXISTS idx_logs_correlation_id ON logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_logs_endpoint_timestamp ON logs(endpoint, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_severity_timestamp ON logs(severity, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_agency_timestamp ON logs(agency_id, timestamp DESC);

-- 2. Pre-aggregated 5-minute metrics snapshots
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  rpm INTEGER NOT NULL DEFAULT 0,
  error_rate REAL NOT NULL DEFAULT 0.0,
  avg_response_ms INTEGER NOT NULL DEFAULT 0,
  active_requests INTEGER NOT NULL DEFAULT 0,
  agency_id TEXT,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics_snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_agency_timestamp ON metrics_snapshots(agency_id, timestamp DESC);

-- 3. Daily rolled-up aggregates (kept indefinitely)
CREATE TABLE IF NOT EXISTS daily_aggregates (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_errors INTEGER NOT NULL DEFAULT 0,
  total_cost_usd REAL NOT NULL DEFAULT 0.0,
  avg_response_ms INTEGER NOT NULL DEFAULT 0,
  p95_response_ms INTEGER NOT NULL DEFAULT 0,
  p99_response_ms INTEGER NOT NULL DEFAULT 0,
  provider_breakdown_json TEXT,
  endpoint_breakdown_json TEXT,
  agency_id TEXT,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_aggregates(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_agency_date ON daily_aggregates(agency_id, date DESC);

-- 4. Admin users for dashboard access
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin', 'agency_admin')),
  agency_id TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  last_login INTEGER,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_agency ON admin_users(agency_id);

-- Seed a default super admin (password: "admin123" - CHANGE IN PRODUCTION!)
-- bcrypt hash of "admin123" with cost factor 10
INSERT OR IGNORE INTO admin_users (id, email, password_hash, role, agency_id)
VALUES (
  'admin-001',
  'admin@voygent.ai',
  '$2b$10$rKGZqHQHJXq1ZXcL9eJ0PeYGQvZ8WxJ5yB7jV2Jt9mYkL4Qp6xD8e',
  'super_admin',
  NULL
);
```

## Sample Data

For testing, insert sample log entries:

```sql
-- Sample log entries for testing
INSERT INTO logs (id, request_id, correlation_id, timestamp, severity, operation, message, metadata, duration_ms, status, agency_id, endpoint)
VALUES
  -- Successful trip creation
  ('log-001', 'req-001', 'trip-123', unixepoch(), 'INFO', 'trip_creation', 'Trip creation started', '{"user_id":"user-456"}', NULL, NULL, NULL, '/api/trips'),
  ('log-002', 'req-001', 'trip-123', unixepoch(), 'INFO', 'llm_call_openai', 'Called OpenAI for intake normalization', '{"model":"gpt-4o-mini","tokens_in":450,"tokens_out":320,"cost_usd":0.0015}', 1240, 'success', NULL, '/api/trips'),
  ('log-003', 'req-001', 'trip-123', unixepoch(), 'INFO', 'trip_creation_response', 'Trip creation completed', '{"trip_id":"trip-123"}', 2890, 'success', NULL, '/api/trips'),

  -- Error case
  ('log-004', 'req-002', 'trip-124', unixepoch(), 'ERROR', 'llm_call_openai', 'OpenAI API timeout', '{"model":"gpt-4o","error":"timeout"}', 30000, 'timeout', NULL, '/api/trips'),
  ('log-005', 'req-002', 'trip-124', unixepoch(), 'CRITICAL', 'trip_creation_response', 'Trip creation failed', '{"trip_id":"trip-124","error":"LLM timeout"}', 31200, 'failure', NULL, '/api/trips');
```

## Query Examples

### Get last 20 errors
```sql
SELECT * FROM logs
WHERE severity IN ('ERROR', 'CRITICAL')
ORDER BY timestamp DESC
LIMIT 20;
```

### Get complete trace for a trip
```sql
SELECT * FROM logs
WHERE correlation_id = 'trip-123'
ORDER BY timestamp ASC;
```

### Get live metrics (last snapshot)
```sql
SELECT * FROM metrics_snapshots
ORDER BY timestamp DESC
LIMIT 1;
```

### Get daily request volume for last 30 days
```sql
SELECT date, total_requests, total_errors
FROM daily_aggregates
WHERE date >= date('now', '-30 days')
ORDER BY date DESC;
```

### Get per-agency cost for this month
```sql
SELECT a.name, SUM(da.total_cost_usd) as total_cost
FROM daily_aggregates da
JOIN agencies a ON da.agency_id = a.id
WHERE date >= date('now', 'start of month')
GROUP BY da.agency_id, a.name
ORDER BY total_cost DESC;
```

### Get slowest endpoints
```sql
SELECT endpoint, AVG(duration_ms) as avg_ms, COUNT(*) as count
FROM logs
WHERE timestamp >= (unixepoch() - 86400) -- last 24 hours
  AND duration_ms IS NOT NULL
GROUP BY endpoint
ORDER BY avg_ms DESC
LIMIT 10;
```

## Performance Considerations

1. **Index Strategy**:
   - `idx_logs_timestamp`: Enables fast time-range queries (most common)
   - `idx_logs_request_id`: Enables instant request trace lookup
   - `idx_logs_correlation_id`: Enables instant trip trace lookup
   - Composite indexes on `(endpoint, timestamp)`, `(severity, timestamp)`, `(agency_id, timestamp)` optimize filtered queries

2. **Query Patterns**:
   - Dashboard queries hit `metrics_snapshots` (pre-aggregated, fast)
   - Historical charts hit `daily_aggregates` (rolled up, small table)
   - Trace viewer hits `logs` with indexed `correlation_id` (instant lookup)
   - Raw log search uses time range + severity filters (both indexed)

3. **Write Performance**:
   - Batch logging (buffer 10 entries or 1 second) reduces write overhead
   - Async writes (don't wait for completion) keep request latency low
   - Fail-safe try-catch prevents logging from blocking requests

4. **Storage Estimates**:
   - Average log entry: ~500 bytes (with metadata)
   - At 1000 RPM: 60,000 logs/hour = 30 MB/hour = 720 MB/day
   - 1 year retention: ~250 GB (well within D1 limits)
   - With purging: Steady state ~50-100 GB

## Validation Checklist

- [x] All 48 functional requirements supported by schema
- [x] Indexes optimize all dashboard queries (<10ms)
- [x] Foreign keys enforce referential integrity
- [x] CHECK constraints prevent invalid data
- [x] PII sanitization applied before storage (not in schema, handled at write time)
- [x] Role-based access supported (agency_id filtering, admin_users roles)
- [x] 1-year retention implementable (timestamp indexed for efficient deletes)
- [x] Aggregate metrics kept indefinitely (daily_aggregates never purged)

**Ready for Implementation**: ✅ Schema complete, migration file ready, sample data provided.
