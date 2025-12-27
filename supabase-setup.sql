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
  color VARCHAR(7) NOT NULL, -- hex color
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create personal_events table
CREATE TABLE IF NOT EXISTS personal_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES event_categories(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
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
  event_date DATE NOT NULL,
  event_time TIME,
  category_color VARCHAR(7) NOT NULL,
  category_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create shared_event_comments table
CREATE TABLE IF NOT EXISTS shared_event_comments (
  id SERIAL PRIMARY KEY,
  shared_event_id INTEGER REFERENCES shared_events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_personal_events_user_date ON personal_events(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_personal_events_date ON personal_events(event_date);
CREATE INDEX IF NOT EXISTS idx_shared_events_date ON shared_events(event_date);
CREATE INDEX IF NOT EXISTS idx_shared_event_comments_event ON shared_event_comments(shared_event_id);

-- Insert default event categories
INSERT INTO event_categories (name, color) VALUES 
  ('Examen', '#FF6B6B'),
  ('Entrega', '#4ECDC4'),
  ('Presentación', '#45B7D1'),
  ('Evento trabajo', '#96CEB4'),
  ('Evento universidad', '#FFEAA7')
ON CONFLICT (name) DO NOTHING;

-- Insert default admin user (password: chen2002)
INSERT INTO users (username, password, full_name, role) 
VALUES ('admin', '$2b$10$bGoRyDvsv3PaT2qWIOGVFOvTkYHhU6kVKV1o0LpZpYCfnnzZbfNqi', 'Administrador', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_event_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for users table
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Admins can insert users" ON users FOR INSERT WITH CHECK (role = 'admin');
CREATE POLICY "Admins can update users" ON users FOR UPDATE USING (role = 'admin' OR id = auth.uid());
CREATE POLICY "Admins can delete users" ON users FOR DELETE USING (role = 'admin');

-- RLS policies for personal_events table
CREATE POLICY "Users can view own events" ON personal_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own events" ON personal_events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own events" ON personal_events FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own events" ON personal_events FOR DELETE USING (user_id = auth.uid());

-- RLS policies for shared_events table
CREATE POLICY "All users can view shared events" ON shared_events FOR SELECT USING (true);
CREATE POLICY "Users can insert shared events" ON shared_events FOR INSERT WITH CHECK (shared_by_user_id = auth.uid());
CREATE POLICY "Users can update own shared events" ON shared_events FOR UPDATE USING (shared_by_user_id = auth.uid());
CREATE POLICY "Users can delete own shared events" ON shared_events FOR DELETE USING (shared_by_user_id = auth.uid());

-- RLS policies for shared_event_comments table
CREATE POLICY "All users can view comments" ON shared_event_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert comments" ON shared_event_comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own comments" ON shared_event_comments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own comments" ON shared_event_comments FOR DELETE USING (user_id = auth.uid());

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
