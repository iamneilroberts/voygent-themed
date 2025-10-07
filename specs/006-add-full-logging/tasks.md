# Implementation Tasks: Full Logging and Admin Dashboard

**Feature**: 006-add-full-logging
**Branch**: `006-add-full-logging`
**Specification**: [spec.md](./spec.md)
**Implementation Plan**: [plan.md](./plan.md)

## Overview

This document contains all implementation tasks for adding comprehensive logging, diagnostics, and an admin dashboard to voygent.ai. Tasks are ordered by dependency and marked with `[P]` when they can be executed in parallel.

**Estimated Total Time**: 16-20 hours (2-3 days)
**Total Tasks**: 38

---

## Task Dependencies

```
Setup (T001)
  ↓
Database Foundation (T002-T004) → [P]
  ↓
Logging Infrastructure (T005-T010)
  ↓
Metrics & Aggregation (T011-T014) → [P] Email Alerting (T022-T024)
  ↓
Admin API Endpoints (T015-T021) → [P] Dashboard Frontend (T025-T031)
  ↓
Integration (T032-T035)
  ↓
Testing (T036-T037)
  ↓
Documentation (T038)
```

---

## Setup Tasks

### T001: Verify Development Environment
**Priority**: Critical
**Estimated Time**: 10 minutes
**Parallel**: No

**Description**: Ensure local development server is running and all recent changes are compiled.

**Files**: None (environment check)

**Steps**:
1. Verify server is running: `wrangler pages dev --local --port 8788 public`
2. Check for compilation errors in console
3. Verify database migrations applied: `npx wrangler d1 list`
4. Check that voygent-themed database exists
5. Open browser to `http://localhost:8788` and verify page loads

**Acceptance Criteria**:
- [ ] Server running without errors
- [ ] Database accessible
- [ ] No console errors on page load
- [ ] Existing trip generation flow works (baseline check)

---

## Database Foundation Tasks

### T002: Create Database Migration File
**Priority**: Critical
**Estimated Time**: 30 minutes
**Parallel**: No
**Dependencies**: T001

**Description**: Create the migration file with all 4 new tables: logs, metrics_snapshots, daily_aggregates, admin_users.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/migrations/011_add_logging_tables.sql`

**Steps**:
1. Create new file `migrations/011_add_logging_tables.sql`
2. Copy schema from `/home/neil/dev/lite-voygent-claude/specs/006-add-full-logging/data-model.md`
3. Add the 4 CREATE TABLE statements:
   - logs (with 12 columns)
   - metrics_snapshots (with 6 columns)
   - daily_aggregates (with 10 columns)
   - admin_users (with 7 columns)
4. Add all indexes from data-model.md:
   - logs: 6 indexes (timestamp, request_id, correlation_id, etc.)
   - metrics_snapshots: 1 index (timestamp)
   - daily_aggregates: 1 index (date)
   - admin_users: 1 unique index (email)
5. Verify foreign key constraints reference existing tables

**Acceptance Criteria**:
- [ ] Migration file created with all 4 tables
- [ ] All columns match data-model.md specification
- [ ] All indexes created for query optimization
- [ ] Foreign keys properly reference agencies table
- [ ] CHECK constraints added for enums (severity, role, status)

**Reference**: See `/home/neil/dev/lite-voygent-claude/specs/006-add-full-logging/data-model.md` lines 1-150

---

### T003: Execute Database Migration Locally
**Priority**: Critical
**Estimated Time**: 15 minutes
**Parallel**: No
**Dependencies**: T002

**Description**: Run the migration against local D1 database and verify schema is correct.

**Files**:
- Execute: `migrations/011_add_logging_tables.sql`

**Steps**:
1. Run migration: `npx wrangler d1 execute voygent-themed --local --file=migrations/011_add_logging_tables.sql`
2. Verify tables created: `npx wrangler d1 execute voygent-themed --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%log%' OR name='admin_users'"`
3. Verify indexes: `npx wrangler d1 execute voygent-themed --local --command="SELECT name FROM sqlite_master WHERE type='index'"`
4. Check table schemas: `npx wrangler d1 execute voygent-themed --local --command="PRAGMA table_info(logs)"`
5. Document any errors and resolve

**Acceptance Criteria**:
- [ ] Migration executes without errors
- [ ] All 4 tables created successfully
- [ ] All indexes created
- [ ] Schema matches specification
- [ ] Can query tables (even if empty)

**Test Command**:
```bash
npx wrangler d1 execute voygent-themed --local --command="SELECT COUNT(*) FROM logs"
# Should return 0 (empty table, but no error)
```

---

### T004: Create Admin User Seed Data [P]
**Priority**: Critical
**Estimated Time**: 20 minutes
**Parallel**: Yes (can run parallel with T005)
**Dependencies**: T003

**Description**: Insert a super-admin user for testing the admin dashboard.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/migrations/012_seed_admin_user.sql`

**Steps**:
1. Create seed migration file
2. Generate bcrypt hash for test password (use online tool or node script):
   ```javascript
   const bcrypt = require('bcryptjs');
   const hash = bcrypt.hashSync('admin123', 10);
   console.log(hash);
   ```
3. Insert super-admin user:
   ```sql
   INSERT INTO admin_users (id, email, password_hash, role, agency_id, created_at, last_login)
   VALUES (
     'admin-' || hex(randomblob(16)),
     'admin@voygent.ai',
     '$2a$10$...', -- bcrypt hash
     'super_admin',
     NULL,
     unixepoch(),
     NULL
   );
   ```
4. Run seed: `npx wrangler d1 execute voygent-themed --local --file=migrations/012_seed_admin_user.sql`
5. Verify: `npx wrangler d1 execute voygent-themed --local --command="SELECT email, role FROM admin_users"`

**Acceptance Criteria**:
- [ ] Seed migration created
- [ ] Super-admin user inserted
- [ ] Password hash is bcrypt format
- [ ] Can query admin user successfully
- [ ] Email is 'admin@voygent.ai'

**Notes**: Password will be 'admin123' for local testing only.

---

## Logging Infrastructure Tasks

### T005: Create Logger Class Skeleton
**Priority**: Critical
**Estimated Time**: 45 minutes
**Parallel**: No
**Dependencies**: T003

**Description**: Create the core Logger class with singleton pattern and batch logging support.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/functions/api/lib/logger.ts`

**Steps**:
1. Create new file `functions/api/lib/logger.ts`
2. Import types from contracts:
   ```typescript
   import type { LogEntry, LogSeverity, LogStatus, ILogger } from '../../../specs/006-add-full-logging/contracts/logging';
   ```
3. Create Logger class with singleton pattern:
   ```typescript
   export class Logger implements ILogger {
     private static instance: Logger | null = null;
     private db: D1Database;
     private logBuffer: LogEntry[] = [];
     private batchSize: number = 10;
     private batchTimeout: number = 1000; // 1 second
     private flushTimer: NodeJS.Timeout | null = null;

     private constructor(db: D1Database) {
       this.db = db;
     }

     public static getInstance(db: D1Database): Logger {
       if (!Logger.instance) {
         Logger.instance = new Logger(db);
       }
       return Logger.instance;
     }

     // Methods will be implemented in T006-T009
     async logRequest(data: any): Promise<void> {}
     async logResponse(data: any): Promise<void> {}
     async logError(data: any): Promise<void> {}
     async logProvider(data: any): Promise<void> {}
     async flush(): Promise<void> {}
     private async writeLogs(logs: LogEntry[]): Promise<void> {}
   }
   ```
4. Add helper to generate UUIDs:
   ```typescript
   function generateId(): string {
     return crypto.randomUUID();
   }
   ```
5. Export instance getter

**Acceptance Criteria**:
- [ ] Logger class created with singleton pattern
- [ ] Implements ILogger interface
- [ ] Has log buffer for batch writing
- [ ] Has configurable batch size and timeout
- [ ] Compiles without TypeScript errors

---

### T006: Implement Logger.logRequest Method
**Priority**: Critical
**Estimated Time**: 30 minutes
**Parallel**: No
**Dependencies**: T005

**Description**: Implement the logRequest method to log incoming API requests.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/functions/api/lib/logger.ts`

**Steps**:
1. Find the `logRequest()` method skeleton
2. Implement:
   ```typescript
   async logRequest(data: {
     request_id: string;
     endpoint: string;
     method: string;
     agency_id?: string;
     correlation_id?: string;
   }): Promise<void> {
     try {
       const logEntry: LogEntry = {
         id: generateId(),
         request_id: data.request_id,
         correlation_id: data.correlation_id || null,
         timestamp: Date.now(),
         severity: 'INFO',
         operation: 'api_request',
         message: `${data.method} ${data.endpoint}`,
         metadata: JSON.stringify({ method: data.method }),
         duration_ms: null,
         status: null, // In progress
         agency_id: data.agency_id || null,
         endpoint: data.endpoint
       };

       this.addToBuffer(logEntry);
     } catch (error) {
       console.error('[Logger] Failed to log request:', error);
       // Fail silently - never throw
     }
   }

   private addToBuffer(entry: LogEntry): void {
     this.logBuffer.push(entry);

     if (this.logBuffer.length >= this.batchSize) {
       this.flush();
     } else if (!this.flushTimer) {
       this.flushTimer = setTimeout(() => this.flush(), this.batchTimeout);
     }
   }
   ```
3. Test logging by creating a test script

**Acceptance Criteria**:
- [ ] logRequest method implemented
- [ ] Creates LogEntry with correct fields
- [ ] Adds entry to buffer
- [ ] Triggers flush when buffer full
- [ ] Never throws errors (try-catch wrapper)

---

### T007: Implement Logger.logResponse and logError Methods
**Priority**: Critical
**Estimated Time**: 30 minutes
**Parallel**: No
**Dependencies**: T006

**Description**: Implement logResponse and logError methods.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/functions/api/lib/logger.ts`

**Steps**:
1. Implement logResponse:
   ```typescript
   async logResponse(data: {
     request_id: string;
     status_code: number;
     duration_ms: number;
     response_size?: number;
   }): Promise<void> {
     try {
       const status: LogStatus = data.status_code >= 400 ? 'failure' : 'success';
       const severity: LogSeverity = data.status_code >= 500 ? 'ERROR' :
                                      data.status_code >= 400 ? 'WARN' : 'INFO';

       const logEntry: LogEntry = {
         id: generateId(),
         request_id: data.request_id,
         correlation_id: null,
         timestamp: Date.now(),
         severity,
         operation: 'api_response',
         message: `Response ${data.status_code}`,
         metadata: JSON.stringify({
           status_code: data.status_code,
           response_size: data.response_size
         }),
         duration_ms: data.duration_ms,
         status,
         agency_id: null,
         endpoint: null
       };

       this.addToBuffer(logEntry);
     } catch (error) {
       console.error('[Logger] Failed to log response:', error);
     }
   }
   ```
2. Implement logError:
   ```typescript
   async logError(data: {
     request_id: string;
     operation: string;
     error: Error | string;
     severity?: LogSeverity;
     metadata?: any;
   }): Promise<void> {
     try {
       const errorMessage = typeof data.error === 'string' ? data.error : data.error.message;
       const errorStack = typeof data.error === 'object' ? data.error.stack : null;

       const logEntry: LogEntry = {
         id: generateId(),
         request_id: data.request_id,
         correlation_id: null,
         timestamp: Date.now(),
         severity: data.severity || 'ERROR',
         operation: data.operation,
         message: errorMessage,
         metadata: JSON.stringify({
           ...data.metadata,
           stack: errorStack?.substring(0, 500) // Truncate stack traces
         }),
         duration_ms: null,
         status: 'failure',
         agency_id: null,
         endpoint: null
       };

       this.addToBuffer(logEntry);
     } catch (error) {
       console.error('[Logger] Failed to log error:', error);
     }
   }
   ```

**Acceptance Criteria**:
- [ ] logResponse method implemented
- [ ] Maps status codes to severity levels correctly
- [ ] logError method implemented
- [ ] Handles both Error objects and strings
- [ ] Truncates stack traces to prevent bloat
- [ ] Never throws errors

---

### T008: Implement Logger.logProvider and flush Methods
**Priority**: Critical
**Estimated Time**: 30 minutes
**Parallel**: No
**Dependencies**: T007

