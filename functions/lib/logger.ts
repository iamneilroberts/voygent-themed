/**
 * Logging Service
 * VoyGent V3 - Two-Tier Logging System
 *
 * Implements Constitution principle: user-facing friendly messages vs admin technical telemetry.
 * Routes log messages based on user role and diagnostics_enabled setting.
 */

import { TelemetryLog, DatabaseClient } from './db';

export interface LogContext {
  tripId?: string;
  userId?: string;
  userRole?: 'user' | 'admin';
  diagnosticsEnabled?: boolean;
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: number;
  context?: LogContext;
  metadata?: Record<string, any>;
}

/**
 * Logger Class
 *
 * Provides two-tier logging:
 * - User-facing: Friendly progress messages (via trip.progress_message)
 * - Admin: Technical telemetry with costs, tokens, timing (via trip.telemetry_logs)
 */
export class Logger {
  private entries: LogEntry[] = [];

  constructor(private context: LogContext = {}) {}

  /**
   * Log user-facing progress message
   * Updates trip.progress_message and trip.progress_percent
   */
  async logUserProgress(
    db: DatabaseClient,
    tripId: string,
    message: string,
    percent: number
  ): Promise<void> {
    await db.updateTripStatus(tripId, 'researching', message, percent);
    this.info(`[USER] ${message} (${percent}%)`);
  }

  /**
   * Log admin telemetry event
   * Appends to trip.telemetry_logs (admin-only access via /api/trips/:id/logs)
   */
  async logTelemetry(
    db: DatabaseClient,
    tripId: string,
    event: string,
    metadata: {
      provider?: string;
      model?: string;
      tokens?: number;
      cost?: number;
      duration_ms?: number;
      details?: any;
    }
  ): Promise<void> {
    const log: TelemetryLog = {
      timestamp: Date.now(),
      event,
      ...metadata,
    };

    await db.addTelemetryLog(tripId, log);
    this.debug(`[TELEMETRY] ${event}`, metadata);
  }

  /**
   * Standard log levels (console output)
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, any>): void {
    this.log('error', message, metadata);
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  private log(level: LogEntry['level'], message: string, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context: this.context,
      metadata,
    };

    this.entries.push(entry);

    // Console output (for Wrangler logs)
    const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    logFn(`[${level.toUpperCase()}] ${message}`, metadata || '');
  }

  /**
   * Get all log entries (for debugging)
   */
  getEntries(): LogEntry[] {
    return this.entries;
  }

  /**
   * Create child logger with merged context
   */
  child(context: Partial<LogContext>): Logger {
    return new Logger({ ...this.context, ...context });
  }
}

/**
 * Create logger instance
 */
export function createLogger(context?: LogContext): Logger {
  return new Logger(context);
}

/**
 * Helper: Check if user is admin and diagnostics enabled
 */
export function shouldShowTelemetry(userRole?: string, diagnosticsEnabled?: boolean): boolean {
  return userRole === 'admin' && diagnosticsEnabled === true;
}
