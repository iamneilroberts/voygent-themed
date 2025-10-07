-- Migration 011: Add logging and admin dashboard tables
-- Feature: 006-add-full-logging
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

-- 3. Daily aggregated statistics (kept indefinitely)
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

-- 4. Admin users for dashboard authentication
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