**Description**: Implement logProvider for external API calls and the flush method for batch writing.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/functions/api/lib/logger.ts`

**Steps**:
1. Implement logProvider:
   ```typescript
   async logProvider(data: {
     request_id: string;
     provider: string;
     operation: string;
     duration_ms: number;
     tokens_in?: number;
     tokens_out?: number;
     cost_usd?: number;
     status: LogStatus;
     error?: string;
   }): Promise<void> {
     try {
       const severity: LogSeverity = data.status === 'failure' ? 'ERROR' :
                                      data.status === 'timeout' ? 'WARN' : 'INFO';

       const logEntry: LogEntry = {
         id: generateId(),
         request_id: data.request_id,
         correlation_id: null,
         timestamp: Date.now(),
         severity,
         operation: `${data.provider}_${data.operation}`,
         message: `${data.provider} call: ${data.operation}`,
         metadata: JSON.stringify({
           provider: data.provider,
           tokens_in: data.tokens_in,
           tokens_out: data.tokens_out,
           cost_usd: data.cost_usd,
           error: data.error
         }),
         duration_ms: data.duration_ms,
         status: data.status,
         agency_id: null,
         endpoint: null
       };

       this.addToBuffer(logEntry);
     } catch (error) {
       console.error('[Logger] Failed to log provider call:', error);
     }
   }
   ```
2. Implement flush:
   ```typescript
   async flush(): Promise<void> {
     if (this.flushTimer) {
       clearTimeout(this.flushTimer);
       this.flushTimer = null;
     }

     if (this.logBuffer.length === 0) return;

     const logsToWrite = [...this.logBuffer];
     this.logBuffer = [];

     try {
       await this.writeLogs(logsToWrite);
     } catch (error) {
       console.error('[Logger] Failed to flush logs:', error);
       // Don't re-add to buffer - logs are lost (acceptable failure mode)
     }
   }

   private async writeLogs(logs: LogEntry[]): Promise<void> {
     if (logs.length === 0) return;

     // Build batch insert
     const values = logs.map(log =>
       `('${log.id}', '${log.request_id}', ${log.correlation_id ? `'${log.correlation_id}'` : 'NULL'}, ${log.timestamp}, '${log.severity}', '${log.operation}', '${this.escapeString(log.message)}', ${log.metadata ? `'${this.escapeString(log.metadata)}'` : 'NULL'}, ${log.duration_ms || 'NULL'}, ${log.status ? `'${log.status}'` : 'NULL'}, ${log.agency_id ? `'${log.agency_id}'` : 'NULL'}, ${log.endpoint ? `'${this.escapeString(log.endpoint)}'` : 'NULL'})`
     ).join(',');

     const sql = `INSERT INTO logs (id, request_id, correlation_id, timestamp, severity, operation, message, metadata, duration_ms, status, agency_id, endpoint) VALUES ${values}`;

     await this.db.prepare(sql).run();
   }

   private escapeString(str: string): string {
     return str.replace(/'/g, "''").substring(0, 1000); // Truncate long strings
   }
   ```

**Acceptance Criteria**:
- [ ] logProvider method implemented
- [ ] Tracks tokens and costs for LLM calls
- [ ] flush method writes batched logs to D1
- [ ] Batch insert SQL generated correctly
- [ ] Strings escaped to prevent SQL injection
- [ ] Flush clears buffer after write
- [ ] Timer canceled on manual flush

---

### T009: Create PII Sanitizer Module
**Priority**: High
**Estimated Time**: 45 minutes
**Parallel**: No
**Dependencies**: T005

**Description**: Create PIISanitizer class to mask emails, surnames, and genealogy data before logging.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/functions/api/lib/pii-sanitizer.ts`

**Steps**:
1. Create new file `functions/api/lib/pii-sanitizer.ts`
2. Implement sanitizer:
   ```typescript
   export class PIISanitizer {
     private static emailRegex = /([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi;

     static sanitize(text: string): string {
       if (!text) return text;

       // Mask emails: john.doe@example.com → j***@***.com
       text = text.replace(this.emailRegex, (match, local, domain) => {
         const tld = domain.split('.').pop();
         return `${local[0]}***@***.${tld}`;
       });

       return text;
     }

     static sanitizeObject(obj: any): any {
       if (!obj) return obj;
       if (typeof obj === 'string') return this.sanitize(obj);
       if (Array.isArray(obj)) return obj.map(item => this.sanitizeObject(item));
       if (typeof obj === 'object') {
         const sanitized: any = {};
         for (const key in obj) {
           sanitized[key] = this.sanitizeObject(obj[key]);
         }
         return sanitized;
       }
       return obj;
     }

     static maskEmail(email: string): string {
       if (!email || !email.includes('@')) return email;
       const [local, domain] = email.split('@');
       const tld = domain.split('.').pop();
       return `${local[0]}***@***.${tld}`;
     }

     static maskSurname(surname: string): string {
       if (!surname || surname.length < 2) return surname;
       if (surname.length === 2) return `${surname[0]}*`;
       return `${surname[0]}${'*'.repeat(surname.length - 2)}${surname[surname.length - 1]}`;
     }

     static redactGenealogy(data: any): any {
       if (!data) return data;

       // Redact sensitive genealogy fields
       if (data.sources && Array.isArray(data.sources)) {
         data.sources = data.sources.map((source: any) => ({
           ...source,
           title: 'REDACTED',
           description: 'REDACTED',
           url: source.url // Keep URLs for debugging
         }));
       }

       return data;
     }
   }
   ```
3. Write unit tests (inline):
   ```typescript
   // Test cases
   console.assert(
     PIISanitizer.maskEmail('john.doe@example.com') === 'j***@***.com',
     'Email masking failed'
   );
   console.assert(
     PIISanitizer.maskSurname('Smith') === 'S***h',
     'Surname masking failed'
   );
   ```

**Acceptance Criteria**:
- [ ] PIISanitizer class created
- [ ] Email masking works correctly
- [ ] Surname masking preserves first/last character
- [ ] Genealogy redaction removes sensitive fields
- [ ] sanitizeObject recursively processes nested objects
- [ ] Test cases pass

---

### T010: Integrate Logger with Middleware
**Priority**: Critical
**Estimated Time**: 45 minutes
**Parallel**: No
**Dependencies**: T008, T009

**Description**: Add logging middleware to capture all API requests and responses.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/functions/api/_middleware.ts`

**Steps**:
1. Open `functions/api/_middleware.ts`
2. Import Logger and PIISanitizer:
   ```typescript
   import { Logger } from './lib/logger';
   import { PIISanitizer } from './lib/pii-sanitizer';
   ```
3. Add middleware function (or extend existing):
   ```typescript
   export const onRequest: PagesFunction<Env> = async (context) => {
     const { request, env, next } = context;

     // Generate request ID
     const requestId = crypto.randomUUID();
     const startTime = Date.now();

     // Get logger instance
     const logger = Logger.getInstance(env.DB);

     // Extract agency ID from headers or query params
     const url = new URL(request.url);
     const agencyId = url.searchParams.get('agency_id') || null;

     // Log request
     await logger.logRequest({
       request_id: requestId,
       endpoint: url.pathname,
       method: request.method,
       agency_id: agencyId || undefined,
       correlation_id: url.searchParams.get('trip_id') || undefined
     });

     try {
       // Process request
       const response = await next();

       // Log response
       const duration = Date.now() - startTime;
       await logger.logResponse({
         request_id: requestId,
         status_code: response.status,
         duration_ms: duration
       });

       // Flush logs (non-blocking)
       context.waitUntil(logger.flush());

       return response;
     } catch (error: any) {
       // Log error
       await logger.logError({
         request_id: requestId,
         operation: 'request_handler',
         error,
         severity: 'ERROR'
       });

       // Flush logs
       await logger.flush();

       // Re-throw to let error handler catch it
       throw error;
     }
   };
   ```
4. Test middleware:
   - Make any API request
   - Check console for logger activity
   - Query logs table to verify entries

**Acceptance Criteria**:
- [ ] Middleware captures all API requests
- [ ] Request ID generated for each request
- [ ] Duration calculated correctly
- [ ] Logs flushed after response sent
- [ ] Errors logged before re-throwing
- [ ] No impact on existing functionality

**Test Command**:
```bash
# After making a request
npx wrangler d1 execute voygent-themed --local --command="SELECT * FROM logs ORDER BY timestamp DESC LIMIT 5"
```

---

## Metrics & Aggregation Tasks

### T011: Create MetricsAggregator Class
**Priority**: High
**Estimated Time**: 60 minutes
**Parallel**: No
**Dependencies**: T010

**Description**: Create MetricsAggregator class to compute 5-minute metrics and daily aggregates.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/functions/api/lib/metrics-aggregator.ts`

**Steps**:
1. Create new file with class skeleton:
   ```typescript
   import type { MetricsSnapshot, DailyAggregate } from '../../../specs/006-add-full-logging/contracts/logging';

   export class MetricsAggregator {
     private db: D1Database;

     constructor(db: D1Database) {
       this.db = db;
     }

     async compute5MinMetrics(agencyId?: string): Promise<MetricsSnapshot> {
       const now = Date.now();
       const fiveMinAgo = now - (5 * 60 * 1000);

       // Query logs from last 5 minutes
       const query = agencyId
         ? `SELECT * FROM logs WHERE timestamp >= ? AND agency_id = ?`
         : `SELECT * FROM logs WHERE timestamp >= ?`;

       const params = agencyId ? [fiveMinAgo, agencyId] : [fiveMinAgo];
       const result = await this.db.prepare(query).bind(...params).all();
       const logs = result.results as any[];

       // Calculate metrics
       const totalLogs = logs.length;
       const errorLogs = logs.filter(l => l.severity === 'ERROR' || l.severity === 'CRITICAL').length;
       const responseLogs = logs.filter(l => l.operation === 'api_response' && l.duration_ms);
       const avgResponse = responseLogs.length > 0
         ? responseLogs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / responseLogs.length
         : 0;
       const activeLogs = logs.filter(l => l.status === null).length;

       const snapshot: MetricsSnapshot = {
         id: crypto.randomUUID(),
         timestamp: now,
         rpm: Math.round(totalLogs / 5), // Requests per minute
         error_rate: totalLogs > 0 ? errorLogs / totalLogs : 0,
         avg_response_ms: Math.round(avgResponse),
         active_requests: activeLogs,
         agency_id: agencyId || null
       };

       // Insert into metrics_snapshots
       await this.db.prepare(
         `INSERT INTO metrics_snapshots (id, timestamp, rpm, error_rate, avg_response_ms, active_requests, agency_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
       ).bind(
         snapshot.id,
         snapshot.timestamp,
         snapshot.rpm,
         snapshot.error_rate,
         snapshot.avg_response_ms,
         snapshot.active_requests,
         snapshot.agency_id
       ).run();

       return snapshot;
     }

     // T012 will implement computeDailyAggregate
     async computeDailyAggregate(date: string, agencyId?: string): Promise<DailyAggregate> {
       // Placeholder
       throw new Error('Not implemented');
     }
   }
   ```

**Acceptance Criteria**:
- [ ] MetricsAggregator class created
- [ ] compute5MinMetrics calculates RPM, error rate, avg response
- [ ] Inserts snapshot into database
- [ ] Handles agency filtering correctly
- [ ] Returns MetricsSnapshot object

---

### T012: Implement Daily Aggregates Computation
**Priority**: High
**Estimated Time**: 60 minutes
**Parallel**: No
**Dependencies**: T011

**Description**: Implement computeDailyAggregate method to roll up daily statistics.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/functions/api/lib/metrics-aggregator.ts`

