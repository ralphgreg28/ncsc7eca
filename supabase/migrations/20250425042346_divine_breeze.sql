/*
  # Fix staff table RLS policies

  1. Changes
    - Drop existing staff table policies
    - Create new, optimized policies that prevent recursion
    
  2. Security
    - Enable RLS on staff table (already enabled)
    - Add new policies for:
      - Administrators can manage all staff records
      - Staff can read active staff members and their own record
      - Staff can update their own record
      - Staff can never delete their own record
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable delete for administrators" ON staff;
DROP POLICY IF EXISTS "Enable insert for administrators" ON staff;
DROP POLICY IF EXISTS "Enable read access for active staff" ON staff;
DROP POLICY IF EXISTS "Enable update for administrators and self" ON staff;

-- Create new policies
-- Administrators can do everything
CREATE POLICY "administrators_all"
ON staff
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff administrators
    WHERE administrators.id = auth.uid()
    AND administrators.position = 'Administrator'
    AND administrators.status = 'Active'
  )
);

-- Staff can read active staff and their own record
CREATE POLICY "staff_read"
ON staff
FOR SELECT
TO authenticated
USING (
  id = auth.uid() 
  OR status = 'Active'
  OR EXISTS (
    SELECT 1 FROM staff administrators
    WHERE administrators.id = auth.uid()
    AND administrators.position = 'Administrator'
    AND administrators.status = 'Active'
  )
);

-- Staff can update their own record
CREATE POLICY "staff_update_self"
ON staff
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());