-- Migration 012: Seed initial admin user
-- Feature: 006-add-full-logging
-- Creates a super-admin user for testing the admin dashboard

-- Insert super-admin user
-- Password: admin123 (for local development only)
-- Note: In production, this should be replaced with a proper bcrypt hash
INSERT INTO admin_users (id, email, password_hash, role, agency_id, created_at, last_login)
VALUES (
  lower(hex(randomblob(16))),
  'admin@voygent.ai',
  'INSECURE_PLAINTEXT_admin123',
  'super_admin',
  NULL,
  unixepoch(),
  NULL
);
