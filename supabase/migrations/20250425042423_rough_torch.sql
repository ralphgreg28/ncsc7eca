/*
  # Fix staff table RLS policies

  1. Changes
    - Remove recursive administrator check from staff_read policy
    - Simplify policy conditions to prevent infinite recursion
    - Maintain security while allowing proper access

  2. Security
    - Maintains RLS on staff table
    - Updates policies to be more efficient and prevent recursion
    - Preserves access control requirements
*/

-- Drop existing policies
DROP POLICY IF EXISTS "administrators_all" ON staff;
DROP POLICY IF EXISTS "staff_read" ON staff;
DROP POLICY IF EXISTS "staff_update_self" ON staff;

-- Create new policies without recursion
CREATE POLICY "administrators_can_manage"
ON staff
FOR ALL
TO authenticated
USING (
  (SELECT position FROM staff WHERE id = auth.uid()) = 'Administrator'
  AND
  (SELECT status FROM staff WHERE id = auth.uid()) = 'Active'
);

CREATE POLICY "staff_can_read_active_and_self"
ON staff
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR
  status = 'Active'
);

CREATE POLICY "staff_can_update_self"
ON staff
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());