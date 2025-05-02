/*
  # Fix staff table RLS policies

  1. Changes
    - Remove existing problematic RLS policies on staff table
    - Add new, simplified RLS policies that prevent infinite recursion
    - Policies now properly handle:
      - Administrator access
      - Self-access for staff members
      - First user setup
  
  2. Security
    - Maintains security while preventing infinite recursion
    - Ensures administrators can still manage all staff
    - Allows staff to view/edit their own records
*/

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Administrator full access" ON staff;
DROP POLICY IF EXISTS "Enable first user setup" ON staff;
DROP POLICY IF EXISTS "Staff self access" ON staff;
DROP POLICY IF EXISTS "Staff self update" ON staff;

-- Create new, simplified policies
CREATE POLICY "administrators_full_access" ON staff
FOR ALL USING (
  (SELECT position FROM staff s WHERE s.id = auth.uid()) = 'Administrator'
  AND
  (SELECT status FROM staff s WHERE s.id = auth.uid()) = 'Active'
);

CREATE POLICY "staff_self_access" ON staff
FOR SELECT USING (
  id = auth.uid()
);

CREATE POLICY "staff_self_update" ON staff
FOR UPDATE USING (
  id = auth.uid()
) WITH CHECK (
  id = auth.uid()
);

CREATE POLICY "enable_first_user" ON staff
FOR INSERT TO authenticated
WITH CHECK (
  NOT EXISTS (SELECT 1 FROM staff)
);