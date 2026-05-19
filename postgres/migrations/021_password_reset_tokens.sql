-- Migration: add password_reset_tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null,
  token      text        not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
