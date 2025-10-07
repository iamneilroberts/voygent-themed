/**
 * TypeScript Interfaces for Logging & Admin Dashboard
 * Feature: 006-add-full-logging
 * Phase: 1 (Contracts)
 * Date: 2025-10-07
 */

// ============================================================================
// Core Logging Types
// ============================================================================

/**
 * Log severity levels (ordered by increasing severity)
 */
export type LogSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

/**
 * Operation status
 */
export type LogStatus = 'success' | 'failure' | 'timeout' | null;

/**
 * Admin user roles
 */
export type AdminRole = 'super_admin' | 'agency_admin';

/**
 * Single log entry in the logs table
 */
export interface LogEntry {
  id: string;
  request_id: string;
  correlation_id: string | null;
  timestamp: number; // Unix epoch milliseconds
  severity: LogSeverity;
  operation: string;
  message: string;
  metadata: string | null; // JSON string
  duration_ms: number | null;
  status: LogStatus;
  agency_id: string | null;
  endpoint: string | null;
}

/**
 * Structured metadata for log entries (parsed from JSON string)
 */
export interface LogMetadata {
  [key: string]: any;
  // Common fields:
  user_id?: string;
  trip_id?: string;
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
  error?: string;
  provider?: string;
}

// ============================================================================
// Metrics & Aggregation Types
// ============================================================================

/**
 * Pre-aggregated 5-minute metrics snapshot
 */
export interface MetricsSnapshot {
  id: string;
  timestamp: number; // Start of 5-minute window
  rpm: number; // Requests per minute
  error_rate: number; // 0.0 to 1.0 (percentage as decimal)
  avg_response_ms: number;
  active_requests: number;
  agency_id: string | null;
}

/**
 * Daily aggregated statistics
 */
export interface DailyAggregate {
  id: string;
  date: string; // YYYY-MM-DD format
  total_requests: number;
  total_errors: number;
  total_cost_usd: number;
  avg_response_ms: number;
  p95_response_ms: number;
  p99_response_ms: number;
  provider_breakdown_json: string | null; // JSON string
  endpoint_breakdown_json: string | null; // JSON string
  agency_id: string | null;
}

/**
 * Provider usage breakdown (parsed from JSON)
 */
export interface ProviderBreakdown {
  openai?: number; // Percentage of calls
  anthropic?: number;
  [provider: string]: number | undefined;
}

/**
 * Endpoint usage breakdown (parsed from JSON)
 */
export interface EndpointBreakdown {
  [endpoint: string]: number; // Request count
}

// ============================================================================
// Admin Dashboard API Types
// ============================================================================

/**
 * Query parameters for GET /api/admin/logs
 */
export interface LogQuery {
  limit?: number; // Default: 20, Max: 100
  severity?: LogSeverity | 'ALL';
  start_time?: number; // Unix epoch ms
  end_time?: number; // Unix epoch ms
  agency_id?: string;
  request_id?: string;
  correlation_id?: string;
  endpoint?: string;
}

/**
 * Response from GET /api/admin/logs
 */
export interface LogQueryResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Query parameters for GET /api/admin/metrics
 */
export interface MetricsQuery {
  period?: '5m' | '1h' | '7d' | '30d'; // Default: '5m'
  agency_id?: string;
}

/**
 * Live metrics response (period=5m)
 */
export interface LiveMetricsResponse {
  timestamp: number;
  rpm: number;
  error_rate: number; // 0.0 to 1.0
  avg_response_ms: number;
  active_requests: number;
  recent_errors: RecentError[];
}

/**
 * Historical metrics response (period=7d or 30d)
 */
export interface HistoricalMetricsResponse {
  period: '7d' | '30d';
  data_points: DailyAggregate[];
  summary: {
    total_requests: number;
    total_errors: number;
    total_cost_usd: number;
    avg_error_rate: number;
    avg_response_ms: number;
  };
}

/**
 * Recent error summary for dashboard
 */