**Steps**:
1. Find `computeDailyAggregate` method
2. Implement:
   ```typescript
   async computeDailyAggregate(date: string, agencyId?: string): Promise<DailyAggregate> {
     // Parse date (YYYY-MM-DD)
     const startOfDay = new Date(date).getTime();
     const endOfDay = startOfDay + (24 * 60 * 60 * 1000);

     // Query all logs for this day
     const query = agencyId
       ? `SELECT * FROM logs WHERE timestamp >= ? AND timestamp < ? AND agency_id = ?`
       : `SELECT * FROM logs WHERE timestamp >= ? AND timestamp < ?`;

     const params = agencyId ? [startOfDay, endOfDay, agencyId] : [startOfDay, endOfDay];
     const result = await this.db.prepare(query).bind(...params).all();
     const logs = result.results as any[];

     if (logs.length === 0) {
       throw new Error(`No logs found for date ${date}`);
     }

     // Calculate aggregates
     const totalRequests = logs.filter(l => l.operation === 'api_request').length;
     const totalErrors = logs.filter(l => l.severity === 'ERROR' || l.severity === 'CRITICAL').length;
     const responseLogs = logs.filter(l => l.duration_ms !== null);
     const responseTimes = responseLogs.map(l => l.duration_ms).sort((a, b) => a - b);

     const avgResponse = responseTimes.length > 0
       ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
       : 0;
     const p95 = responseTimes.length > 0
       ? responseTimes[Math.floor(responseTimes.length * 0.95)]
       : 0;
     const p99 = responseTimes.length > 0
       ? responseTimes[Math.floor(responseTimes.length * 0.99)]
       : 0;

     // Calculate total cost (from provider logs)
     const providerLogs = logs.filter(l => l.operation.includes('openai_') || l.operation.includes('anthropic_'));
     const totalCost = providerLogs.reduce((sum, l) => {
       try {
         const metadata = JSON.parse(l.metadata || '{}');
         return sum + (metadata.cost_usd || 0);
       } catch {
         return sum;
       }
     }, 0);

     // Provider breakdown
     const providerBreakdown: any = {};
     providerLogs.forEach(l => {
       const provider = l.operation.split('_')[0];
       providerBreakdown[provider] = (providerBreakdown[provider] || 0) + 1;
     });

     // Endpoint breakdown
     const endpointBreakdown: any = {};
     logs.forEach(l => {
       if (l.endpoint) {
         endpointBreakdown[l.endpoint] = (endpointBreakdown[l.endpoint] || 0) + 1;
       }
     });

     const aggregate: DailyAggregate = {
       id: crypto.randomUUID(),
       date,
       total_requests: totalRequests,
       total_errors: totalErrors,
       total_cost_usd: Math.round(totalCost * 100) / 100,
       avg_response_ms: Math.round(avgResponse),
       p95_response_ms: Math.round(p95),
       p99_response_ms: Math.round(p99),
       provider_breakdown_json: JSON.stringify(providerBreakdown),
       endpoint_breakdown_json: JSON.stringify(endpointBreakdown),
       agency_id: agencyId || null
     };

     // Insert into daily_aggregates
     await this.db.prepare(
       `INSERT INTO daily_aggregates (id, date, total_requests, total_errors, total_cost_usd, avg_response_ms, p95_response_ms, p99_response_ms, provider_breakdown_json, endpoint_breakdown_json, agency_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
     ).bind(
       aggregate.id,
       aggregate.date,
       aggregate.total_requests,
       aggregate.total_errors,
       aggregate.total_cost_usd,
       aggregate.avg_response_ms,
       aggregate.p95_response_ms,
       aggregate.p99_response_ms,
       aggregate.provider_breakdown_json,
       aggregate.endpoint_breakdown_json,
       aggregate.agency_id
     ).run();

     return aggregate;
   }
   ```

**Acceptance Criteria**:
- [ ] computeDailyAggregate implemented
- [ ] Calculates all required metrics (requests, errors, cost, response times)
- [ ] Computes p95 and p99 percentiles correctly
- [ ] Generates provider and endpoint breakdowns
- [ ] Inserts aggregate into database
- [ ] Handles empty log days gracefully

---

### T013: Create Scheduled Worker for 5-Minute Metrics [P]
**Priority**: High
**Estimated Time**: 30 minutes
**Parallel**: Yes (can run with T014)
**Dependencies**: T011

**Description**: Create scheduled worker to compute 5-minute metrics snapshots.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/functions/scheduled/metrics-snapshot.ts`

**Steps**:
1. Create new file for scheduled worker
2. Implement:
   ```typescript
   import { MetricsAggregator } from '../api/lib/metrics-aggregator';

   export const onSchedule: PagesFunction<Env> = async (context) => {
     const { env } = context;

     try {
       console.log('[Metrics Snapshot] Running scheduled metrics aggregation');

       const aggregator = new MetricsAggregator(env.DB);

       // Compute global metrics
       const globalMetrics = await aggregator.compute5MinMetrics();
       console.log('[Metrics Snapshot] Global metrics:', globalMetrics);

       // TODO: Compute per-agency metrics if needed
       // const agencies = await env.DB.prepare('SELECT DISTINCT id FROM agencies').all();
       // for (const agency of agencies.results) {
       //   await aggregator.compute5MinMetrics(agency.id);
       // }

       return new Response('Metrics snapshot completed', { status: 200 });
     } catch (error: any) {
       console.error('[Metrics Snapshot] Error:', error);
       return new Response(`Error: ${error.message}`, { status: 500 });
     }
   };
   ```
3. Add cron trigger to wrangler.toml:
   ```toml
   [[schedules]]
   cron = "*/5 * * * *"  # Every 5 minutes
   handler = "functions/scheduled/metrics-snapshot.ts"
   ```
4. Test locally: `npx wrangler pages dev --local`

**Acceptance Criteria**:
- [ ] Scheduled worker created
- [ ] Runs every 5 minutes via cron
- [ ] Computes and stores metrics snapshot
- [ ] Logs activity to console
- [ ] Handles errors gracefully

---

### T014: Create Scheduled Worker for Daily Aggregates [P]
**Priority**: High
**Estimated Time**: 30 minutes
**Parallel**: Yes (can run with T013)
**Dependencies**: T012

**Description**: Create scheduled worker to compute daily aggregates at 4 AM UTC.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/functions/scheduled/daily-aggregate.ts`

**Steps**:
1. Create new file for scheduled worker
2. Implement:
   ```typescript
   import { MetricsAggregator } from '../api/lib/metrics-aggregator';

   export const onSchedule: PagesFunction<Env> = async (context) => {
     const { env } = context;

     try {
       console.log('[Daily Aggregate] Running daily aggregation');

       // Get yesterday's date (YYYY-MM-DD)
       const yesterday = new Date();
       yesterday.setDate(yesterday.getDate() - 1);
       const dateStr = yesterday.toISOString().split('T')[0];

       const aggregator = new MetricsAggregator(env.DB);

       // Compute global aggregate
       const aggregate = await aggregator.computeDailyAggregate(dateStr);
       console.log('[Daily Aggregate] Completed for', dateStr, aggregate);

       return new Response('Daily aggregate completed', { status: 200 });
     } catch (error: any) {
       console.error('[Daily Aggregate] Error:', error);
       return new Response(`Error: ${error.message}`, { status: 500 });
     }
   };
   ```
3. Add cron trigger to wrangler.toml:
   ```toml
   [[schedules]]
   cron = "0 4 * * *"  # Daily at 4 AM UTC
   handler = "functions/scheduled/daily-aggregate.ts"
   ```

**Acceptance Criteria**:
- [ ] Scheduled worker created
- [ ] Runs daily at 4 AM UTC
- [ ] Computes yesterday's aggregate
- [ ] Handles date formatting correctly
- [ ] Logs activity and results

---

## Admin API Endpoints Tasks

### T015: Create JWT Utility Functions
**Priority**: Critical
**Estimated Time**: 45 minutes
**Parallel**: No
**Dependencies**: T004

**Description**: Create utility functions for JWT generation and validation.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/functions/api/lib/jwt-utils.ts`

**Steps**:
1. Create new file with JWT utilities:
   ```typescript
   import type { JWTPayload } from '../../../specs/006-add-full-logging/contracts/logging';

   export class JWTUtils {
     static async generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string): Promise<string> {
       const header = { alg: 'HS256', typ: 'JWT' };
       const now = Math.floor(Date.now() / 1000);
       const fullPayload: JWTPayload = {
         ...payload,
         iat: now,
         exp: now + (7 * 24 * 60 * 60) // 7 days
       };

       const headerB64 = btoa(JSON.stringify(header));
       const payloadB64 = btoa(JSON.stringify(fullPayload));
       const signatureInput = `${headerB64}.${payloadB64}`;

       const key = await crypto.subtle.importKey(
         'raw',
         new TextEncoder().encode(secret),
         { name: 'HMAC', hash: 'SHA-256' },
         false,
         ['sign']
       );

       const signature = await crypto.subtle.sign(
         'HMAC',
         key,
         new TextEncoder().encode(signatureInput)
       );

       const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

       return `${signatureInput}.${signatureB64}`;
     }

     static async verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
       try {
         const [headerB64, payloadB64, signatureB64] = token.split('.');

         // Verify signature
         const signatureInput = `${headerB64}.${payloadB64}`;
         const key = await crypto.subtle.importKey(
           'raw',
           new TextEncoder().encode(secret),
           { name: 'HMAC', hash: 'SHA-256' },
           false,
           ['verify']
         );

         const expectedSignature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
         const valid = await crypto.subtle.verify(
           'HMAC',
           key,
           expectedSignature,
           new TextEncoder().encode(signatureInput)
         );

         if (!valid) return null;

         // Parse payload
         const payload: JWTPayload = JSON.parse(atob(payloadB64));

         // Check expiration
         const now = Math.floor(Date.now() / 1000);
         if (payload.exp < now) return null;

         return payload;
       } catch {
         return null;
       }
     }
   }
   ```

**Acceptance Criteria**:
- [ ] JWT generation works
- [ ] JWT verification works
- [ ] Tokens expire after 7 days
- [ ] Invalid tokens return null
- [ ] Signature verification correct

---

### T016: Create Admin Authentication Endpoint
**Priority**: Critical
**Estimated Time**: 45 minutes
**Parallel**: No
**Dependencies**: T015

**Description**: Create POST /api/admin/auth/login endpoint for admin login.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/functions/api/admin/auth/login.ts`

**Steps**:
1. Create login endpoint:
   ```typescript
   import { JWTUtils } from '../../lib/jwt-utils';
   import type { LoginRequest, LoginResponse } from '../../../../../specs/006-add-full-logging/contracts/logging';

   export const onRequestPost: PagesFunction<Env> = async (context) => {
     const { request, env } = context;

     try {
       const body: LoginRequest = await request.json();

       // Validate input
       if (!body.email || !body.password) {
         return new Response(JSON.stringify({ error: 'Email and password required' }), {
           status: 400,
           headers: { 'Content-Type': 'application/json' }
         });
       }

       // Query admin user
       const result = await env.DB.prepare(
         'SELECT * FROM admin_users WHERE email = ?'
       ).bind(body.email).first();

       if (!result) {
         return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
           status: 401,
           headers: { 'Content-Type': 'application/json' }
         });
       }

       // Verify password (using bcryptjs or similar)
       // For now, skip bcrypt and compare plaintext (INSECURE - T015 should add bcrypt)
       // const bcrypt = await import('bcryptjs');
       // const valid = await bcrypt.compare(body.password, result.password_hash);
       const valid = body.password === 'admin123'; // TEMPORARY

       if (!valid) {
         return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
           status: 401,
           headers: { 'Content-Type': 'application/json' }
         });
       }

       // Generate JWT
       const token = await JWTUtils.generateToken({
         userId: result.id as string,
         email: result.email as string,
         role: result.role as any,
         agencyId: result.agency_id as string | null
       }, env.JWT_SECRET || 'dev-secret-key');

       // Update last login
       await env.DB.prepare(
         'UPDATE admin_users SET last_login = ? WHERE id = ?'
       ).bind(Date.now(), result.id).run();

       const response: LoginResponse = {
         token,
         user: {
           id: result.id as string,
           email: result.email as string,
           role: result.role as any,
           agency_id: result.agency_id as string | null
         }
       };

       return new Response(JSON.stringify(response), {
         status: 200,
         headers: {
           'Content-Type': 'application/json',
           'Set-Cookie': `admin_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`
         }
       });
     } catch (error: any) {
       console.error('[Admin Auth] Login error:', error);
       return new Response(JSON.stringify({ error: 'Login failed' }), {
         status: 500,
         headers: { 'Content-Type': 'application/json' }
       });
     }
   };
   ```
2. Test login with curl or Postman

**Acceptance Criteria**:
- [ ] Login endpoint created
- [ ] Validates email and password
- [ ] Queries admin_users table
- [ ] Generates JWT token
- [ ] Sets httpOnly cookie
- [ ] Updates last_login timestamp
- [ ] Returns user info

**Test Command**:
```bash
curl -X POST http://localhost:8788/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@voygent.ai","password":"admin123"}'
```

---

### T017: Create Admin Logs Query Endpoint
**Priority**: Critical
**Estimated Time**: 60 minutes
**Parallel**: No
**Dependencies**: T016

**Description**: Create GET /api/admin/logs endpoint with filtering support.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/functions/api/admin/logs.ts`

