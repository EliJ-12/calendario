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

-- Create work_logs table
CREATE TABLE IF NOT EXISTS work_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_hours INTEGER NOT NULL, -- in minutes
  type VARCHAR(20) DEFAULT 'work' CHECK (type IN ('work', 'absence')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create absences table
CREATE TABLE IF NOT EXISTS absences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_partial BOOLEAN DEFAULT FALSE,
  partial_hours INTEGER, -- in minutes
  file_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_work_logs_user_date ON work_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_work_logs_date ON work_logs(date);
CREATE INDEX IF NOT EXISTS idx_absences_user_status ON absences(user_id, status);
CREATE INDEX IF NOT EXISTS idx_absences_dates ON absences(start_date, end_date);

-- Create personal_events table
CREATE TABLE IF NOT EXISTS personal_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('examen', 'entrega', 'presentacion', 'evento_trabajo', 'evento_universidad')),
  date DATE NOT NULL,
  time TIME,
  is_shared BOOLEAN DEFAULT FALSE,
  shared_event_id INTEGER, -- Reference to shared_events if this is a shared event
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create shared_events table
CREATE TABLE IF NOT EXISTS shared_events (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('examen', 'entrega', 'presentacion', 'evento_trabajo', 'evento_universidad')),
  date DATE NOT NULL,
  time TIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  shared_event_id INTEGER REFERENCES shared_events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_personal_events_user_date ON personal_events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_personal_events_date ON personal_events(date);
CREATE INDEX IF NOT EXISTS idx_shared_events_date ON shared_events(date);
CREATE INDEX IF NOT EXISTS idx_shared_events_creator ON shared_events(creator_id);
CREATE INDEX IF NOT EXISTS idx_comments_event ON comments(shared_event_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);

-- Insert default admin user (password: admin123)
INSERT INTO users (username, password, full_name, role) 
VALUES ('admin', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQ', 'Administrador', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Insert new admin user with password chen2002
INSERT INTO users (username, password, full_name, role) 
VALUES ('chen', '$2b$10$JC9QwR4kscbH5w.mewoAYuU3Sx3PJvWxTP6gWUJvlyub7QEzbuqxW', 'Chen Admin', 'admin')
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
CREATE TRIGGER update_work_logs_updated_at BEFORE UPDATE ON work_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_absences_updated_at BEFORE UPDATE ON absences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_personal_events_updated_at BEFORE UPDATE ON personal_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shared_events_updated_at BEFORE UPDATE ON shared_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE personal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for personal_events
-- Users can see, insert, update, and delete only their own events
CREATE POLICY "Users can view own personal events" ON personal_events FOR SELECT USING (user_id = current_setting('app.current_user_id')::INTEGER);
CREATE POLICY "Users can insert own personal events" ON personal_events FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id')::INTEGER);
CREATE POLICY "Users can update own personal events" ON personal_events FOR UPDATE USING (user_id = current_setting('app.current_user_id')::INTEGER);
CREATE POLICY "Users can delete own personal events" ON personal_events FOR DELETE USING (user_id = current_setting('app.current_user_id')::INTEGER);

-- RLS Policies for shared_events
-- All users can view shared events
CREATE POLICY "All users can view shared events" ON shared_events FOR SELECT USING (true);
-- Only creators can insert their own shared events
CREATE POLICY "Creators can insert shared events" ON shared_events FOR INSERT WITH CHECK (creator_id = current_setting('app.current_user_id')::INTEGER);
-- Only creators can update their shared events
CREATE POLICY "Creators can update own shared events" ON shared_events FOR UPDATE USING (creator_id = current_setting('app.current_user_id')::INTEGER);
-- Only creators can delete their shared events
CREATE POLICY "Creators can delete own shared events" ON shared_events FOR DELETE USING (creator_id = current_setting('app.current_user_id')::INTEGER);

-- RLS Policies for comments
-- All users can view comments on shared events
CREATE POLICY "All users can view comments" ON comments FOR SELECT USING (true);
-- All users can insert comments on shared events
CREATE POLICY "Users can insert comments" ON comments FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id')::INTEGER);
-- Users can update only their own comments
CREATE POLICY "Users can update own comments" ON comments FOR UPDATE USING (user_id = current_setting('app.current_user_id')::INTEGER);
-- Users can delete only their own comments
CREATE POLICY "Users can delete own comments" ON comments FOR DELETE USING (user_id = current_setting('app.current_user_id')::INTEGER);
