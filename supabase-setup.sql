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

-- Create events table (personal calendar)
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(20) NOT NULL CHECK (category IN ('examen', 'entrega', 'presentacion', 'evento_trabajo', 'evento_universidad')),
  date DATE NOT NULL,
  time TIME NOT NULL,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create shared_events table
CREATE TABLE IF NOT EXISTS shared_events (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  shared_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
  shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create event_comments table
CREATE TABLE IF NOT EXISTS event_comments (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_shared_events_event ON shared_events(event_id);
CREATE INDEX IF NOT EXISTS idx_shared_events_shared_by ON shared_events(shared_by);
CREATE INDEX IF NOT EXISTS idx_event_comments_event ON event_comments(event_id);

-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events table
-- Users can see their own events
CREATE POLICY "Users can view own events" ON events
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- Users can insert their own events
CREATE POLICY "Users can insert own events" ON events
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Users can update their own events
CREATE POLICY "Users can update own events" ON events
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Users can delete their own events
CREATE POLICY "Users can delete own events" ON events
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- RLS Policies for shared_events table
-- All authenticated users can view shared events
CREATE POLICY "All users can view shared events" ON shared_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- Users can share their own events
CREATE POLICY "Users can share own events" ON shared_events
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND user_id = auth.uid()::text)
  );

-- Only event creator can unshare (delete from shared_events)
CREATE POLICY "Users can unshare own events" ON shared_events
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND user_id = auth.uid()::text)
  );

-- RLS Policies for event_comments table
-- All authenticated users can view comments on shared events
CREATE POLICY "Users can view comments on shared events" ON event_comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM shared_events WHERE event_id = event_comments.event_id)
  );

-- All authenticated users can insert comments on shared events
CREATE POLICY "Users can comment on shared events" ON event_comments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM shared_events WHERE event_id = event_id)
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments" ON event_comments
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments" ON event_comments
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Insert default admin user (password: chen2002)
-- Hash for 'chen2002': $2b$10$EOZTOukJIw8I145aDTDStOnvmy0whhsrFZ3qZe5gRgF4oxsdVv3DW
INSERT INTO users (username, password, full_name, role) 
VALUES ('admin', '$2b$10$EOZTOukJIw8I145aDTDStOnvmy0whhsrFZ3qZe5gRgF4oxsdVv3DW', 'Administrador', 'admin')
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
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
