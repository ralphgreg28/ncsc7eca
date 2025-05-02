/*
  # Remove authentication and staff management

  1. Changes
    - Drop staff table and related tables
    - Remove existing RLS policies
    - Create new public access policies
    
  2. Security
    - All tables will be publicly accessible
    - No authentication required
*/

-- Drop staff-related tables
DROP TABLE IF EXISTS staff_provinces;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS staff;

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
CREATE POLICY "Allow all operations on citizens" ON citizens FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on regions" ON regions FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on provinces" ON provinces FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on lgus" ON lgus FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on barangays" ON barangays FOR ALL TO PUBLIC USING (true);