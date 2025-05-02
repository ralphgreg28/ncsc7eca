/*
  # Fix staff table RLS policies for administrators

  1. Changes
    - Update RLS policies to properly handle administrator access
    - Fix policy conditions to prevent recursion
    - Allow administrators to manage staff records

  2. Security
    - Maintain proper access control
    - Ensure administrators can manage staff
    - Allow staff to view active members and their own profile
*/

-- Drop existing policies
DROP POLICY IF EXISTS "administrators_full_access" ON staff;
DROP POLICY IF EXISTS "view_active_and_self" ON staff;
DROP POLICY IF EXISTS "update_own_profile" ON staff;
DROP POLICY IF EXISTS "allow_registration" ON staff;

-- Create new policies
CREATE POLICY "administrators_full_access"
ON staff
FOR ALL
TO authenticated
USING (
  (SELECT position FROM staff WHERE id = auth.uid()) = 'Administrator'
  AND
  (SELECT status FROM staff WHERE id = auth.uid()) = 'Active'
)
WITH CHECK (
  (SELECT position FROM staff WHERE id = auth.uid()) = 'Administrator'
  AND
  (SELECT status FROM staff WHERE id = auth.uid()) = 'Active'
);

CREATE POLICY "view_active_and_self"
ON staff
FOR SELECT
TO authenticated
USING (
  status = 'Active'
  OR id = auth.uid()
);

CREATE POLICY "update_own_profile"
ON staff
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "allow_registration"
ON staff
FOR INSERT
TO public
WITH CHECK (true);