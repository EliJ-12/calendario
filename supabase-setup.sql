-- Supabase SQL setup script
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON calendar_events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_category ON calendar_events(category);
CREATE INDEX IF NOT EXISTS idx_calendar_events_shared ON calendar_events(is_shared);
CREATE INDEX IF NOT EXISTS idx_event_comments_event_id ON event_comments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_comments_user_id ON event_comments(user_id);

-- Insert default admin user (password: chen2002)
-- Hash generated with bcrypt: chen2002
INSERT INTO users (username, password, full_name, role) 
VALUES ('admin', '$2b$10$F5e.JabTjLNQ4MwgEp6PNOl8EtTjQ7OLgZ1yD1XUA0nzq/vTghF8W', 'Administrador', 'admin')
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

-- Users Table Policies

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

-- Policy: Admins can view all users
CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid()::text::integer 
            AND role = 'admin'
        )
    );

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Policy: Admins can update all users
CREATE POLICY "Admins can update all users" ON users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid()::text::integer 
            AND role = 'admin'
        )
    );

-- Policy: Admins can insert users
CREATE POLICY "Admins can insert users" ON users
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid()::text::integer 
            AND role = 'admin'
        )
    );

-- Policy: Admins can delete users
CREATE POLICY "Admins can delete users" ON users
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid()::text::integer 
            AND role = 'admin'
        )
    );

-- Calendar Events Policies

-- Policy: Users can view their own events (personal calendar)
CREATE POLICY "Users can view own calendar events" ON calendar_events
    FOR SELECT USING (auth.uid()::text = user_id::text AND is_shared = FALSE);

-- Policy: Users can view all shared events
CREATE POLICY "Users can view shared calendar events" ON calendar_events
    FOR SELECT USING (is_shared = TRUE);

-- Policy: Users can insert their own events
CREATE POLICY "Users can insert own calendar events" ON calendar_events
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Policy: Users can update their own events
CREATE POLICY "Users can update own calendar events" ON calendar_events
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Policy: Users can delete their own events
CREATE POLICY "Users can delete own calendar events" ON calendar_events
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Policy: Event owners can share/unshare their events
CREATE POLICY "Users can share own calendar events" ON calendar_events
    FOR UPDATE USING (auth.uid()::text = user_id::text AND is_shared = TRUE);

-- Policy: Only event owners can modify shared events
CREATE POLICY "Event owners can modify shared events" ON calendar_events
    FOR UPDATE USING (auth.uid()::text = user_id::text OR auth.uid()::text = shared_by::text);

-- Policy: Only event owners can delete shared events
CREATE POLICY "Event owners can delete shared events" ON calendar_events
    FOR DELETE USING (auth.uid()::text = user_id::text OR auth.uid()::text = shared_by::text);

-- Event Comments Policies

-- Policy: Users can view comments on shared events
CREATE POLICY "Users can view comments on shared events" ON event_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM calendar_events 
            WHERE calendar_events.id = event_id 
            AND calendar_events.is_shared = TRUE
        )
    );

-- Policy: Users can view comments on their own events
CREATE POLICY "Users can view comments on own events" ON event_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM calendar_events 
            WHERE calendar_events.id = event_id 
            AND calendar_events.user_id::text = auth.uid()::text
        )
    );

-- Policy: Users can insert comments on shared events
CREATE POLICY "Users can comment on shared events" ON event_comments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM calendar_events 
            WHERE calendar_events.id = event_id 
            AND calendar_events.is_shared = TRUE
        )
    );

-- Policy: Users can insert comments on their own events
CREATE POLICY "Users can comment on own events" ON event_comments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM calendar_events 
            WHERE calendar_events.id = event_id 
            AND calendar_events.user_id::text = auth.uid()::text
        )
    );

-- Policy: Users can update their own comments
CREATE POLICY "Users can update own comments" ON event_comments
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Policy: Users can delete their own comments
CREATE POLICY "Users can delete own comments" ON event_comments
    FOR DELETE USING (auth.uid()::text = user_id::text);
