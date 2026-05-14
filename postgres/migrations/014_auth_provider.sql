-- =============================================================================
-- Migration 014: auth_provider
-- Adds the auth_provider column to users so the credentials and Cognito
-- providers can co-exist without cross-provider conflicts.
-- Safe to run on existing databases — uses ADD COLUMN IF NOT EXISTS.
-- =============================================================================

-- Track which auth strategy owns this user row.
-- Prevents a Cognito-provisioned user from re-registering via credentials.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'credentials';

-- Backfill: rows without a password_hash were provisioned by Cognito.
UPDATE users SET auth_provider = 'cognito' WHERE password_hash IS NULL;
