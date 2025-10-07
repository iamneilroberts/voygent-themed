/**
 * API Middleware for Request/Response Logging
 * Feature: 006-add-full-logging
 *
 * Captures all API requests and responses for structured logging.
 * Adds request_id to context for correlation across log entries.
 */

import { Logger } from './lib/logger';

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;

  // Generate request ID for correlation
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  // Get logger instance
  const logger = Logger.getInstance(env.DB);

  // Extract metadata from request
  const url = new URL(request.url);
  const agencyId = url.searchParams.get('agency_id') || undefined;
  const correlationId = url.searchParams.get('trip_id') || undefined;

  // Log request
  await logger.logRequest({
    request_id: requestId,
    endpoint: url.pathname,
    method: request.method,
    agency_id: agencyId,
    correlation_id: correlationId
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

    // Flush logs asynchronously (non-blocking)
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

    // Flush logs before re-throwing
    await logger.flush();

    // Re-throw to let error handler catch it
    throw error;
  }
};
