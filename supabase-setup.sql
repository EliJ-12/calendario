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

-- Create event_categories table
CREATE TABLE IF NOT EXISTS event_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  color VARCHAR(7) NOT NULL, -- Hex color code
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create personal_events table
CREATE TABLE IF NOT EXISTS personal_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES event_categories(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME,
  is_all_day BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create shared_events table
CREATE TABLE IF NOT EXISTS shared_events (
  id SERIAL PRIMARY KEY,
  original_event_id INTEGER REFERENCES personal_events(id) ON DELETE CASCADE,
  shared_by_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME,
  is_all_day BOOLEAN DEFAULT FALSE,
  category_id INTEGER REFERENCES event_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create shared_event_comments table
CREATE TABLE IF NOT EXISTS shared_event_comments (
  id SERIAL PRIMARY KEY,
  shared_event_id INTEGER REFERENCES shared_events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_personal_events_user_date ON personal_events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_personal_events_date ON personal_events(date);
CREATE INDEX IF NOT EXISTS idx_shared_events_date ON shared_events(date);
CREATE INDEX IF NOT EXISTS idx_shared_event_comments_event ON shared_event_comments(shared_event_id);
CREATE INDEX IF NOT EXISTS idx_shared_event_comments_user ON shared_event_comments(user_id);

-- Insert default event categories
INSERT INTO event_categories (name, color) VALUES
  ('Examen', '#FF3E40'),
  ('Entrega', '#FFA500'),
  ('Presentación', '#4CAF50'),
  ('Evento trabajo', '#2196F3'),
  ('Evento universidad', '#9C27B0')
ON CONFLICT (name) DO NOTHING;

-- Insert default admin user (password: chen2002)
INSERT INTO users (username, password, full_name, role) 
VALUES ('admin', '$2b$10$bGoRyDvsv3PaT2qWIOGVFOvTkYHhU6kVKV1o0LpZpYCfnnmZbfNqi', 'Administrador', 'admin')
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
CREATE TRIGGER update_personal_events_updated_at BEFORE UPDATE ON personal_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shared_events_updated_at BEFORE UPDATE ON shared_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shared_event_comments_updated_at BEFORE UPDATE ON shared_event_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_event_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (role = 'admin');

CREATE POLICY "Admins can insert users" ON users
  FOR INSERT WITH CHECK (role = 'admin');

CREATE POLICY "Admins can update users" ON users
  FOR UPDATE USING (role = 'admin');

CREATE POLICY "Admins can delete users" ON users
  FOR DELETE USING (role = 'admin');

-- RLS Policies for personal_events table
CREATE POLICY "Users can view their own events" ON personal_events
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own events" ON personal_events
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own events" ON personal_events
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own events" ON personal_events
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- RLS Policies for shared_events table
CREATE POLICY "All authenticated users can view shared events" ON shared_events
  FOR SELECT USING (auth.role() != 'anon');

CREATE POLICY "Users can insert shared events from their personal events" ON shared_events
  FOR INSERT WITH CHECK (auth.uid()::text = shared_by_user_id::text);

CREATE POLICY "Event creators can update their shared events" ON shared_events
  FOR UPDATE USING (auth.uid()::text = shared_by_user_id::text);

CREATE POLICY "Event creators can delete their shared events" ON shared_events
  FOR DELETE USING (auth.uid()::text = shared_by_user_id::text);

-- RLS Policies for shared_event_comments table
CREATE POLICY "All authenticated users can view shared event comments" ON shared_event_comments
  FOR SELECT USING (auth.role() != 'anon');

CREATE POLICY "Authenticated users can insert comments" ON shared_event_comments
  FOR INSERT WITH CHECK (auth.role() != 'anon');

CREATE POLICY "Users can update their own comments" ON shared_event_comments
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own comments" ON shared_event_comments
  FOR DELETE USING (auth.uid()::text = user_id::text);
