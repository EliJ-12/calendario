-- Create sessions table for better session management
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  ip_address INET,
  user_agent TEXT
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Enable RLS for sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Session policies
CREATE POLICY "Users can view own sessions" ON sessions
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own sessions" ON sessions
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Clean expired sessions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create trigger for auto-cleanup (run every hour)
-- This would need pg_cron extension or external scheduler
