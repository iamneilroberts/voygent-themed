/**
 * Logger Module for Structured Logging
 * Feature: 006-add-full-logging
 *
 * Provides centralized, fail-safe logging with batch insertion for performance.
 * Implements singleton pattern to maintain a single logger instance per worker.
 */

// Type definitions (will be replaced with imports from contracts once available)
export type LogSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
export type LogStatus = 'success' | 'failure' | 'timeout' | null;

export interface LogEntry {
  id: string;
  request_id: string;
  correlation_id: string | null;
  timestamp: number;
  severity: LogSeverity;
  operation: string;
  message: string;
  metadata: string | null;
  duration_ms: number | null;
  status: LogStatus;
  agency_id: string | null;
  endpoint: string | null;
}

interface LogRequestData {
  request_id: string;
  endpoint: string;
  method: string;
  agency_id?: string;
  correlation_id?: string;
}

interface LogResponseData {
  request_id: string;
  status_code: number;
  duration_ms: number;
  response_size?: number;
}

interface LogErrorData {
  request_id: string;
  operation: string;
  error: Error | string;
  severity?: LogSeverity;
  metadata?: any;
}

interface LogProviderData {
  request_id: string;
  provider: string;
  operation: string;
  duration_ms: number;
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
  status: LogStatus;
  error?: string;
}

export class Logger {
  private static instance: Logger | null = null;
  private db: D1Database;
  private logBuffer: LogEntry[] = [];
  private batchSize: number = 10;
  private batchTimeout: number = 1000; // 1 second
  private flushTimer: number | null = null;

  private constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Get singleton Logger instance
   */
  public static getInstance(db: D1Database): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(db);
    }
    return Logger.instance;
  }

  /**
   * Log an incoming API request
   */
  async logRequest(data: LogRequestData): Promise<void> {
    try {
      const logEntry: LogEntry = {
        id: this.generateId(),
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

  /**
   * Log an API response
   */
  async logResponse(data: LogResponseData): Promise<void> {
    try {
      const status: LogStatus = data.status_code >= 400 ? 'failure' : 'success';
      const severity: LogSeverity = data.status_code >= 500 ? 'ERROR' :
                                     data.status_code >= 400 ? 'WARN' : 'INFO';

      const logEntry: LogEntry = {
        id: this.generateId(),
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

  /**
   * Log an error
   */
  async logError(data: LogErrorData): Promise<void> {
    try {
      const errorMessage = typeof data.error === 'string' ? data.error : data.error.message;
      const errorStack = typeof data.error === 'object' && 'stack' in data.error ? data.error.stack : null;

      const logEntry: LogEntry = {
        id: this.generateId(),
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

  /**
   * Log an external provider call (LLM, search API, etc)
   */
  async logProvider(data: LogProviderData): Promise<void> {
    try {
      const severity: LogSeverity = data.status === 'failure' ? 'ERROR' :
                                     data.status === 'timeout' ? 'WARN' : 'INFO';

      const logEntry: LogEntry = {
        id: this.generateId(),
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

  /**
   * Flush buffered logs immediately
   */
  async flush(): Promise<void> {
    if (this.flushTimer !== null) {
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

  /**
   * Add log entry to buffer and trigger flush if needed
   */
  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);

    if (this.logBuffer.length >= this.batchSize) {
      this.flush();
    } else if (this.flushTimer === null) {
      this.flushTimer = setTimeout(() => this.flush(), this.batchTimeout) as any;
    }
  }

  /**
   * Write batched logs to database
   */
  private async writeLogs(logs: LogEntry[]): Promise<void> {
    if (logs.length === 0) return;

    try {
      // Build batch insert
      const values = logs.map(log =>
        `('${log.id}', '${log.request_id}', ${log.correlation_id ? `'${log.correlation_id}'` : 'NULL'}, ${log.timestamp}, '${log.severity}', '${this.escapeString(log.operation)}', '${this.escapeString(log.message)}', ${log.metadata ? `'${this.escapeString(log.metadata)}'` : 'NULL'}, ${log.duration_ms || 'NULL'}, ${log.status ? `'${log.status}'` : 'NULL'}, ${log.agency_id ? `'${log.agency_id}'` : 'NULL'}, ${log.endpoint ? `'${this.escapeString(log.endpoint)}'` : 'NULL'})`
      ).join(',');

      const sql = `INSERT INTO logs (id, request_id, correlation_id, timestamp, severity, operation, message, metadata, duration_ms, status, agency_id, endpoint) VALUES ${values}`;

      await this.db.prepare(sql).run();
    } catch (error) {
      // If batch insert fails, try one at a time
      console.error('[Logger] Batch insert failed, trying individual inserts:', error);
      for (const log of logs) {
        try {
          await this.db.prepare(
            `INSERT INTO logs (id, request_id, correlation_id, timestamp, severity, operation, message, metadata, duration_ms, status, agency_id, endpoint) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            log.id,
            log.request_id,
            log.correlation_id,
            log.timestamp,
            log.severity,
            log.operation,
            log.message,
            log.metadata,
            log.duration_ms,
            log.status,
            log.agency_id,
            log.endpoint
          ).run();
        } catch (individualError) {
          console.error('[Logger] Failed to write individual log:', individualError, log);
        }
      }
    }
  }

  /**
   * Escape string for SQL safety
   */
  private escapeString(str: string): string {
    if (!str) return '';
    return str.replace(/'/g, "''").substring(0, 1000); // Truncate long strings
  }

  /**
   * Generate UUID for log entries
   */
  private generateId(): string {
    return crypto.randomUUID();
  }
}
