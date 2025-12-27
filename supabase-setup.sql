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

-- Create calendar_events table for personal calendar
CREATE TABLE IF NOT EXISTS calendar_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('examen', 'entrega', 'presentacion', 'evento_trabajo', 'evento_universidad')),
  event_date DATE NOT NULL,
  event_time TIME,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create shared_events table for shared calendar with comments
CREATE TABLE IF NOT EXISTS shared_events (
  id SERIAL PRIMARY KEY,
  original_event_id INTEGER REFERENCES calendar_events(id) ON DELETE CASCADE,
  shared_by_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Create event_comments table for comments on shared events
CREATE TABLE IF NOT EXISTS event_comments (
  id SERIAL PRIMARY KEY,
  shared_event_id INTEGER REFERENCES shared_events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON calendar_events(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_category ON calendar_events(category);
CREATE INDEX IF NOT EXISTS idx_shared_events_original ON shared_events(original_event_id);
CREATE INDEX IF NOT EXISTS idx_shared_events_shared_by ON shared_events(shared_by_user_id);
CREATE INDEX IF NOT EXISTS idx_event_comments_shared_event ON event_comments(shared_event_id);

-- Insert default admin user (password: admin123)
INSERT INTO users (username, password, full_name, role) 
VALUES ('admin', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQ', 'Administrador', 'admin')
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

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admins can view all users" ON users FOR SELECT USING (EXISTS (
  SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
));
CREATE POLICY "Admins can update all users" ON users FOR UPDATE USING (EXISTS (
  SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
));

-- RLS Policies for calendar_events table
CREATE POLICY "Users can view own events" ON calendar_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own events" ON calendar_events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own events" ON calendar_events FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own events" ON calendar_events FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for shared_events table
CREATE POLICY "All authenticated users can view shared events" ON shared_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can share own events" ON shared_events FOR INSERT WITH CHECK (shared_by_user_id = auth.uid());
CREATE POLICY "Event creators can manage their shared events" ON shared_events FOR UPDATE USING (shared_by_user_id = auth.uid());
CREATE POLICY "Event creators can delete their shared events" ON shared_events FOR DELETE USING (shared_by_user_id = auth.uid());

-- RLS Policies for event_comments table
CREATE POLICY "All authenticated users can view comments" ON event_comments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert comments" ON event_comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own comments" ON event_comments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own comments" ON event_comments FOR DELETE USING (user_id = auth.uid());
