-- Complete Supabase Setup Script with Sessions
-- Run this in your Supabase SQL editor after creating your project

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME,
  category VARCHAR(30) NOT NULL CHECK (category IN ('examen', 'entrega', 'presentacion', 'evento_trabajo', 'evento_universidad')),
  color VARCHAR(7) DEFAULT '#FF3E40', -- Default red color in hex format
  is_shared BOOLEAN DEFAULT FALSE, -- For shared calendar
  shared_by INTEGER REFERENCES users(id), -- Who shared the event
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create event_comments table
CREATE TABLE IF NOT EXISTS event_comments (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON calendar_events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_category ON calendar_events(category);
CREATE INDEX IF NOT EXISTS idx_calendar_events_shared ON calendar_events(is_shared);
CREATE INDEX IF NOT EXISTS idx_event_comments_event_id ON event_comments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_comments_user_id ON event_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Insert default admin user (password: chen2002)
-- Hash generated with bcrypt: chen2002
INSERT INTO users (username, password, full_name, role) 
VALUES ('admin', '$2b$10$km/66hvLGpG8zBXmjI4Oc.sfevg/BMRVWLXVS7ltGl2EMx1RgWsgu', 'Administrador', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) for users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Row Level Security (RLS) for calendar_events
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Row Level Security (RLS) for event_comments
ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;

-- Row Level Security (RLS) for sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Users Table Policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid()::text::integer 
            AND role = 'admin'
        )
    );

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Admins can update all users" ON users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid()::text::integer 
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins can insert users" ON users
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid()::text::integer 
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins can delete users" ON users
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid()::text::integer 
            AND role = 'admin'
        )
    );

-- Calendar Events Policies
CREATE POLICY "Users can view own calendar events" ON calendar_events
    FOR SELECT USING (auth.uid()::text = user_id::text AND is_shared = FALSE);

CREATE POLICY "Users can view shared calendar events" ON calendar_events
    FOR SELECT USING (is_shared = TRUE);

CREATE POLICY "Users can insert own events" ON calendar_events
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own events" ON calendar_events
    FOR UPDATE USING (auth.uid()::text = user_id::text OR auth.uid()::text = shared_by::text);

CREATE POLICY "Users can delete own events" ON calendar_events
    FOR DELETE USING (auth.uid()::text = user_id::text OR auth.uid()::text = shared_by::text);

-- Event Comments Policies
CREATE POLICY "Users can view comments on accessible events" ON event_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM calendar_events 
            WHERE calendar_events.id = event_comments.event_id 
            AND (calendar_events.user_id = auth.uid()::text::integer OR calendar_events.is_shared = TRUE)
        )
    );

CREATE POLICY "Users can insert comments on shared events" ON event_comments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM calendar_events 
            WHERE calendar_events.id = event_comments.event_id 
            AND (calendar_events.user_id = auth.uid()::text::integer OR calendar_events.is_shared = TRUE)
        )
    );

CREATE POLICY "Users can update own comments" ON event_comments
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own comments" ON event_comments
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Sessions Table Policies
CREATE POLICY "Users can view own sessions" ON sessions
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own sessions" ON sessions
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Clean expired sessions function
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;
