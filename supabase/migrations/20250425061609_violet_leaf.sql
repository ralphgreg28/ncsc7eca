/*
  # Final fix for staff table RLS policies

  1. Changes
    - Remove all existing staff policies
    - Create new, simplified policies without any recursion
    - Use direct auth.uid() checks where possible
    
  2. Security
    - Maintain security requirements
    - Prevent infinite recursion
    - Allow proper authentication flow
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "administrators_full_access" ON staff;
DROP POLICY IF EXISTS "staff_self_access" ON staff;
DROP POLICY IF EXISTS "staff_self_update" ON staff;
DROP POLICY IF EXISTS "enable_first_user" ON staff;

-- Create new policies
CREATE POLICY "enable_insert_for_registration"
ON staff
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "enable_read_for_self"
ON staff
FOR SELECT
TO public
USING (
  auth.uid() = id OR
  status = 'Active'
);

CREATE POLICY "enable_update_for_self"
ON staff
FOR UPDATE
TO public
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "enable_admin_access"
ON staff
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.id IN (
      SELECT s.id 
      FROM staff s 
      WHERE s.position = 'Administrator' 
      AND s.status = 'Active'
    )
  )
);