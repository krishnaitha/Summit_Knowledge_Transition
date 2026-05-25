-- 032_chat_session_title.sql
-- Adds user-visible titles for chat sessions.

ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS title text;
