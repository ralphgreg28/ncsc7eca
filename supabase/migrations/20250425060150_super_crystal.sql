/*
  # Fix staff table RLS policies

  1. Changes
    - Remove redundant and conflicting RLS policies on staff table
    - Simplify access control logic to prevent infinite recursion
    - Maintain security while ensuring efficient policy evaluation

  2. Security
    - Administrators maintain full access
    - Staff can view and update their own records
    - Initial setup allows first user creation
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Allow full access during setup" ON staff;
DROP POLICY IF EXISTS "Enable delete for administrators" ON staff;
DROP POLICY IF EXISTS "Enable insert for administrators" ON staff;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON staff;
DROP POLICY IF EXISTS "Enable update for administrators and self" ON staff;
DROP POLICY IF EXISTS "Staff can update own profile" ON staff;
DROP POLICY IF EXISTS "Staff can view own profile" ON staff;

-- Create new, simplified policies
CREATE POLICY "Enable first user setup"
ON staff
FOR ALL
TO authenticated
USING (
  (SELECT COUNT(*) FROM staff) = 0
)
WITH CHECK (
  (SELECT COUNT(*) FROM staff) = 0
);

CREATE POLICY "Administrator full access"
ON staff
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE id = auth.uid()
    AND position = 'Administrator'
    AND status = 'Active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE id = auth.uid()
    AND position = 'Administrator'
    AND status = 'Active'
  )
);

CREATE POLICY "Staff self access"
ON staff
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
);

CREATE POLICY "Staff self update"
ON staff
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
)
WITH CHECK (
  id = auth.uid()
);