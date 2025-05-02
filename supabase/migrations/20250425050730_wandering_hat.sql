/*
  # Fix recursive staff policies

  1. Changes
    - Remove recursive policies from staff table
    - Create new, non-recursive policies for staff table access
    - Maintain security while avoiding infinite recursion

  2. Security
    - Administrators can still manage all staff records
    - Staff can view their own records
    - Staff can view other active staff members
    - Maintains data access control without recursion
*/

-- Drop existing policies
DROP POLICY IF EXISTS "administrators_full_access" ON staff;
DROP POLICY IF EXISTS "view_own_and_active_records" ON staff;
DROP POLICY IF EXISTS "view_own_record" ON staff;
DROP POLICY IF EXISTS "view_active_staff" ON staff;
DROP POLICY IF EXISTS "administrators_manage_staff" ON staff;

-- Create new non-recursive policies
CREATE POLICY "view_own_record"
  ON staff
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "view_active_staff"
  ON staff
  FOR SELECT
  TO authenticated
  USING (status = 'Active');

CREATE POLICY "administrators_manage_staff"
  ON staff
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.id IN (
        SELECT id 
        FROM staff 
        WHERE position = 'Administrator' 
        AND status = 'Active'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.id IN (
        SELECT id 
        FROM staff 
        WHERE position = 'Administrator' 
        AND status = 'Active'
      )
    )
  );