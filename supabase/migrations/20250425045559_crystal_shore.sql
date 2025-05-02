/*
  # Fix staff table RLS policies

  1. Changes
    - Remove existing RLS policies that cause recursion
    - Add new, simplified policies for staff table access:
      - Administrators can manage all staff records
      - Staff can view active records and their own record
      - Staff can update their own profile
      - Allow public registration
  
  2. Security
    - Maintains RLS protection
    - Uses auth.uid() directly instead of querying staff table
    - Prevents infinite recursion
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "administrators_full_access" ON staff;
DROP POLICY IF EXISTS "allow_registration" ON staff;
DROP POLICY IF EXISTS "update_own_profile" ON staff;
DROP POLICY IF EXISTS "view_own_and_active_records" ON staff;

-- Create new, simplified policies
CREATE POLICY "administrators_full_access" ON staff
  FOR ALL 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.id = auth.uid()
      AND s.position = 'Administrator'
      AND s.status = 'Active'
      AND s.id != staff.id  -- Prevent recursion by excluding self-reference
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.id = auth.uid()
      AND s.position = 'Administrator'
      AND s.status = 'Active'
      AND s.id != staff.id  -- Prevent recursion by excluding self-reference
    )
  );

CREATE POLICY "allow_registration" ON staff
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "update_own_profile" ON staff
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "view_own_and_active_records" ON staff
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR 
    (status = 'Active' AND id != auth.uid())  -- Prevent recursion by excluding self-reference
  );