export interface RecentError {
  id: string;
  timestamp: number;
  trip_id: string | null;
  error_type: string; // operation field
  severity: LogSeverity;
  message: string;
  agency_id: string | null;
}

/**
 * Complete request trace response from GET /api/admin/traces/:tripId
 */
export interface TraceResponse {
  trip_id: string;
  logs: LogEntry[];
  summary: {
    total_operations: number;
    total_duration_ms: number;
    error_count: number;
    status: 'success' | 'failure' | 'partial';
  };
}

/**
 * Export request parameters for GET /api/admin/export
 */
export interface ExportQuery {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  severity?: LogSeverity | 'ALL';
  agency_id?: string;
  format: 'json'; // Only JSON supported for now
}

/**
 * Export response (JSON file download)
 */
export interface ExportResponse {
  logs: LogEntry[];
  exported_at: number; // Unix epoch ms
  filters: ExportQuery;
  total_count: number;
}

// ============================================================================
// Authentication & Admin User Types
// ============================================================================

/**
 * Admin user in admin_users table
 */
export interface AdminUser {
  id: string;
  email: string;
  password_hash: string; // bcrypt hash (never exposed to client)
  role: AdminRole;
  agency_id: string | null;
  created_at: number;
  last_login: number | null;
}

/**
 * Login request body for POST /api/admin/auth/login
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  token: string; // JWT token
  user: {
    id: string;
    email: string;
    role: AdminRole;
    agency_id: string | null;
  };
}

/**
 * JWT payload structure
 */
export interface JWTPayload {
  userId: string;
  email: string;
  role: AdminRole;
  agencyId: string | null;
  iat: number; // Issued at (Unix timestamp)
  exp: number; // Expires at (Unix timestamp)
}

// ============================================================================
// Alerting Types
// ============================================================================

/**
 * Alert configuration
 */
export interface AlertConfig {
  id: string;
  alert_type: 'error_rate' | 'critical_error' | 'slow_response';
  threshold: number; // Depends on alert_type
  time_window_minutes: number;
  notify_emails: string[]; // List of emails to notify
  enabled: boolean;
}

/**
 * Alert trigger event
 */
export interface AlertEvent {
  id: string;
  alert_type: string;
  triggered_at: number; // Unix epoch ms
  severity: 'warning' | 'critical';
  message: string;
  details: {
    error_rate?: number;
    error_count?: number;
    threshold?: number;
    affected_agency?: string;
    trace_url?: string;
  };
}

/**
 * Email alert template data
 */
export interface EmailAlertData {
  subject: string;
  to: string[];
  html: string;
  timestamp: number;
  alert_type: string;
  severity: 'warning' | 'critical';
}

// ============================================================================
// Performance Monitoring Types
// ============================================================================

/**
 * Endpoint performance statistics
 */
export interface EndpointPerformance {
  endpoint: string;
  request_count: number;
  avg_response_ms: number;
  p50_response_ms: number;
  p95_response_ms: number;
  p99_response_ms: number;
  error_count: number;
  error_rate: number; // 0.0 to 1.0
}

/**
 * Provider performance statistics
 */
export interface ProviderPerformance {
  provider: string; // 'openai' | 'anthropic' | 'serper' | etc
  call_count: number;
  avg_duration_ms: number;
  total_cost_usd: number;
  success_rate: number; // 0.0 to 1.0
  timeout_count: number;
}

/**
 * Database query performance (future enhancement)
 */
export interface QueryPerformance {
  query_type: string; // 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'
  table: string;
  avg_duration_ms: number;
  count: number;
  slow_query_count: number; // Queries >1000ms
}

// ============================================================================
// Dashboard UI State Types (Frontend)
// ============================================================================

/**
 * Dashboard view state
 */
export interface DashboardState {
  user: AdminUser | null;
  selected_agency: string | null; // For super_admin filtering
  time_period: '5m' | '1h' | '7d' | '30d';
  live_metrics: LiveMetricsResponse | null;
  recent_errors: RecentError[];
  loading: boolean;
  error: string | null;
}

