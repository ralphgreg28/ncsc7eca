/*
  # Remove Authentication System

  1. Changes
    - Drop all authentication-related tables
    - Remove RLS policies
    - Clean up any remaining auth functions
    
  2. Security
    - All tables will be publicly accessible
    - No authentication required
*/

-- Drop authentication-related tables
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS staff_provinces;
DROP TABLE IF EXISTS staff;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations on citizens" ON citizens;
DROP POLICY IF EXISTS "Allow all operations on regions" ON regions;
DROP POLICY IF EXISTS "Allow all operations on provinces" ON provinces;
DROP POLICY IF EXISTS "Allow all operations on lgus" ON lgus;
DROP POLICY IF EXISTS "Allow all operations on barangays" ON barangays;

-- Update RLS policies for remaining tables
ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE lgus ENABLE ROW LEVEL SECURITY;
ALTER TABLE barangays ENABLE ROW LEVEL SECURITY;

-- Create public access policies
CREATE POLICY "Allow all operations on citizens" ON citizens FOR ALL TO public USING (true);
CREATE POLICY "Allow all operations on regions" ON regions FOR ALL TO public USING (true);
CREATE POLICY "Allow all operations on provinces" ON provinces FOR ALL TO public USING (true);
CREATE POLICY "Allow all operations on lgus" ON lgus FOR ALL TO public USING (true);
CREATE POLICY "Allow all operations on barangays" ON barangays FOR ALL TO public USING (true);