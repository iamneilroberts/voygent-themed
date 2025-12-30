/**
 * Logging Service
 * VoyGent V3 - Two-Tier Logging System
 *
 * Implements Constitution principle: user-facing friendly messages vs admin technical telemetry.
 * Routes log messages based on user role and diagnostics_enabled setting.
 */
/**
 * Logger Class
 *
 * Provides two-tier logging:
 * - User-facing: Friendly progress messages (via trip.progress_message)
 * - Admin: Technical telemetry with costs, tokens, timing (via trip.telemetry_logs)
 */
export class Logger {
    context;
    entries = [];
    constructor(context = {}) {
        this.context = context;
    }
    /**
     * Log user-facing progress message
     * Updates trip.progress_message and trip.progress_percent
     */
    async logUserProgress(db, tripId, message, percent) {
        await db.updateTripStatus(tripId, 'researching', message, percent);
        this.info(`[USER] ${message} (${percent}%)`);
    }
    /**
     * Log admin telemetry event
     * Appends to trip.telemetry_logs (admin-only access via /api/trips/:id/logs)
     */
    async logTelemetry(db, tripId, event, metadata) {
        const log = {
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
    info(message, metadata) {
        this.log('info', message, metadata);
    }
    warn(message, metadata) {
        this.log('warn', message, metadata);
    }
    error(message, metadata) {
        this.log('error', message, metadata);
    }
    debug(message, metadata) {
        this.log('debug', message, metadata);
    }
    log(level, message, metadata) {
        const entry = {
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
    getEntries() {
        return this.entries;
    }
    /**
     * Create child logger with merged context
     */
    child(context) {
        return new Logger({ ...this.context, ...context });
    }
}
/**
 * Create logger instance
 */
export function createLogger(context) {
    return new Logger(context);
}
/**
 * Helper: Check if user is admin and diagnostics enabled
 */
export function shouldShowTelemetry(userRole, diagnosticsEnabled) {
    return userRole === 'admin' && diagnosticsEnabled === true;
}
