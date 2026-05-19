-- =============================================================================
-- Migration 023: multi_provider_email
-- Allows the same email address to exist across different auth providers
-- (e.g. a user can have a 'credentials' account and an 'oidc' account with the
-- same email — they are treated as separate identities).
--
-- Replaces the single-column UNIQUE (email) constraint with a composite
-- UNIQUE (email, auth_provider) constraint.
--
-- Safe to run on existing databases: existing rows already have distinct emails
-- so the new composite constraint is satisfied automatically.
-- =============================================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

ALTER TABLE users
  ADD CONSTRAINT users_email_auth_provider_key UNIQUE (email, auth_provider);
