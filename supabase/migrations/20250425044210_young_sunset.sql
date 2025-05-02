/*
  # Add staff registration policies

  1. Changes
    - Add policy to allow unauthenticated users to register new staff members
    - Add policy to allow administrators to manage staff
    - Add policy to allow staff to view their own profile
  
  2. Security
    - Enable RLS on staff table (already enabled)
    - Add policies for staff registration and management
*/

-- Drop existing policies
DROP POLICY IF EXISTS "administrators_full_access" ON staff;
DROP POLICY IF EXISTS "update_own_profile" ON staff;
DROP POLICY IF EXISTS "view_active_and_self" ON staff;

-- Add new policies
CREATE POLICY "allow_registration" ON staff
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "administrators_full_access" ON staff
  FOR ALL TO authenticated
  USING ((position = 'Administrator') AND (status = 'Active'))
  WITH CHECK ((position = 'Administrator') AND (status = 'Active'));

CREATE POLICY "view_active_and_self" ON staff
  FOR SELECT TO authenticated
  USING ((status = 'Active') OR (id = auth.uid()));

CREATE POLICY "update_own_profile" ON staff
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());