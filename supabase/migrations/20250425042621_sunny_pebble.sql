/*
  # Fix staff table RLS policies

  1. Changes
    - Drop existing problematic policies
    - Create new, simplified policies that avoid recursion
    - Maintain security while preventing infinite loops
  
  2. Security
    - Enable RLS on staff table
    - Add policies for:
      - Administrators can manage all staff
      - Staff can view active staff and their own profile
      - Staff can update their own profile
*/

-- First, drop existing policies to start fresh
DROP POLICY IF EXISTS "enable_delete_for_administrators" ON staff;
DROP POLICY IF EXISTS "enable_insert_for_administrators" ON staff;
DROP POLICY IF EXISTS "enable_read_for_authenticated" ON staff;
DROP POLICY IF EXISTS "enable_update_for_administrators_and_self" ON staff;

-- Create new, simplified policies
CREATE POLICY "administrators_full_access" ON staff
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.id IN (
        SELECT id FROM staff WHERE position = 'Administrator' AND status = 'Active'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.id IN (
        SELECT id FROM staff WHERE position = 'Administrator' AND status = 'Active'
      )
    )
  );

CREATE POLICY "view_active_and_self" ON staff
  FOR SELECT
  TO authenticated
  USING (
    status = 'Active' OR id = auth.uid()
  );

CREATE POLICY "update_own_profile" ON staff
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());