/**
 * Chart data structure for frontend
 */
export interface ChartData {
  labels: string[]; // X-axis labels (dates or timestamps)
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string;
  fill?: boolean;
}

// ============================================================================
// Logger Module Types (Backend Implementation)
// ============================================================================

/**
 * Logger configuration
 */
export interface LoggerConfig {
  db: D1Database;
  batch_size: number; // Default: 10
  batch_timeout_ms: number; // Default: 1000
  enable_console_fallback: boolean; // Default: true
}

/**
 * Logger interface for implementation
 */
export interface ILogger {
  /**
   * Log an incoming API request
   */
  logRequest(data: {
    request_id: string;
    endpoint: string;
    method: string;
    agency_id?: string;
    correlation_id?: string;
  }): Promise<void>;

  /**
   * Log an API response
   */
  logResponse(data: {
    request_id: string;
    status_code: number;
    duration_ms: number;
    response_size?: number;
  }): Promise<void>;

  /**
   * Log an error
   */
  logError(data: {
    request_id: string;
    operation: string;
    error: Error | string;
    severity?: LogSeverity;
    metadata?: LogMetadata;
  }): Promise<void>;

  /**
   * Log an external provider call (LLM, search API, etc)
   */
  logProvider(data: {
    request_id: string;
    provider: string;
    operation: string;
    duration_ms: number;
    tokens_in?: number;
    tokens_out?: number;
    cost_usd?: number;
    status: LogStatus;
    error?: string;
  }): Promise<void>;

  /**
   * Flush buffered logs immediately
   */
  flush(): Promise<void>;
}

// ============================================================================
// PII Sanitization Types
// ============================================================================

/**
 * PII sanitizer interface
 */
export interface IPIISanitizer {
  /**
   * Sanitize a string (mask emails, surnames, etc)
   */
  sanitize(text: string): string;

  /**
   * Sanitize an object (recursively sanitize all string fields)
   */
  sanitizeObject(obj: any): any;

  /**
   * Mask an email address
   */
  maskEmail(email: string): string;

  /**
   * Mask a surname
   */
  maskSurname(surname: string): string;

  /**
   * Redact genealogy data
   */
  redactGenealogy(data: any): any;
}

// ============================================================================
// Cloudflare Workers Environment Types
// ============================================================================

/**
 * Extended environment with logging bindings
 */
export interface Env {
  // Existing bindings
  DB: D1Database;
  AI?: any;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  SERPER_API_KEY?: string;
  TAVILY_API_KEY?: string;

  // New logging/admin bindings
  JWT_SECRET?: string;
  ALERT_EMAIL_TO?: string;
  MAILCHANNELS_API_KEY?: string;
  LOG_LEVEL?: LogSeverity; // Minimum severity to log (default: INFO)
}

/**
 * Request context with logging metadata
 */
export interface RequestContext {
  request: Request;
  env: Env;
  ctx: ExecutionContext;
  requestId: string; // Generated by middleware
  startTime: number; // For duration calculation
  agencyId?: string; // Extracted from request
  userId?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Generic API response wrapper
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  meta?: {
    request_id: string;
    timestamp: number;
  };
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// ============================================================================
// Exports
// ============================================================================

// Export all types as a namespace for easier imports
export namespace Logging {
  export type Severity = LogSeverity;
  export type Status = LogStatus;
  export type Entry = LogEntry;
  export type Metadata = LogMetadata;
  export type Snapshot = MetricsSnapshot;
  export type Aggregate = DailyAggregate;
  export type Query = LogQuery;
  export type Trace = TraceResponse;
}

export namespace Admin {
  export type User = AdminUser;
  export type Role = AdminRole;
  export type Login = LoginRequest;
  export type LoginResp = LoginResponse;
  export type JWT = JWTPayload;
}

export namespace Dashboard {
  export type State = DashboardState;
  export type LiveMetrics = LiveMetricsResponse;
  export type HistoricalMetrics = HistoricalMetricsResponse;
  export type Chart = ChartData;
}