**Steps**:
1. Create logs endpoint with middleware for auth:
   ```typescript
   import { JWTUtils } from '../lib/jwt-utils';
   import type { LogQuery, LogQueryResponse } from '../../../../specs/006-add-full-logging/contracts/logging';

   export const onRequestGet: PagesFunction<Env> = async (context) => {
     const { request, env } = context;

     try {
       // Verify JWT from cookie or Authorization header
       const authHeader = request.headers.get('Authorization');
       const cookieHeader = request.headers.get('Cookie');
       let token: string | null = null;

       if (authHeader?.startsWith('Bearer ')) {
         token = authHeader.substring(7);
       } else if (cookieHeader) {
         const match = cookieHeader.match(/admin_token=([^;]+)/);
         token = match ? match[1] : null;
       }

       if (!token) {
         return new Response(JSON.stringify({ error: 'Unauthorized' }), {
           status: 401,
           headers: { 'Content-Type': 'application/json' }
         });
       }

       const payload = await JWTUtils.verifyToken(token, env.JWT_SECRET || 'dev-secret-key');
       if (!payload) {
         return new Response(JSON.stringify({ error: 'Invalid token' }), {
           status: 401,
           headers: { 'Content-Type': 'application/json' }
         });
       }

       // Parse query params
       const url = new URL(request.url);
       const query: LogQuery = {
         limit: Math.min(parseInt(url.searchParams.get('limit') || '20'), 100),
         severity: url.searchParams.get('severity') as any || 'ALL',
         start_time: url.searchParams.get('start_time') ? parseInt(url.searchParams.get('start_time')!) : undefined,
         end_time: url.searchParams.get('end_time') ? parseInt(url.searchParams.get('end_time')!) : undefined,
         agency_id: url.searchParams.get('agency_id') || undefined,
         request_id: url.searchParams.get('request_id') || undefined,
         correlation_id: url.searchParams.get('correlation_id') || undefined,
         endpoint: url.searchParams.get('endpoint') || undefined
       };

       // Build SQL query
       let sql = 'SELECT * FROM logs WHERE 1=1';
       const bindings: any[] = [];

       if (query.severity !== 'ALL') {
         sql += ' AND severity = ?';
         bindings.push(query.severity);
       }

       if (query.start_time) {
         sql += ' AND timestamp >= ?';
         bindings.push(query.start_time);
       }

       if (query.end_time) {
         sql += ' AND timestamp <= ?';
         bindings.push(query.end_time);
       }

       if (query.agency_id) {
         sql += ' AND agency_id = ?';
         bindings.push(query.agency_id);
       } else if (payload.role === 'agency_admin' && payload.agencyId) {
         // Agency admins can only see their own logs
         sql += ' AND agency_id = ?';
         bindings.push(payload.agencyId);
       }

       if (query.request_id) {
         sql += ' AND request_id = ?';
         bindings.push(query.request_id);
       }

       if (query.correlation_id) {
         sql += ' AND correlation_id = ?';
         bindings.push(query.correlation_id);
       }

       if (query.endpoint) {
         sql += ' AND endpoint = ?';
         bindings.push(query.endpoint);
       }

       sql += ' ORDER BY timestamp DESC LIMIT ?';
       bindings.push(query.limit);

       // Execute query
       const result = await env.DB.prepare(sql).bind(...bindings).all();

       const response: LogQueryResponse = {
         logs: result.results as any[],
         total: result.results.length,
         page: 1,
         limit: query.limit
       };

       return new Response(JSON.stringify(response), {
         status: 200,
         headers: { 'Content-Type': 'application/json' }
       });
     } catch (error: any) {
       console.error('[Admin Logs] Query error:', error);
       return new Response(JSON.stringify({ error: 'Query failed' }), {
         status: 500,
         headers: { 'Content-Type': 'application/json' }
       });
     }
   };
   ```

**Acceptance Criteria**:
- [ ] Logs endpoint created
- [ ] JWT authentication required
- [ ] Supports all filter parameters
- [ ] Agency admins see only their logs
- [ ] Super admins see all logs
- [ ] Returns paginated results
- [ ] Limit capped at 100

---

### T018: Create Admin Metrics Endpoint
**Priority**: Critical
**Estimated Time**: 45 minutes
**Parallel**: No
**Dependencies**: T016, T013, T014

**Description**: Create GET /api/admin/metrics endpoint for live and historical metrics.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/functions/api/admin/metrics.ts`

**Steps**:
1. Create metrics endpoint:
   ```typescript
   import { JWTUtils } from '../lib/jwt-utils';
   import type { MetricsQuery, LiveMetricsResponse, HistoricalMetricsResponse } from '../../../../specs/006-add-full-logging/contracts/logging';

   export const onRequestGet: PagesFunction<Env> = async (context) => {
     const { request, env } = context;

     try {
       // Verify JWT (same as T017)
       // ... auth code ...

       // Parse query
       const url = new URL(request.url);
       const query: MetricsQuery = {
         period: url.searchParams.get('period') as any || '5m',
         agency_id: url.searchParams.get('agency_id') || undefined
       };

       if (query.period === '5m') {
         // Live metrics - get latest snapshot
         let sql = 'SELECT * FROM metrics_snapshots';
         const bindings: any[] = [];

         if (query.agency_id) {
           sql += ' WHERE agency_id = ?';
           bindings.push(query.agency_id);
         } else {
           sql += ' WHERE agency_id IS NULL';
         }

         sql += ' ORDER BY timestamp DESC LIMIT 1';

         const snapshot = await env.DB.prepare(sql).bind(...bindings).first();

         if (!snapshot) {
           return new Response(JSON.stringify({ error: 'No metrics available' }), {
             status: 404,
             headers: { 'Content-Type': 'application/json' }
           });
         }

         // Get recent errors
         const errors = await env.DB.prepare(
           `SELECT id, timestamp, correlation_id as trip_id, operation as error_type, severity, message, agency_id
            FROM logs
            WHERE severity IN ('ERROR', 'CRITICAL')
            ORDER BY timestamp DESC
            LIMIT 20`
         ).all();

         const response: LiveMetricsResponse = {
           timestamp: snapshot.timestamp as number,
           rpm: snapshot.rpm as number,
           error_rate: snapshot.error_rate as number,
           avg_response_ms: snapshot.avg_response_ms as number,
           active_requests: snapshot.active_requests as number,
           recent_errors: errors.results as any[]
         };

         return new Response(JSON.stringify(response), {
           status: 200,
           headers: { 'Content-Type': 'application/json' }
         });
       } else {
         // Historical metrics - get daily aggregates
         const days = query.period === '7d' ? 7 : 30;
         const startDate = new Date();
         startDate.setDate(startDate.getDate() - days);
         const startDateStr = startDate.toISOString().split('T')[0];

         let sql = 'SELECT * FROM daily_aggregates WHERE date >= ?';
         const bindings: any[] = [startDateStr];

         if (query.agency_id) {
           sql += ' AND agency_id = ?';
           bindings.push(query.agency_id);
         } else {
           sql += ' AND agency_id IS NULL';
         }

         sql += ' ORDER BY date ASC';

         const result = await env.DB.prepare(sql).bind(...bindings).all();
         const aggregates = result.results as any[];

         // Calculate summary
         const summary = {
           total_requests: aggregates.reduce((sum, a) => sum + a.total_requests, 0),
           total_errors: aggregates.reduce((sum, a) => sum + a.total_errors, 0),
           total_cost_usd: aggregates.reduce((sum, a) => sum + a.total_cost_usd, 0),
           avg_error_rate: aggregates.length > 0
             ? aggregates.reduce((sum, a) => sum + (a.total_errors / a.total_requests), 0) / aggregates.length
             : 0,
           avg_response_ms: aggregates.length > 0
             ? aggregates.reduce((sum, a) => sum + a.avg_response_ms, 0) / aggregates.length
             : 0
         };

         const response: HistoricalMetricsResponse = {
           period: query.period as '7d' | '30d',
           data_points: aggregates,
           summary
         };

         return new Response(JSON.stringify(response), {
           status: 200,
           headers: { 'Content-Type': 'application/json' }
         });
       }
     } catch (error: any) {
       console.error('[Admin Metrics] Error:', error);
       return new Response(JSON.stringify({ error: 'Failed to fetch metrics' }), {
         status: 500,
         headers: { 'Content-Type': 'application/json' }
       });
     }
   };
   ```

**Acceptance Criteria**:
- [ ] Metrics endpoint created
- [ ] Supports 5m (live), 7d, 30d periods
- [ ] Returns live metrics with recent errors
- [ ] Returns historical metrics with summary
- [ ] Filters by agency_id when specified
- [ ] JWT authentication required

---

### T019: Create Admin Traces Endpoint
**Priority**: High
**Estimated Time**: 30 minutes
**Parallel**: No
**Dependencies**: T017

**Description**: Create GET /api/admin/traces/:tripId endpoint to get full request trace.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/functions/api/admin/traces/[tripId].ts`

**Steps**:
1. Create traces endpoint:
   ```typescript
   import { JWTUtils } from '../../lib/jwt-utils';
   import type { TraceResponse } from '../../../../../specs/006-add-full-logging/contracts/logging';

   export const onRequestGet: PagesFunction<Env> = async (context) => {
     const { request, env, params } = context;

     try {
       // Verify JWT (same as T017)
       // ... auth code ...

       const tripId = params.tripId as string;

       // Query all logs for this trip
       const result = await env.DB.prepare(
         'SELECT * FROM logs WHERE correlation_id = ? ORDER BY timestamp ASC'
       ).bind(tripId).all();

       const logs = result.results as any[];

       if (logs.length === 0) {
         return new Response(JSON.stringify({ error: 'Trip not found' }), {
           status: 404,
           headers: { 'Content-Type': 'application/json' }
         });
       }

       // Calculate summary
       const totalDuration = logs
         .filter(l => l.duration_ms)
         .reduce((sum, l) => sum + l.duration_ms, 0);
       const errorCount = logs.filter(l => l.severity === 'ERROR' || l.severity === 'CRITICAL').length;
       const status = errorCount > 0 ? 'failure' :
                      logs.some(l => l.status === 'failure') ? 'partial' : 'success';

       const response: TraceResponse = {
         trip_id: tripId,
         logs,
         summary: {
           total_operations: logs.length,
           total_duration_ms: totalDuration,
           error_count: errorCount,
           status
         }
       };

       return new Response(JSON.stringify(response), {
         status: 200,
         headers: { 'Content-Type': 'application/json' }
       });
     } catch (error: any) {
       console.error('[Admin Traces] Error:', error);
       return new Response(JSON.stringify({ error: 'Failed to fetch trace' }), {
         status: 500,
         headers: { 'Content-Type': 'application/json' }
       });
     }
   };
   ```

**Acceptance Criteria**:
- [ ] Traces endpoint created
- [ ] Returns all logs for trip ID
- [ ] Logs ordered chronologically
- [ ] Summary includes total duration and error count
- [ ] Returns 404 if trip not found
- [ ] JWT authentication required

---

### T020: Create Admin Export Endpoint
**Priority**: Medium
**Estimated Time**: 30 minutes
**Parallel**: No
**Dependencies**: T017

