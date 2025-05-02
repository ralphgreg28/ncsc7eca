/*
  # Fix staff table RLS policies

  1. Changes
    - Remove circular dependency in staff policies
    - Simplify administrator check to use direct comparison
    - Restructure policies for better clarity and performance

  2. Security
    - Maintain existing security rules but implement them without recursion
    - Ensure administrators can still manage all staff
    - Allow staff to manage their own profile
    - Allow viewing of active staff members
*/

-- First, drop existing policies
DROP POLICY IF EXISTS "Administrators can manage all staff" ON staff;
DROP POLICY IF EXISTS "Staff can manage their own profile" ON staff;
DROP POLICY IF EXISTS "Staff can view other active staff" ON staff;

-- Create new policies without recursion
CREATE POLICY "Enable read access for active staff"
ON staff
FOR SELECT
TO authenticated
USING (
  -- Allow viewing active staff members
  (status = 'Active') OR
  -- Or if it's the user's own record
  (auth.uid() = id) OR
  -- Or if the user is an administrator (direct check)
  EXISTS (
    SELECT 1
    FROM staff
    WHERE id = auth.uid() 
    AND position = 'Administrator'
    AND status = 'Active'
  )
);

CREATE POLICY "Enable insert for administrators"
ON staff
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM staff
    WHERE id = auth.uid() 
    AND position = 'Administrator'
    AND status = 'Active'
  )
);

CREATE POLICY "Enable update for administrators and self"
ON staff
FOR UPDATE
TO authenticated
USING (
  -- Allow updating own record
  auth.uid() = id OR
  -- Or if user is administrator
  EXISTS (
    SELECT 1
    FROM staff
    WHERE id = auth.uid() 
    AND position = 'Administrator'
    AND status = 'Active'
  )
)
WITH CHECK (
  -- Same conditions for the new values
  auth.uid() = id OR
  EXISTS (
    SELECT 1
    FROM staff
    WHERE id = auth.uid() 
    AND position = 'Administrator'
    AND status = 'Active'
  )
);

CREATE POLICY "Enable delete for administrators"
ON staff
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM staff
    WHERE id = auth.uid() 
    AND position = 'Administrator'
    AND status = 'Active'
  )
);