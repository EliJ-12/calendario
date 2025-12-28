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
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('Examen', 'Entrega', 'Presentación', 'Evento trabajo', 'Evento universidad', 'Comida')),
  date DATE NOT NULL,
  time TIME,
  color VARCHAR(7),
  is_shared BOOLEAN DEFAULT FALSE,
  shared_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create shared_events table
CREATE TABLE IF NOT EXISTS shared_events (
  id SERIAL PRIMARY KEY,
  original_event_id INTEGER REFERENCES calendar_events(id) ON DELETE CASCADE,
  shared_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('Examen', 'Entrega', 'Presentación', 'Evento trabajo', 'Evento universidad', 'Comida')),
  date DATE NOT NULL,
  time TIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create event_comments table
CREATE TABLE IF NOT EXISTS event_comments (
  id SERIAL PRIMARY KEY,
  shared_event_id INTEGER REFERENCES shared_events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON calendar_events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_shared_events_shared_by ON shared_events(shared_by);
CREATE INDEX IF NOT EXISTS idx_shared_events_date ON shared_events(date);
CREATE INDEX IF NOT EXISTS idx_event_comments_shared_event ON event_comments(shared_event_id);

-- Insert default admin user (password: chen2002)
INSERT INTO users (username, password, full_name, role) 
VALUES ('chen2002', '$2b$10$bGoRyDvsv3PaT2qWIOGVFOvTkYHhU6kVKV1o0LpZpYCfnnmZbfNqi', 'Administrador', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Enable RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for calendar_events
CREATE POLICY "Users can view their own events" ON calendar_events
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own events" ON calendar_events
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own events" ON calendar_events
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own events" ON calendar_events
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- RLS policies for shared_events
CREATE POLICY "All authenticated users can view shared events" ON shared_events
  FOR SELECT USING (auth.role() != 'anon');

CREATE POLICY "Users can insert shared events from their own events" ON shared_events
  FOR INSERT WITH CHECK (auth.uid()::text = shared_by::text);

CREATE POLICY "Users can update their own shared events" ON shared_events
  FOR UPDATE USING (auth.uid()::text = shared_by::text);

CREATE POLICY "Users can delete their own shared events" ON shared_events
  FOR DELETE USING (auth.uid()::text = shared_by::text);

-- RLS policies for event_comments
CREATE POLICY "All authenticated users can view comments" ON event_comments
  FOR SELECT USING (auth.role() != 'anon');

CREATE POLICY "Users can insert comments" ON event_comments
  FOR INSERT WITH CHECK (auth.role() != 'anon');

CREATE POLICY "Users can update their own comments" ON event_comments
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own comments" ON event_comments
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
CREATE TRIGGER update_shared_events_updated_at BEFORE UPDATE ON shared_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
