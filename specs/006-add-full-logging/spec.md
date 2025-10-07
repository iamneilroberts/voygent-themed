# Feature Specification: Full Logging and Admin Dashboard

**Feature Branch**: `006-add-full-logging`
**Created**: 2025-10-07
**Status**: Draft
**Input**: User description: "add full logging and diagnostics to voygent.ai and create an admin dashboard with live and historical stats"

## Execution Flow (main)
```
1. Parse user description from Input
    If empty: ERROR "No feature description provided"
2. Extract key concepts from description
    Identify: actors, actions, data, constraints
3. For each unclear aspect:
    Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
    If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
    Each requirement must be testable
    Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
    If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
    If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## <� Quick Guidelines
- Focus on WHAT users need and WHY
- Avoid HOW to implement (no tech stack, APIs, code structure)
- Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something, mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## Clarifications

### Session 2025-10-07
- Q: Log retention policy: How long should detailed logs be retained before automatic purging? → A: 1 year (annual compliance, high storage)
- Q: PII handling in logs: How should personally identifiable information (user emails, surnames, genealogy data) be handled in logs? → A: Sanitize (mask/redact PII: email → e***@***.com)
- Q: Access control for admin dashboard: What level of access control is needed? → A: Role-based (super-admin sees all, agency-admin sees their agency)
- Q: Error alerting: Should there be alerting/notifications for critical errors or high error rates? → A: Both in-dashboard and email
- Q: Log export capability: Should logs be exportable for external analysis tools? → A: JSON export (for programmatic analysis)

### Current State Analysis
Based on codebase review, the current implementation has:
- **Logging**: Sparse console.log/console.error statements in ~41 occurrences across 10 files
- **No structured logging**: Raw console output with no correlation IDs, severity levels, or metadata
- **No request tracing**: Cannot follow a single trip request through its lifecycle
- **Token/cost tracking**: Exists in messages table (tokens_in, tokens_out, cost_usd) but only for LLM calls
- **No performance metrics**: No timing data for API endpoints, database queries, or external provider calls
- **No error aggregation**: No centralized error tracking or alerting
- **Basic admin page**: Theme builder exists (admin.html) but no operational monitoring or analytics
- **No visibility**: Cannot see current system health, usage patterns, or failure rates

### Assumptions Made
- Admin users need visibility into system health and operational metrics
- Logging must support debugging production issues without requiring database queries
- Historical data is needed for trend analysis and capacity planning
- The system serves multiple users/agencies (white-label architecture exists)
- Performance degradation needs to be detected proactively
- Cost tracking should cover all LLM provider calls, not just individual messages
- Error patterns should be identifiable for prioritizing fixes

---

## User Scenarios & Testing

### Primary User Story
A system administrator or operations team member needs to monitor the health and performance of the Voygent platform. They should be able to see real-time metrics (current requests in flight, error rates, API response times), historical trends (daily/weekly usage, cost trends), and diagnose issues when users report problems by viewing detailed request traces. Super-admins can view all agency data platform-wide, while agency-admins can only view data for their assigned agency.

### Acceptance Scenarios
1. **Given** an admin visits the dashboard, **When** the page loads, **Then** they see live metrics including: active requests, requests per minute, error rate (last 5 min), average response time
2. **Given** a trip request is being processed, **When** viewing the live activity feed, **Then** the admin sees the request appear with trip ID, user, status, and elapsed time
3. **Given** historical data exists, **When** viewing the stats dashboard, **Then** charts display: daily request volume (7/30 days), cost breakdown by provider (OpenAI vs Anthropic), error rates over time
4. **Given** an error occurs in production, **When** an admin searches for a specific trip ID, **Then** they see complete request trace including: all API calls made, external provider responses, timing for each step, error details with stack traces
5. **Given** multiple agencies use the platform (white-label), **When** filtering by agency, **Then** stats show per-agency usage, costs, and request patterns
6. **Given** performance degrades, **When** viewing the performance panel, **Then** the admin sees which endpoints/operations are slowest and can identify bottlenecks
7. **Given** cost tracking is enabled, **When** viewing the cost dashboard, **Then** the admin sees: total daily/monthly spend, per-provider breakdown, per-trip cost distribution, cost per user/agency

### Edge Cases
- When logs exceed storage capacity: Auto-purge logs older than 1 year on a rolling basis
- Logs retention: Auto-purged after 1 year; aggregate metrics retained indefinitely
- PII in logs: All personally identifiable information MUST be sanitized (emails masked as e***@***.com, surnames as S****d, genealogy data redacted)
- Access control: Role-based authentication required - super-admin role sees all agencies, agency-admin role sees only their agency data
- Error alerting: Critical errors and high error rates trigger both in-dashboard visual alerts and email notifications to admins
- Log export: JSON export format available for programmatic analysis and integration with external tools
- What happens if the logging system itself fails?
- How are high-volume time periods handled (log sampling, rate limiting)?

---

## Requirements

### Functional Requirements

#### Structured Logging System
- **FR-001**: System MUST log all incoming API requests with unique request ID, timestamp, endpoint, method, and source (user/agency)
- **FR-002**: System MUST log all API responses with request ID, status code, duration, and response size
- **FR-003**: System MUST log all errors with request ID, error type, error message, stack trace, and context (what operation was being attempted)
- **FR-004**: System MUST log all external provider calls (LLM APIs, search APIs, travel APIs) with provider name, duration, tokens used, cost, and success/failure status
- **FR-005**: System MUST assign severity levels to all logs (DEBUG, INFO, WARN, ERROR, CRITICAL)
- **FR-006**: System MUST include correlation IDs to trace a single trip request across multiple operations and API calls
- **FR-007**: System MUST capture performance timing for key operations: database queries, LLM calls, external API calls, total request time
- **FR-038**: System MUST sanitize all PII before logging: emails masked (e***@***.com), surnames masked (S****d), genealogy data redacted

#### Live Metrics Dashboard
- **FR-008**: Dashboard MUST display current active requests with trip ID, elapsed time, and current operation
- **FR-009**: Dashboard MUST show requests per minute (RPM) for the last 5 minutes
- **FR-010**: Dashboard MUST show error rate percentage for the last 5 minutes
- **FR-011**: Dashboard MUST show average API response time for the last 5 minutes
- **FR-012**: Dashboard MUST auto-refresh live metrics every 5-10 seconds without requiring page reload
- **FR-013**: Dashboard MUST show list of recent errors (last 20) with timestamp, trip ID, error type, and one-click access to full trace
- **FR-039**: Dashboard MUST require authentication and enforce role-based access control (super-admin or agency-admin)
- **FR-040**: Dashboard MUST automatically scope all data views to the logged-in agency-admin's agency (super-admins see all agencies)

#### Alerting & Notifications
- **FR-041**: System MUST display visual alerts in dashboard when error rate exceeds 5% over a 5-minute period
- **FR-042**: System MUST display visual alerts in dashboard when critical (severity=CRITICAL) errors occur
- **FR-043**: System MUST send email notifications to admin email addresses when error rate exceeds 10% over a 15-minute period
- **FR-044**: System MUST send email notifications to admin email addresses when critical errors occur
- **FR-045**: Email notifications MUST include: timestamp, error type, affected agency (if applicable), error count, link to dashboard trace

#### Historical Analytics
- **FR-014**: Dashboard MUST display daily request volume chart showing last 7 days and last 30 days
- **FR-015**: Dashboard MUST display error rate trend chart (errors per hour/day over last 7 days)
- **FR-016**: Dashboard MUST display average response time trend chart (last 7 days)
- **FR-017**: Dashboard MUST display total requests, total errors, and total cost for selectable time periods (today, this week, this month)
- **FR-018**: Dashboard MUST show top 10 most expensive trips (by LLM cost) for a given time period
- **FR-019**: Dashboard MUST show request breakdown by endpoint (which APIs are most used)
- **FR-020**: Dashboard MUST show provider usage breakdown (OpenAI vs Anthropic, percentage of calls to each)

#### Cost Tracking & Analytics
- **FR-021**: System MUST record total cost for each trip (sum of all LLM calls for that trip)
- **FR-022**: Dashboard MUST display daily cost chart showing spend over last 7/30 days
- **FR-023**: Dashboard MUST display cost breakdown by provider (OpenAI vs Anthropic) with totals and percentages
- **FR-024**: Dashboard MUST display cost breakdown by operation type (intake normalization, options generation, research synthesis, etc.)
- **FR-025**: Dashboard MUST show cost per trip statistics: average, median, p95, p99
- **FR-026**: Dashboard MUST allow filtering cost data by date range and agency (if white-label)

#### Request Tracing & Debugging
- **FR-027**: Dashboard MUST provide search functionality to find trip by ID or user ID
- **FR-028**: Dashboard MUST display complete request trace for a given trip showing: all API calls made, sequence of operations, timing for each step, input/output sizes, error details
- **FR-029**: Dashboard MUST show all external provider calls for a trip with full request/response details (prompts sent, responses received, tokens, cost)
- **FR-030**: Dashboard MUST allow viewing raw logs for a specific request ID or time range
- **FR-031**: Dashboard MUST highlight errors in red and slow operations in yellow within request traces

#### Log Export
- **FR-046**: Dashboard MUST provide JSON export functionality for logs matching current filters (date range, agency, severity)
- **FR-047**: Exported JSON MUST include all log fields: timestamp, request_id, severity, operation, message, metadata, duration, status
- **FR-048**: Export MUST respect role-based access control (agency-admins can only export their agency's logs)

#### Multi-Agency Support (White-Label)
- **FR-032**: Dashboard MUST allow filtering all metrics and charts by agency
- **FR-033**: Dashboard MUST display per-agency leaderboard showing: total requests, total cost, average cost per trip, error rate
- **FR-034**: Dashboard MUST show agency usage trends (which agencies are growing/declining in usage)

#### Performance Monitoring
- **FR-035**: Dashboard MUST identify slowest endpoints showing average response time and p95/p99 percentiles
- **FR-036**: Dashboard MUST identify slowest external providers (which APIs are bottlenecks)
- **FR-037**: Dashboard MUST show database query performance metrics (query counts, slow queries)

### Non-Functional Requirements

#### Performance
- **NFR-001**: Logging MUST NOT add more than 5ms overhead to any API request
- **NFR-002**: Dashboard MUST load initial page in under 2 seconds
- **NFR-003**: Dashboard charts MUST render historical data (30 days) in under 3 seconds
- **NFR-004**: Live metrics MUST update within 10 seconds of actual events

#### Scalability
- **NFR-005**: System MUST handle logging for up to 1000 requests per minute without data loss
- **NFR-006**: Dashboard MUST perform well with up to 1 million log entries in the database

#### Reliability
- **NFR-007**: Logging failures MUST NOT cause API requests to fail (logging must be fail-safe)
- **NFR-008**: Dashboard MUST gracefully handle missing or incomplete log data

#### Data Retention
- **NFR-009**: System MUST automatically purge detailed log entries older than 1 year
- **NFR-010**: System MUST retain aggregate metrics (daily/monthly summaries) indefinitely after raw logs are purged
- **NFR-011**: System MUST perform log purging during low-traffic periods to minimize performance impact

### Key Entities

- **Log Entry**: A single logged event with timestamp, request ID, severity level, operation type, message, metadata (JSON), duration, and status
- **Request Trace**: Complete sequence of log entries for a single trip request, linked by correlation ID
- **Metric Snapshot**: Aggregated statistics captured at a point in time (RPM, error rate, avg response time) for dashboard display
- **Cost Record**: Detailed cost information for a single LLM call including provider, model, tokens in/out, cost USD, associated trip ID
- **Performance Record**: Timing data for an operation (API endpoint, database query, external call) with percentile statistics
- **Agency Stats**: Aggregated metrics grouped by agency including total requests, total cost, error rate, active users

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain (all 5 critical clarifications resolved)
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked and resolved (5 clarifications completed)
- [x] User scenarios defined
- [x] Requirements generated (48 functional, 11 non-functional)
- [x] Entities identified
- [x] Review checklist passed

---

## Notes for Implementation Phase

**Known Dependencies:**
- D1 database with existing tables (trips, messages, agencies, trip_templates)
- Existing messages table has tokens_in, tokens_out, cost_usd columns
- Provider calls already calculate costs (cost-estimator.ts exists)
- White-label multi-agency architecture (agencies table exists)
- Admin page template exists (admin.html)

**Design Decisions Made:**
- ✅ Log retention: 1 year auto-purge for raw logs, indefinite for aggregates
- ✅ PII handling: Sanitize/mask all PII in logs (emails, surnames, genealogy data)
- ✅ Access control: Role-based (super-admin sees all, agency-admin scoped to agency)
- ✅ Alerting: Both in-dashboard visual alerts and email notifications
- ✅ Log export: JSON format for programmatic analysis

**Design Decisions Still Needed:**
- Sampling strategy for high-volume periods (>1000 RPM)
- Backup and disaster recovery for log data
- Email provider configuration for alert notifications

**Success Metrics:**
- Time to diagnose production issues reduced from hours to minutes
- 100% of trip requests traceable with complete audit trail
- Proactive detection of performance degradation before user complaints
- Clear visibility into cost trends and optimization opportunities
- Zero logging-related performance impact on user-facing APIs