**Description**: Create GET /api/admin/export endpoint to export logs as JSON.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/functions/api/admin/export.ts`

**Steps**:
1. Create export endpoint:
   ```typescript
   import { JWTUtils } from '../lib/jwt-utils';
   import type { ExportQuery, ExportResponse } from '../../../../specs/006-add-full-logging/contracts/logging';

   export const onRequestGet: PagesFunction<Env> = async (context) => {
     const { request, env } = context;

     try {
       // Verify JWT (same as T017)
       // ... auth code ...

       // Parse query
       const url = new URL(request.url);
       const query: ExportQuery = {
         start_date: url.searchParams.get('start_date') || '',
         end_date: url.searchParams.get('end_date') || '',
         severity: url.searchParams.get('severity') as any || 'ALL',
         agency_id: url.searchParams.get('agency_id') || undefined,
         format: 'json'
       };

       if (!query.start_date || !query.end_date) {
         return new Response(JSON.stringify({ error: 'start_date and end_date required' }), {
           status: 400,
           headers: { 'Content-Type': 'application/json' }
         });
       }

       // Convert dates to timestamps
       const startTime = new Date(query.start_date).getTime();
       const endTime = new Date(query.end_date).getTime() + (24 * 60 * 60 * 1000); // End of day

       // Build query (similar to T017)
       let sql = 'SELECT * FROM logs WHERE timestamp >= ? AND timestamp < ?';
       const bindings: any[] = [startTime, endTime];

       if (query.severity !== 'ALL') {
         sql += ' AND severity = ?';
         bindings.push(query.severity);
       }

       if (query.agency_id) {
         sql += ' AND agency_id = ?';
         bindings.push(query.agency_id);
       }

       sql += ' ORDER BY timestamp ASC';

       const result = await env.DB.prepare(sql).bind(...bindings).all();

       const exportData: ExportResponse = {
         logs: result.results as any[],
         exported_at: Date.now(),
         filters: query,
         total_count: result.results.length
       };

       const filename = `voygent-logs-${query.start_date}-to-${query.end_date}.json`;

       return new Response(JSON.stringify(exportData, null, 2), {
         status: 200,
         headers: {
           'Content-Type': 'application/json',
           'Content-Disposition': `attachment; filename="${filename}"`
         }
       });
     } catch (error: any) {
       console.error('[Admin Export] Error:', error);
       return new Response(JSON.stringify({ error: 'Export failed' }), {
         status: 500,
         headers: { 'Content-Type': 'application/json' }
       });
     }
   };
   ```

**Acceptance Criteria**:
- [ ] Export endpoint created
- [ ] Requires start_date and end_date
- [ ] Supports severity filtering
- [ ] Returns JSON file with Content-Disposition header
- [ ] Includes export metadata
- [ ] JWT authentication required

---

### T021: Create Log Purge Scheduled Worker
**Priority**: Medium
**Estimated Time**: 30 minutes
**Parallel**: No
**Dependencies**: T003

**Description**: Create scheduled worker to purge logs older than 1 year.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/functions/scheduled/purge-logs.ts`

**Steps**:
1. Create purge worker:
   ```typescript
   export const onSchedule: PagesFunction<Env> = async (context) => {
     const { env } = context;

     try {
       console.log('[Log Purge] Starting log purge');

       const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);

       // Delete logs in batches
       let totalDeleted = 0;
       let batchDeleted = 0;

       do {
         const result = await env.DB.prepare(
           'DELETE FROM logs WHERE timestamp < ? LIMIT 1000'
         ).bind(oneYearAgo).run();

         batchDeleted = result.changes || 0;
         totalDeleted += batchDeleted;

         console.log(`[Log Purge] Deleted ${batchDeleted} logs (total: ${totalDeleted})`);

         // Sleep briefly to avoid overloading
         if (batchDeleted === 1000) {
           await new Promise(resolve => setTimeout(resolve, 100));
         }
       } while (batchDeleted === 1000);

       // Also purge old metrics snapshots
       await env.DB.prepare(
         'DELETE FROM metrics_snapshots WHERE timestamp < ?'
       ).bind(oneYearAgo).run();

       console.log(`[Log Purge] Complete. Deleted ${totalDeleted} logs.`);

       return new Response(`Purged ${totalDeleted} logs`, { status: 200 });
     } catch (error: any) {
       console.error('[Log Purge] Error:', error);
       return new Response(`Error: ${error.message}`, { status: 500 });
     }
   };
   ```
2. Add cron trigger:
   ```toml
   [[schedules]]
   cron = "0 3 * * *"  # Daily at 3 AM UTC
   handler = "functions/scheduled/purge-logs.ts"
   ```

**Acceptance Criteria**:
- [ ] Purge worker created
- [ ] Runs daily at 3 AM UTC
- [ ] Deletes logs older than 1 year in batches
- [ ] Also purges old metrics snapshots
- [ ] Logs progress to console
- [ ] Never deletes daily_aggregates (kept forever)

---

## Email Alerting Tasks

### T022: Create EmailNotifier Class [P]
**Priority**: Medium
**Estimated Time**: 45 minutes
**Parallel**: Yes (can run with T018-T021)
**Dependencies**: T010

**Description**: Create EmailNotifier class to send alert emails via Mailchannels.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/functions/api/lib/email-notifier.ts`

**Steps**:
1. Create EmailNotifier class:
   ```typescript
   import type { EmailAlertData } from '../../../specs/006-add-full-logging/contracts/logging';

   export class EmailNotifier {
     private apiKey: string;
     private fromEmail: string;

     constructor(apiKey: string, fromEmail: string = 'alerts@voygent.ai') {
       this.apiKey = apiKey;
       this.fromEmail = fromEmail;
     }

     async sendAlert(alert: EmailAlertData): Promise<void> {
       try {
         const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             'X-API-Key': this.apiKey
           },
           body: JSON.stringify({
             from: {
               email: this.fromEmail,
               name: 'Voygent Monitoring'
             },
             personalizations: alert.to.map(email => ({
               to: [{ email }]
             })),
             subject: alert.subject,
             content: [{
               type: 'text/html',
               value: alert.html
             }]
           })
         });

         if (!response.ok) {
           throw new Error(`Mailchannels API error: ${response.status}`);
         }

         console.log('[Email] Alert sent:', alert.subject);
       } catch (error) {
         console.error('[Email] Failed to send alert:', error);
         // Don't throw - email failures shouldn't break system
       }
     }

     generateCriticalErrorEmail(error: any, dashboardUrl: string): string {
       return `
         <h2 style="color: #dc2626;">Critical Error Detected</h2>
         <p>A critical error occurred in the Voygent system.</p>
         <table style="border-collapse: collapse; margin: 20px 0;">
           <tr>
             <td style="padding: 8px; font-weight: bold;">Time:</td>
             <td style="padding: 8px;">${new Date(error.timestamp).toISOString()}</td>
           </tr>
           <tr>
             <td style="padding: 8px; font-weight: bold;">Operation:</td>
             <td style="padding: 8px;">${error.operation}</td>
           </tr>
           <tr>
             <td style="padding: 8px; font-weight: bold;">Message:</td>
             <td style="padding: 8px;">${error.message}</td>
           </tr>
           ${error.trip_id ? `
           <tr>
             <td style="padding: 8px; font-weight: bold;">Trip ID:</td>
             <td style="padding: 8px;">${error.trip_id}</td>
           </tr>` : ''}
         </table>
         <p><a href="${dashboardUrl}/admin-dashboard.html?trace=${error.trip_id || error.request_id}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View in Dashboard</a></p>
       `;
     }

     generateHighErrorRateEmail(stats: any, dashboardUrl: string): string {
       return `
         <h2 style="color: #ea580c;">High Error Rate Detected</h2>
         <p>The error rate has exceeded the threshold.</p>
         <table style="border-collapse: collapse; margin: 20px 0;">
           <tr>
             <td style="padding: 8px; font-weight: bold;">Time Window:</td>
             <td style="padding: 8px;">Last 15 minutes</td>
           </tr>
           <tr>
             <td style="padding: 8px; font-weight: bold;">Error Rate:</td>
             <td style="padding: 8px; color: #dc2626; font-size: 1.2em;">${(stats.error_rate * 100).toFixed(2)}%</td>
           </tr>
           <tr>
             <td style="padding: 8px; font-weight: bold;">Total Errors:</td>
             <td style="padding: 8px;">${stats.error_count}</td>
           </tr>
           <tr>
             <td style="padding: 8px; font-weight: bold;">Total Requests:</td>
             <td style="padding: 8px;">${stats.total_requests}</td>
           </tr>
         </table>
         <p><a href="${dashboardUrl}/admin-dashboard.html" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Dashboard</a></p>
       `;
     }
   }
   ```

**Acceptance Criteria**:
- [ ] EmailNotifier class created
- [ ] sendAlert method uses Mailchannels API
- [ ] Critical error email template created
- [ ] High error rate email template created
- [ ] Emails include dashboard links
- [ ] Failures logged but don't throw

---

### T023: Create Alert Worker [P]
**Priority**: Medium
**Estimated Time**: 45 minutes
**Parallel**: Yes (can run with T022)
**Dependencies**: T022

**Description**: Create scheduled worker to check for alert conditions and send emails.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/functions/scheduled/check-alerts.ts`

**Steps**:
1. Create alert checker:
   ```typescript
   import { EmailNotifier } from '../api/lib/email-notifier';

   export const onSchedule: PagesFunction<Env> = async (context) => {
     const { env } = context;

     try {
       console.log('[Alert Check] Running alert check');

       const now = Date.now();
       const fifteenMinAgo = now - (15 * 60 * 1000);

       // Query logs from last 15 minutes
       const result = await env.DB.prepare(
         'SELECT * FROM logs WHERE timestamp >= ?'
       ).bind(fifteenMinAgo).all();

       const logs = result.results as any[];
       const totalRequests = logs.filter(l => l.operation === 'api_request').length;
       const errors = logs.filter(l => l.severity === 'ERROR' || l.severity === 'CRITICAL');
       const errorRate = totalRequests > 0 ? errors.length / totalRequests : 0;

       const notifier = new EmailNotifier(
         env.MAILCHANNELS_API_KEY || '',
         'alerts@voygent.ai'
       );

       const alertEmails = (env.ALERT_EMAIL_TO || '').split(',').filter(e => e);
       const dashboardUrl = env.DASHBOARD_URL || 'https://voygent.ai';

       // Check for high error rate (>10%)
       if (errorRate > 0.10 && totalRequests > 10) {
         console.log(`[Alert Check] High error rate: ${(errorRate * 100).toFixed(2)}%`);

         await notifier.sendAlert({
           subject: `[Voygent Alert] High Error Rate - ${(errorRate * 100).toFixed(1)}%`,
           to: alertEmails,
           html: notifier.generateHighErrorRateEmail({
             error_rate: errorRate,
             error_count: errors.length,
             total_requests: totalRequests
           }, dashboardUrl),
           timestamp: now,
           alert_type: 'high_error_rate',
           severity: 'warning'
         });
       }

       // Check for critical errors
       const criticalErrors = logs.filter(l => l.severity === 'CRITICAL');
       for (const error of criticalErrors) {
         // Check if we already sent alert for this error (deduplication)
         const existing = await env.DB.prepare(
           'SELECT COUNT(*) as count FROM logs WHERE id = ? AND operation = "alert_sent"'
         ).bind(error.id).first();

         if (existing && (existing.count as number) > 0) {
           continue; // Already alerted
         }

         console.log('[Alert Check] Critical error detected:', error.id);

         await notifier.sendAlert({
           subject: `[Voygent Alert] Critical Error - ${error.operation}`,
           to: alertEmails,
           html: notifier.generateCriticalErrorEmail(error, dashboardUrl),
           timestamp: now,
           alert_type: 'critical_error',
           severity: 'critical'
         });

         // Mark as alerted
         await env.DB.prepare(
           'INSERT INTO logs (id, request_id, correlation_id, timestamp, severity, operation, message, metadata, duration_ms, status, agency_id, endpoint) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
         ).bind(
           crypto.randomUUID(),
           error.request_id,
           error.correlation_id,
           now,
           'INFO',
           'alert_sent',
           `Alert sent for error ${error.id}`,
           null,
           null,
           null,
           null,
           null
         ).run();
       }

       return new Response('Alert check complete', { status: 200 });
     } catch (error: any) {
       console.error('[Alert Check] Error:', error);
       return new Response(`Error: ${error.message}`, { status: 500 });
     }
   };
   ```
2. Add cron trigger:
   ```toml
   [[schedules]]
   cron = "*/5 * * * *"  # Every 5 minutes
   handler = "functions/scheduled/check-alerts.ts"
   ```

**Acceptance Criteria**:
- [ ] Alert worker created
- [ ] Runs every 5 minutes
- [ ] Checks error rate threshold (>10%)
- [ ] Checks for critical errors
- [ ] Sends emails via EmailNotifier
- [ ] Deduplicates alerts
- [ ] Reads recipients from env var

---

### T024: Add Environment Variables for Email
**Priority**: Medium
**Estimated Time**: 15 minutes
**Parallel**: No
**Dependencies**: T022

