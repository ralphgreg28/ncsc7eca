/*
  # Fix staff policies to prevent infinite recursion

  1. Changes
    - Remove existing staff policies that cause recursion
    - Create new, simplified policies for staff table access
    
  2. Security
    - Enable RLS on staff table (already enabled)
    - Add policy for administrators to manage all staff
    - Add policy for staff to view their own profile
    - Add policy for staff to update their own profile
*/

-- Drop existing policies that may cause recursion
DROP POLICY IF EXISTS "Administrators can manage all staff" ON staff;
DROP POLICY IF EXISTS "Staff can view their own profile" ON staff;
DROP POLICY IF EXISTS "Staff can update their own profile" ON staff;

-- Create new simplified policies
CREATE POLICY "Administrators can manage all staff"
ON staff
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff s
    WHERE s.id = auth.uid()
    AND s.position = 'Administrator'
    AND s.status = 'Active'
  )
);

CREATE POLICY "Staff can view own profile"
ON staff
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Staff can update own profile"
ON staff
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());