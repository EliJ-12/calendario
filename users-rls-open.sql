-- Open RLS policies for users table
-- This allows full access to users table for authenticated users

-- First, enable RLS if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

-- Create open policies for full access

-- Policy: All authenticated users can view all users
CREATE POLICY "Allow authenticated users to view all users" ON users
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: All authenticated users can insert users
CREATE POLICY "Allow authenticated users to insert users" ON users
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: All authenticated users can update all users
CREATE POLICY "Allow authenticated users to update all users" ON users
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy: All authenticated users can delete all users
CREATE POLICY "Allow authenticated users to delete all users" ON users
    FOR DELETE USING (auth.role() = 'authenticated');

-- Alternative: Completely disable RLS for users table (uncomment below if needed)
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