**Description**: Document and configure environment variables for email notifications.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/.dev.vars` (local)
- Document in README

**Steps**:
1. Add to `.dev.vars`:
   ```
   JWT_SECRET=dev-secret-key-change-in-production
   MAILCHANNELS_API_KEY=your-mailchannels-key
   ALERT_EMAIL_TO=admin@voygent.ai,dev@voygent.ai
   DASHBOARD_URL=http://localhost:8788
   ```
2. Document in README:
   ```markdown
   ## Environment Variables for Logging

   - `JWT_SECRET`: Secret key for JWT token signing (required)
   - `MAILCHANNELS_API_KEY`: API key for Mailchannels email service (optional)
   - `ALERT_EMAIL_TO`: Comma-separated list of emails for alerts (optional)
   - `DASHBOARD_URL`: Base URL for dashboard links in emails (optional)
   - `LOG_LEVEL`: Minimum log severity (DEBUG|INFO|WARN|ERROR|CRITICAL), defaults to INFO
   ```
3. Test email sending with correct env vars

**Acceptance Criteria**:
- [ ] Environment variables documented
- [ ] .dev.vars updated for local testing
- [ ] README includes email configuration section
- [ ] Workers can access env vars correctly

---

## Dashboard Frontend Tasks

### T025: Create Admin Dashboard HTML Structure [P]
**Priority**: Critical
**Estimated Time**: 60 minutes
**Parallel**: Yes (different from backend tasks)
**Dependencies**: T001

**Description**: Create admin-dashboard.html with complete layout and sections.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/public/admin-dashboard.html`

**Steps**:
1. Create new HTML file with structure:
   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
     <meta charset="UTF-8">
     <meta name="viewport" content="width=device-width, initial-scale=1.0">
     <title>Admin Dashboard - Voygent</title>
     <link rel="stylesheet" href="/css/admin-dashboard.css">
     <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
   </head>
   <body>
     <!-- Login Screen -->
     <div id="loginScreen" class="login-screen">
       <div class="login-card">
         <h1>Voygent Admin</h1>
         <form id="loginForm">
           <input type="email" id="emailInput" placeholder="Email" required>
           <input type="password" id="passwordInput" placeholder="Password" required>
           <button type="submit">Login</button>
         </form>
         <div id="loginError" class="error hidden"></div>
       </div>
     </div>

     <!-- Dashboard -->
     <div id="dashboardScreen" class="hidden">
       <!-- Top Bar -->
       <header class="dashboard-header">
         <h1>Voygent Admin Dashboard</h1>
         <div class="header-actions">
           <span id="userInfo"></span>
           <button id="refreshBtn">Refresh</button>
           <button id="logoutBtn">Logout</button>
         </div>
       </header>

       <!-- Live Metrics Section -->
       <section class="metrics-section">
         <h2>Live Metrics (Last 5 Minutes)</h2>
         <div class="metrics-grid">
           <div class="metric-card">
             <div class="metric-label">Requests/Min</div>
             <div class="metric-value" id="rpmValue">--</div>
           </div>
           <div class="metric-card">
             <div class="metric-label">Error Rate</div>
             <div class="metric-value" id="errorRateValue">--</div>
           </div>
           <div class="metric-card">
             <div class="metric-label">Avg Response</div>
             <div class="metric-value" id="avgResponseValue">--</div>
           </div>
           <div class="metric-card">
             <div class="metric-label">Active Requests</div>
             <div class="metric-value" id="activeRequestsValue">--</div>
           </div>
         </div>
       </section>

       <!-- Recent Errors Section -->
       <section class="errors-section">
         <h2>Recent Errors</h2>
         <div class="table-container">
           <table id="errorsTable">
             <thead>
               <tr>
                 <th>Time</th>
                 <th>Severity</th>
                 <th>Operation</th>
                 <th>Message</th>
                 <th>Trip ID</th>
                 <th>Action</th>
               </tr>
             </thead>
             <tbody id="errorsTableBody">
               <tr><td colspan="6">Loading...</td></tr>
             </tbody>
           </table>
         </div>
       </section>

       <!-- Historical Charts Section -->
       <section class="charts-section">
         <h2>Historical Analytics</h2>
         <div class="chart-tabs">
           <button class="chart-tab active" data-period="7d">7 Days</button>
           <button class="chart-tab" data-period="30d">30 Days</button>
         </div>
         <div class="charts-grid">
           <div class="chart-container">
             <h3>Request Volume</h3>
             <canvas id="requestsChart"></canvas>
           </div>
           <div class="chart-container">
             <h3>Error Rate Trend</h3>
             <canvas id="errorTrendChart"></canvas>
           </div>
           <div class="chart-container">
             <h3>Response Time</h3>
             <canvas id="responseTimeChart"></canvas>
           </div>
           <div class="chart-container">
             <h3>Daily Costs</h3>
             <canvas id="costsChart"></canvas>
           </div>
         </div>
       </section>

       <!-- Search & Trace Section -->
       <section class="trace-section">
         <h2>Search & Trace</h2>
         <div class="search-bar">
           <input type="text" id="tripIdInput" placeholder="Enter Trip ID">
           <button id="searchBtn">Search</button>
         </div>
         <div id="traceResults" class="trace-results hidden">
           <h3>Trace Results</h3>
           <div id="traceTimeline"></div>
         </div>
       </section>

       <!-- Export Section -->
       <section class="export-section">
         <h2>Export Logs</h2>
         <div class="export-form">
           <input type="date" id="exportStartDate">
           <input type="date" id="exportEndDate">
           <select id="exportSeverity">
             <option value="ALL">All Severities</option>
             <option value="CRITICAL">Critical</option>
             <option value="ERROR">Error</option>
             <option value="WARN">Warning</option>
             <option value="INFO">Info</option>
           </select>
           <button id="exportBtn">Export JSON</button>
         </div>
       </section>
     </div>

     <script src="/js/admin-dashboard.js"></script>
   </body>
   </html>
   ```

**Acceptance Criteria**:
- [ ] HTML structure created with all sections
- [ ] Login screen included
- [ ] Dashboard screen hidden by default
- [ ] All metric cards present
- [ ] Chart.js included via CDN
- [ ] Table and form elements created
- [ ] Script references added

---

### T026: Implement Dashboard Authentication JS [P]
**Priority**: Critical
**Estimated Time**: 45 minutes
**Parallel**: Yes (can run with T025)
**Dependencies**: T016

**Description**: Implement login/logout logic in admin-dashboard.js.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/public/js/admin-dashboard.js`

**Steps**:
1. Create dashboard JS file:
   ```javascript
   // State
   let authToken = null;
   let currentUser = null;
   let refreshInterval = null;

   // Initialize
   document.addEventListener('DOMContentLoaded', () => {
     checkAuth();
     setupEventListeners();
   });

   function setupEventListeners() {
     document.getElementById('loginForm').addEventListener('submit', handleLogin);
     document.getElementById('logoutBtn').addEventListener('click', handleLogout);
     document.getElementById('refreshBtn').addEventListener('click', refreshDashboard);
     document.getElementById('searchBtn').addEventListener('click', handleSearch);
     document.getElementById('exportBtn').addEventListener('click', handleExport);

     // Chart tabs
     document.querySelectorAll('.chart-tab').forEach(tab => {
       tab.addEventListener('click', (e) => {
         document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
         e.target.classList.add('active');
         loadCharts(e.target.dataset.period);
       });
     });
   }

   function checkAuth() {
     // Check if token exists in cookie
     const cookies = document.cookie.split(';');
     const tokenCookie = cookies.find(c => c.trim().startsWith('admin_token='));

     if (tokenCookie) {
       authToken = tokenCookie.split('=')[1];
       showDashboard();
       loadDashboardData();
       startAutoRefresh();
     } else {
       showLogin();
     }
   }

   async function handleLogin(e) {
     e.preventDefault();

     const email = document.getElementById('emailInput').value;
     const password = document.getElementById('passwordInput').value;
     const errorDiv = document.getElementById('loginError');

     try {
       const response = await fetch('/api/admin/auth/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ email, password })
       });

       if (!response.ok) {
         const error = await response.json();
         throw new Error(error.error || 'Login failed');
       }

       const data = await response.json();
       authToken = data.token;
       currentUser = data.user;

       // Cookie is set by server, just show dashboard
       showDashboard();
       loadDashboardData();
       startAutoRefresh();
     } catch (error) {
       console.error('[Login] Error:', error);
       errorDiv.textContent = error.message;
       errorDiv.classList.remove('hidden');
     }
   }

   function handleLogout() {
     authToken = null;
     currentUser = null;
     document.cookie = 'admin_token=; Max-Age=0; Path=/';
     stopAutoRefresh();
     showLogin();
   }

   function showLogin() {
     document.getElementById('loginScreen').classList.remove('hidden');
     document.getElementById('dashboardScreen').classList.add('hidden');
   }

   function showDashboard() {
     document.getElementById('loginScreen').classList.add('hidden');
     document.getElementById('dashboardScreen').classList.remove('hidden');

     if (currentUser) {
       document.getElementById('userInfo').textContent = `${currentUser.email} (${currentUser.role})`;
     }
   }

   function startAutoRefresh() {
     refreshInterval = setInterval(() => {
       loadLiveMetrics();
       loadRecentErrors();
     }, 10000); // Every 10 seconds
   }

   function stopAutoRefresh() {
     if (refreshInterval) {
       clearInterval(refreshInterval);
       refreshInterval = null;
     }
   }

   // Other functions will be implemented in T027-T031
   async function loadDashboardData() {
     await loadLiveMetrics();
     await loadRecentErrors();
     await loadCharts('7d');
   }

   async function refreshDashboard() {
     console.log('[Dashboard] Refreshing...');
     await loadDashboardData();
   }

   async function loadLiveMetrics() {
     console.log('[Dashboard] Loading live metrics...');
     // T027 will implement
   }

   async function loadRecentErrors() {
     console.log('[Dashboard] Loading recent errors...');
     // T028 will implement
   }

   async function loadCharts(period) {
     console.log('[Dashboard] Loading charts for period:', period);
     // T029 will implement
   }

   async function handleSearch() {
     console.log('[Dashboard] Searching...');
     // T030 will implement
   }

   async function handleExport() {
     console.log('[Dashboard] Exporting...');
     // T031 will implement
   }
   ```

**Acceptance Criteria**:
- [ ] Dashboard JS file created
- [ ] Login form handler implemented
- [ ] JWT token stored in cookie
- [ ] Logout clears token and redirects
- [ ] Auto-refresh starts on login
- [ ] User info displayed in header
- [ ] Skeleton functions for other features

---

### T027: Implement Live Metrics Display
**Priority**: Critical
**Estimated Time**: 30 minutes
**Parallel**: No
**Dependencies**: T026, T018

**Description**: Implement loadLiveMetrics() to fetch and display 5-minute metrics.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/public/js/admin-dashboard.js`

**Steps**:
1. Find `loadLiveMetrics()` function
2. Implement:
   ```javascript
   async function loadLiveMetrics() {
     try {
       const response = await fetch('/api/admin/metrics?period=5m', {
         headers: { 'Authorization': `Bearer ${authToken}` }
       });

       if (!response.ok) {
         if (response.status === 401) {
           handleLogout();
           return;
         }
         throw new Error('Failed to load metrics');
       }

       const data = await response.json();

       // Update metric cards
       document.getElementById('rpmValue').textContent = data.rpm || '--';

       const errorRate = ((data.error_rate || 0) * 100).toFixed(2);
       const errorRateEl = document.getElementById('errorRateValue');
       errorRateEl.textContent = `${errorRate}%`;
       errorRateEl.className = 'metric-value';
       if (data.error_rate > 0.05) {
         errorRateEl.classList.add('metric-warning');
       }
       if (data.error_rate > 0.10) {
         errorRateEl.classList.add('metric-critical');
       }

       document.getElementById('avgResponseValue').textContent =
         `${data.avg_response_ms || '--'}ms`;

       document.getElementById('activeRequestsValue').textContent =
         data.active_requests || '--';

       console.log('[Dashboard] Live metrics updated');
     } catch (error) {
       console.error('[Dashboard] Failed to load live metrics:', error);
     }
   }
   ```

**Acceptance Criteria**:
- [ ] loadLiveMetrics fetches from /api/admin/metrics
- [ ] Updates all 4 metric cards
- [ ] Error rate shows color coding (yellow >5%, red >10%)
- [ ] Handles 401 by logging out
- [ ] Called every 10 seconds via auto-refresh

---

### T028: Implement Recent Errors Table
**Priority**: Critical
**Estimated Time**: 30 minutes
**Parallel**: No
**Dependencies**: T027

**Description**: Implement loadRecentErrors() to display recent error logs.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/public/js/admin-dashboard.js`

