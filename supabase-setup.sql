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
  category VARCHAR(50) NOT NULL CHECK (category IN ('Examen', 'Entrega', 'Presentación', 'Evento trabajo', 'Evento universidad')),
  event_date DATE NOT NULL,
  event_time TIME,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create shared_event_comments table
CREATE TABLE IF NOT EXISTS shared_event_comments (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON calendar_events(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_shared ON calendar_events(is_shared);
CREATE INDEX IF NOT EXISTS idx_shared_event_comments_event ON shared_event_comments(event_id);

-- Insert default admin user (password: chen2002)
INSERT INTO users (username, password, full_name, role) 
VALUES ('admin', '$2b$10$bGoRyDvsv3PaT2qWIOGVFOvTkYHhU6kVKV1o0LpZpYCfnnmZbfNqi', 'Administrador', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Enable RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_event_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar_events
-- Users can see their own events
CREATE POLICY "Users can view own events" ON calendar_events
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- Users can insert their own events
CREATE POLICY "Users can insert own events" ON calendar_events
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Users can update their own events
CREATE POLICY "Users can update own events" ON calendar_events
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Users can delete their own events
CREATE POLICY "Users can delete own events" ON calendar_events
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Everyone can view shared events
CREATE POLICY "Everyone can view shared events" ON calendar_events
  FOR SELECT USING (is_shared = TRUE);

-- RLS Policies for shared_event_comments
-- Users can view comments on shared events
CREATE POLICY "Users can view comments on shared events" ON shared_event_comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM calendar_events ce 
           WHERE ce.id = event_id AND ce.is_shared = TRUE)
  );

-- Users can insert comments on shared events
CREATE POLICY "Users can insert comments on shared events" ON shared_event_comments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM calendar_events ce 
           WHERE ce.id = event_id AND ce.is_shared = TRUE)
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments" ON shared_event_comments
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments" ON shared_event_comments
  FOR DELETE USING (auth.uid()::text = user_id::text);

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