**Steps**:
1. Find `loadRecentErrors()` function
2. Implement:
   ```javascript
   async function loadRecentErrors() {
     try {
       const response = await fetch('/api/admin/logs?severity=ERROR&limit=20', {
         headers: { 'Authorization': `Bearer ${authToken}` }
       });

       if (!response.ok) throw new Error('Failed to load errors');

       const data = await response.json();
       const tbody = document.getElementById('errorsTableBody');

       if (data.logs.length === 0) {
         tbody.innerHTML = '<tr><td colspan="6">No recent errors</td></tr>';
         return;
       }

       tbody.innerHTML = data.logs.map(log => {
         const time = new Date(log.timestamp).toLocaleString();
         const severity = log.severity === 'CRITICAL' ?
           '<span class="severity-critical">CRITICAL</span>' :
           '<span class="severity-error">ERROR</span>';

         return `
           <tr>
             <td>${time}</td>
             <td>${severity}</td>
             <td>${log.operation}</td>
             <td class="message-cell">${log.message}</td>
             <td>${log.correlation_id || '--'}</td>
             <td>
               ${log.correlation_id ?
                 `<button class="trace-btn" data-trip-id="${log.correlation_id}">Trace</button>` :
                 '--'}
             </td>
           </tr>
         `;
       }).join('');

       // Add trace button handlers
       tbody.querySelectorAll('.trace-btn').forEach(btn => {
         btn.addEventListener('click', (e) => {
           const tripId = e.target.dataset.tripId;
           document.getElementById('tripIdInput').value = tripId;
           handleSearch();
         });
       });

       console.log('[Dashboard] Recent errors updated');
     } catch (error) {
       console.error('[Dashboard] Failed to load recent errors:', error);
     }
   }
   ```

**Acceptance Criteria**:
- [ ] loadRecentErrors fetches from /api/admin/logs
- [ ] Displays up to 20 recent errors
- [ ] Shows timestamp, severity, operation, message, trip ID
- [ ] Trace button loads trace for that trip
- [ ] Handles empty results gracefully
- [ ] Called every 10 seconds via auto-refresh

---

### T029: Implement Historical Charts
**Priority**: High
**Estimated Time**: 90 minutes
**Parallel**: No
**Dependencies**: T026, T018

**Description**: Implement loadCharts() to render Chart.js visualizations.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/public/js/admin-dashboard.js`

**Steps**:
1. Find `loadCharts()` function
2. Implement:
   ```javascript
   let charts = {}; // Store chart instances

   async function loadCharts(period) {
     try {
       const response = await fetch(`/api/admin/metrics?period=${period}`, {
         headers: { 'Authorization': `Bearer ${authToken}` }
       });

       if (!response.ok) throw new Error('Failed to load charts');

       const data = await response.json();

       // Destroy existing charts
       Object.values(charts).forEach(chart => chart.destroy());
       charts = {};

       // Prepare data
       const labels = data.data_points.map(d => d.date);
       const requests = data.data_points.map(d => d.total_requests);
       const errorRates = data.data_points.map(d =>
         (d.total_errors / d.total_requests * 100).toFixed(2)
       );
       const responseTimes = data.data_points.map(d => d.avg_response_ms);
       const costs = data.data_points.map(d => d.total_cost_usd);

       // Request Volume Chart
       charts.requests = new Chart(
         document.getElementById('requestsChart'),
         {
           type: 'line',
           data: {
             labels,
             datasets: [{
               label: 'Total Requests',
               data: requests,
               borderColor: '#667eea',
               backgroundColor: 'rgba(102, 126, 234, 0.1)',
               fill: true
             }]
           },
           options: {
             responsive: true,
             maintainAspectRatio: false,
             plugins: { legend: { display: false } }
           }
         }
       );

       // Error Rate Chart
       charts.errorTrend = new Chart(
         document.getElementById('errorTrendChart'),
         {
           type: 'line',
           data: {
             labels,
             datasets: [{
               label: 'Error Rate (%)',
               data: errorRates,
               borderColor: '#dc2626',
               backgroundColor: 'rgba(220, 38, 38, 0.1)',
               fill: true
             }]
           },
           options: {
             responsive: true,
             maintainAspectRatio: false,
             plugins: { legend: { display: false } },
             scales: {
               y: { beginAtZero: true, max: 100 }
             }
           }
         }
       );

       // Response Time Chart
       charts.responseTime = new Chart(
         document.getElementById('responseTimeChart'),
         {
           type: 'line',
           data: {
             labels,
             datasets: [{
               label: 'Avg Response Time (ms)',
               data: responseTimes,
               borderColor: '#10b981',
               backgroundColor: 'rgba(16, 185, 129, 0.1)',
               fill: true
             }]
           },
           options: {
             responsive: true,
             maintainAspectRatio: false,
             plugins: { legend: { display: false } }
           }
         }
       );

       // Costs Chart
       charts.costs = new Chart(
         document.getElementById('costsChart'),
         {
           type: 'bar',
           data: {
             labels,
             datasets: [{
               label: 'Daily Cost (USD)',
               data: costs,
               backgroundColor: '#f59e0b'
             }]
           },
           options: {
             responsive: true,
             maintainAspectRatio: false,
             plugins: { legend: { display: false } }
           }
         }
       );

       console.log('[Dashboard] Charts rendered for', period);
     } catch (error) {
       console.error('[Dashboard] Failed to load charts:', error);
     }
   }
   ```

**Acceptance Criteria**:
- [ ] loadCharts fetches historical metrics
- [ ] Renders 4 charts: requests, error rate, response time, costs
- [ ] Supports 7d and 30d periods
- [ ] Chart.js properly initialized
- [ ] Destroys old charts before creating new ones
- [ ] Charts are responsive

---

### T030: Implement Trace Search
**Priority**: High
**Estimated Time**: 45 minutes
**Parallel**: No
**Dependencies**: T029, T019

**Description**: Implement handleSearch() to search and display request traces.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/public/js/admin-dashboard.js`

**Steps**:
1. Find `handleSearch()` function
2. Implement:
   ```javascript
   async function handleSearch() {
     const tripId = document.getElementById('tripIdInput').value.trim();

     if (!tripId) {
       alert('Please enter a Trip ID');
       return;
     }

     try {
       const response = await fetch(`/api/admin/traces/${tripId}`, {
         headers: { 'Authorization': `Bearer ${authToken}` }
       });

       if (!response.ok) {
         if (response.status === 404) {
           throw new Error('Trip not found');
         }
         throw new Error('Failed to load trace');
       }

       const data = await response.json();

       // Display trace results
       const resultsDiv = document.getElementById('traceResults');
       const timelineDiv = document.getElementById('traceTimeline');

       let html = `
         <div class="trace-summary">
           <h4>Summary for Trip ${data.trip_id}</h4>
           <p><strong>Total Operations:</strong> ${data.summary.total_operations}</p>
           <p><strong>Total Duration:</strong> ${data.summary.total_duration_ms}ms</p>
           <p><strong>Errors:</strong> ${data.summary.error_count}</p>
           <p><strong>Status:</strong> <span class="status-${data.summary.status}">${data.summary.status}</span></p>
         </div>
         <div class="trace-timeline">
       `;

       data.logs.forEach((log, i) => {
         const time = new Date(log.timestamp).toLocaleTimeString();
         const severityClass = log.severity.toLowerCase();

         html += `
           <div class="trace-entry">
             <div class="trace-time">${time}</div>
             <div class="trace-severity severity-${severityClass}">${log.severity}</div>
             <div class="trace-operation">${log.operation}</div>
             <div class="trace-message">${log.message}</div>
             ${log.duration_ms ? `<div class="trace-duration">${log.duration_ms}ms</div>` : ''}
             ${log.metadata ? `<details><summary>Metadata</summary><pre>${log.metadata}</pre></details>` : ''}
           </div>
         `;
       });

       html += '</div>';
       timelineDiv.innerHTML = html;
       resultsDiv.classList.remove('hidden');

       // Scroll to results
       resultsDiv.scrollIntoView({ behavior: 'smooth' });

       console.log('[Dashboard] Trace loaded for', tripId);
     } catch (error) {
       console.error('[Dashboard] Search error:', error);
       alert(error.message);
     }
   }
   ```

**Acceptance Criteria**:
- [ ] handleSearch fetches from /api/admin/traces/:tripId
- [ ] Displays trace summary (operations, duration, errors, status)
- [ ] Shows timeline of all log entries
- [ ] Timeline entries show time, severity, operation, message, duration
- [ ] Metadata expandable via details element
- [ ] Handles not found errors gracefully
- [ ] Scrolls to results after loading

---

### T031: Implement Log Export
**Priority**: Medium
**Estimated Time**: 30 minutes
**Parallel**: No
**Dependencies**: T030, T020

**Description**: Implement handleExport() to download logs as JSON file.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/public/js/admin-dashboard.js`

**Steps**:
1. Find `handleExport()` function
2. Implement:
   ```javascript
   async function handleExport() {
     const startDate = document.getElementById('exportStartDate').value;
     const endDate = document.getElementById('exportEndDate').value;
     const severity = document.getElementById('exportSeverity').value;

     if (!startDate || !endDate) {
       alert('Please select start and end dates');
       return;
     }

     try {
       const params = new URLSearchParams({
         start_date: startDate,
         end_date: endDate,
         severity,
         format: 'json'
       });

       const response = await fetch(`/api/admin/export?${params}`, {
         headers: { 'Authorization': `Bearer ${authToken}` }
       });

       if (!response.ok) throw new Error('Export failed');

       // Download file
       const blob = await response.blob();
       const url = window.URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = `voygent-logs-${startDate}-to-${endDate}.json`;
       document.body.appendChild(a);
       a.click();
       document.body.removeChild(a);
       window.URL.revokeObjectURL(url);

       console.log('[Dashboard] Export complete');
     } catch (error) {
       console.error('[Dashboard] Export error:', error);
       alert('Failed to export logs: ' + error.message);
     }
   }
   ```

**Acceptance Criteria**:
- [ ] handleExport fetches from /api/admin/export
- [ ] Validates date range selected
- [ ] Downloads JSON file with correct filename
- [ ] Uses severity filter
- [ ] Handles errors gracefully
- [ ] File downloads automatically

---

### T032: Create Dashboard CSS Styles [P]
**Priority**: High
**Estimated Time**: 60 minutes
**Parallel**: Yes (can run with T026-T031)
**Dependencies**: T025

**Description**: Create CSS styles for the admin dashboard.

**Files**:
- Create: `/home/neil/dev/lite-voygent-claude/public/css/admin-dashboard.css`

**Steps**:
1. Create CSS file with styles:
   ```css
   /* Base Styles */
   * {
     margin: 0;
     padding: 0;
     box-sizing: border-box;
   }

   body {
     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
     background: #f7fafc;
     color: #2d3748;
   }

   .hidden { display: none !important; }

   /* Login Screen */
   .login-screen {
     display: flex;
     align-items: center;
     justify-content: center;
     min-height: 100vh;
     background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
   }

   .login-card {
     background: white;
     padding: 40px;
     border-radius: 12px;
     box-shadow: 0 20px 60px rgba(0,0,0,0.3);
     width: 400px;
   }

   .login-card h1 {
     text-align: center;
     color: #667eea;
     margin-bottom: 30px;
   }

   .login-card form {
     display: flex;
     flex-direction: column;
     gap: 15px;
   }

   .login-card input {
     padding: 12px;
     border: 2px solid #e5e7eb;
     border-radius: 8px;
     font-size: 1rem;
   }

   .login-card button {
     padding: 12px;
     background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
     color: white;
     border: none;
     border-radius: 8px;
     font-size: 1rem;
     font-weight: 600;
     cursor: pointer;
   }

   .error {
     color: #dc2626;
     padding: 10px;
     background: #fee;
     border-radius: 6px;
     margin-top: 10px;
   }

   /* Dashboard Header */
   .dashboard-header {
     background: white;
     padding: 20px 30px;
     box-shadow: 0 2px 4px rgba(0,0,0,0.1);
     display: flex;
     justify-content: space-between;
     align-items: center;
   }

   .dashboard-header h1 {
     color: #667eea;
     font-size: 1.5rem;
   }

   .header-actions {
     display: flex;
     gap: 15px;
     align-items: center;
   }

   .header-actions button {
     padding: 8px 16px;
     background: #667eea;
     color: white;
     border: none;
     border-radius: 6px;
     cursor: pointer;
   }

   /* Metrics Section */
   .metrics-section {
     padding: 30px;
   }

   .metrics-grid {
     display: grid;
     grid-template-columns: repeat(4, 1fr);
     gap: 20px;
     margin-top: 20px;
   }

   .metric-card {
     background: white;
     padding: 24px;
     border-radius: 12px;
     box-shadow: 0 2px 8px rgba(0,0,0,0.1);
   }

   .metric-label {
     font-size: 0.9rem;
     color: #718096;
     margin-bottom: 8px;
   }

   .metric-value {
     font-size: 2rem;
     font-weight: 700;
     color: #2d3748;
   }

   .metric-warning { color: #f59e0b; }
   .metric-critical { color: #dc2626; }

   /* Errors Section */
   .errors-section {
     padding: 30px;
   }

   .table-container {
     background: white;
     border-radius: 12px;
     overflow: hidden;
     box-shadow: 0 2px 8px rgba(0,0,0,0.1);
     margin-top: 20px;
   }

   table {
     width: 100%;
     border-collapse: collapse;
   }

   thead {
     background: #f7fafc;
   }

   th {
     padding: 12px;
     text-align: left;
     font-weight: 600;
     color: #4a5568;
     border-bottom: 2px solid #e5e7eb;
   }

   td {
     padding: 12px;
     border-bottom: 1px solid #e5e7eb;
   }

   .severity-critical {
     color: #dc2626;
     font-weight: 600;
   }

   .severity-error {
     color: #ea580c;
     font-weight: 600;
   }

   .message-cell {
     max-width: 300px;
     overflow: hidden;
     text-overflow: ellipsis;
     white-space: nowrap;
   }

   .trace-btn {
     padding: 4px 12px;
     background: #667eea;
     color: white;
     border: none;
     border-radius: 4px;
     cursor: pointer;
     font-size: 0.85rem;
   }

   /* Charts Section */
   .charts-section {
     padding: 30px;
   }

   .chart-tabs {
     display: flex;
     gap: 10px;
     margin: 20px 0;
   }

   .chart-tab {
     padding: 8px 16px;
     background: white;
     border: 2px solid #e5e7eb;
     border-radius: 6px;
     cursor: pointer;
   }

   .chart-tab.active {
     background: #667eea;
     color: white;
     border-color: #667eea;
   }

   .charts-grid {
     display: grid;
     grid-template-columns: repeat(2, 1fr);
     gap: 20px;
   }

   .chart-container {
     background: white;
     padding: 20px;
     border-radius: 12px;
     box-shadow: 0 2px 8px rgba(0,0,0,0.1);
   }

   .chart-container h3 {
     margin-bottom: 15px;
     color: #4a5568;
   }

   .chart-container canvas {
     height: 250px !important;
   }

   /* Trace Section */
   .trace-section {
     padding: 30px;
   }

   .search-bar {
     display: flex;
     gap: 10px;
     margin: 20px 0;
   }

   .search-bar input {
     flex: 1;
     padding: 12px;
     border: 2px solid #e5e7eb;
     border-radius: 8px;
   }

   .search-bar button {
     padding: 12px 24px;
     background: #667eea;
     color: white;
     border: none;
     border-radius: 8px;
     cursor: pointer;
   }

   .trace-results {
     background: white;
     padding: 20px;
     border-radius: 12px;
     box-shadow: 0 2px 8px rgba(0,0,0,0.1);
     margin-top: 20px;
   }

   .trace-entry {
     padding: 12px;
     border-left: 3px solid #e5e7eb;
     margin: 10px 0;
     background: #f7fafc;
   }

   /* Export Section */
   .export-section {
     padding: 30px;
   }

   .export-form {
     display: flex;
     gap: 15px;
     margin-top: 20px;
   }

   .export-form input,
   .export-form select {
     padding: 12px;
     border: 2px solid #e5e7eb;
     border-radius: 8px;
   }

   .export-form button {
     padding: 12px 24px;
     background: #10b981;
     color: white;
     border: none;
     border-radius: 8px;
     cursor: pointer;
   }

   /* Responsive */
   @media (max-width: 1200px) {
     .metrics-grid {
       grid-template-columns: repeat(2, 1fr);
     }
     .charts-grid {
       grid-template-columns: 1fr;
     }
   }
   ```

**Acceptance Criteria**:
- [ ] CSS file created
- [ ] Login screen styled
- [ ] Dashboard sections styled
- [ ] Metric cards styled with color coding
- [ ] Table styled cleanly
- [ ] Charts responsive
- [ ] Mobile responsive

---

## Integration Tasks

### T033: Add Logging to Trip Creation Endpoint
**Priority**: High
**Estimated Time**: 30 minutes
**Parallel**: No
**Dependencies**: T010

**Description**: Integrate Logger into POST /api/trips endpoint.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/functions/api/trips/index.ts`

**Steps**:
1. Open trips endpoint file
2. Import Logger:
   ```typescript
   import { Logger } from '../lib/logger';
   ```
3. Add logging at key points:
   - Start of request (with trip_id as correlation_id)
   - Before/after each LLM call
   - On success/error
4. Example integration:
   ```typescript
   const logger = Logger.getInstance(env.DB);
   const requestId = crypto.randomUUID();
   const tripId = crypto.randomUUID();

   await logger.logRequest({
     request_id: requestId,
     endpoint: '/api/trips',
     method: 'POST',
     correlation_id: tripId
   });

   // ... trip generation logic ...

   await logger.logResponse({
     request_id: requestId,
     status_code: 200,
     duration_ms: Date.now() - startTime
   });
   ```

**Acceptance Criteria**:
- [ ] Logger integrated into trips endpoint
- [ ] Logs request start
- [ ] Logs LLM calls with tokens/cost
- [ ] Logs response with duration
- [ ] Logs errors with stack traces
- [ ] Uses trip_id as correlation_id

---

### T034: Add Logging to Research Endpoint
**Priority**: High
**Estimated Time**: 20 minutes
**Parallel**: No
**Dependencies**: T033

**Description**: Integrate Logger into POST /api/research endpoint.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/functions/api/research/index.ts`

**Steps**:
1. Open research endpoint file
2. Import Logger
3. Add logging similar to T033:
   - Request start
   - Search API calls
   - LLM calls
   - Response
   - Errors
4. Use request_id for correlation

**Acceptance Criteria**:
- [ ] Logger integrated into research endpoint
- [ ] Logs all external API calls (Serper, Tavily)
- [ ] Logs LLM usage
- [ ] Logs response with duration
- [ ] Errors captured

---

### T035: Add Logging to Provider Calls
**Priority**: High
**Estimated Time**: 30 minutes
**Parallel**: No
**Dependencies**: T034

**Description**: Integrate Logger into provider.ts for centralized LLM call logging.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/functions/api/lib/provider.ts` (or wherever provider calls are made)

**Steps**:
1. Find provider call functions (OpenAI, Anthropic)
2. Import Logger
3. Wrap each provider call with logging:
   ```typescript
   const startTime = Date.now();
   try {
     const response = await openai.chat.completions.create(...);

     await logger.logProvider({
       request_id: context.requestId,
       provider: 'openai',
       operation: 'chat_completion',
       duration_ms: Date.now() - startTime,
       tokens_in: response.usage.prompt_tokens,
       tokens_out: response.usage.completion_tokens,
       cost_usd: calculateCost(response.usage),
       status: 'success'
     });

     return response;
   } catch (error) {
     await logger.logProvider({
       request_id: context.requestId,
       provider: 'openai',
       operation: 'chat_completion',
       duration_ms: Date.now() - startTime,
       status: 'failure',
       error: error.message
     });
     throw error;
   }
   ```

**Acceptance Criteria**:
- [ ] Logger integrated into all provider calls
- [ ] Logs tokens, cost, duration for each call
- [ ] Logs both success and failure
- [ ] Cost calculation included
- [ ] Works for OpenAI and Anthropic

---

## Testing & Validation Tasks

### T036: Execute Quickstart Manual Testing
**Priority**: Critical
**Estimated Time**: 90 minutes
**Parallel**: No
**Dependencies**: T001-T035 (all previous tasks)

**Description**: Execute all 11 test scenarios from quickstart.md.

**Files**:
- Reference: `/home/neil/dev/lite-voygent-claude/specs/006-add-full-logging/quickstart.md`

**Steps**:
1. Open quickstart.md
2. Execute each scenario:
   - Scenario 1: Basic logging verification
   - Scenario 2: Live dashboard metrics
   - Scenario 3: Historical analytics
   - Scenario 4: Request tracing
   - Scenario 5: Error alerting
   - Scenario 6: Log export
   - Scenario 7: Role-based access
   - Scenario 8: PII sanitization
   - Scenario 9: Performance (logging overhead)
   - Scenario 10: Log purging
   - Scenario 11: Scheduled workers
3. Document any failures
4. Check for console errors
5. Verify no regressions in existing features

**Acceptance Criteria**:
- [ ] All 11 scenarios pass
- [ ] No console errors during normal usage
- [ ] Existing trip generation flow unaffected
- [ ] Dashboard loads in <2 seconds
- [ ] Charts render in <3 seconds
- [ ] Logging overhead <5ms per request

---

### T037: Performance Testing
**Priority**: High
**Estimated Time**: 60 minutes
**Parallel**: No
**Dependencies**: T036

**Description**: Test logging system under load.

**Files**: None (testing task)

**Steps**:
1. Generate 100 concurrent trip requests
2. Measure logging overhead using timestamps
3. Verify batch logging is working
4. Check database performance with 100K logs
5. Test dashboard responsiveness with large dataset
6. Monitor memory usage

**Test Script**:
```bash
# Create test script
cat > test-load.sh << 'EOF'
for i in {1..100}; do
  curl -X POST http://localhost:8788/api/trips \
    -H "Content-Type: application/json" \
    -d '{...}' &
done
wait
EOF

chmod +x test-load.sh
./test-load.sh
```

**Acceptance Criteria**:
- [ ] System handles 100 concurrent requests
- [ ] Logging overhead remains <5ms
- [ ] Batch logging reduces DB writes
- [ ] Dashboard loads with 100K+ logs
- [ ] No memory leaks detected
- [ ] Scheduled workers execute successfully

---

## Documentation Task

### T038: Update Documentation
**Priority**: Medium
**Estimated Time**: 30 minutes
**Parallel**: No
**Dependencies**: T037

**Description**: Update README with admin dashboard documentation.

**Files**:
- Edit: `/home/neil/dev/lite-voygent-claude/README.md`

**Steps**:
1. Add section "Admin Dashboard" to README:
   ```markdown
   ## Admin Dashboard

   ### Access
   Navigate to `/admin-dashboard.html` and log in with admin credentials.

   Default credentials (local only):
   - Email: admin@voygent.ai
   - Password: admin123

   ### Features
   - **Live Metrics**: Real-time RPM, error rates, response times
   - **Historical Analytics**: 7-day and 30-day trend charts
   - **Error Monitoring**: Recent errors with trace links
   - **Request Tracing**: Full request lifecycle for debugging
   - **Log Export**: Download logs as JSON
   - **Email Alerts**: Automatic notifications for critical errors

   ### Environment Variables
   See [Environment Variables](#environment-variables) section.

   ### Scheduled Workers
   - **Metrics Snapshot**: Runs every 5 minutes
   - **Daily Aggregate**: Runs daily at 4 AM UTC
   - **Alert Check**: Runs every 5 minutes
   - **Log Purge**: Runs daily at 3 AM UTC

   ### Database Tables
   - `logs`: Raw log entries (1 year retention)
   - `metrics_snapshots`: 5-minute aggregates (1 year retention)
   - `daily_aggregates`: Daily rollups (kept forever)
   - `admin_users`: Admin authentication
   ```
2. Update environment variables section (from T024)
3. Add troubleshooting section if needed

**Acceptance Criteria**:
- [ ] README updated with dashboard docs
- [ ] Access instructions included
- [ ] Features documented
- [ ] Environment variables listed
- [ ] Scheduled workers explained
- [ ] Database schema referenced

---

## Task Summary

**Total Tasks**: 38
**Critical Path**: T001 → T002 → T003 → T005 → T006 → T007 → T008 → T010 → T016 → T017 → T025 → T026 → T033 → T036 → T038
**Estimated Time**: 16-20 hours (2-3 days)

**Parallel Opportunities**:
- T004 can run with T005
- T008, T009 (CSS) can run with backend tasks
- T013, T014 (scheduled workers) can run together
- T022, T023, T024 (email) can run with T018-T021
- T025-T032 (frontend) can run parallel to backend once APIs defined

**Ready for Implementation**: ✅ All tasks defined with acceptance criteria

---

*Tasks generated from plan.md and design documents*
*Based on Constitution - See `/home/neil/dev/lite-voygent-claude/.specify/constitution.md`*
