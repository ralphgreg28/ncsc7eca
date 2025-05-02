/*
  # Fix Staff RLS Policies

  1. Changes
    - Drop existing staff policies that cause infinite recursion
    - Create new, simplified policies for staff management
    
  2. Security
    - Enable RLS on staff table (in case it was disabled)
    - Add policy for administrators to manage all staff
    - Add policy for staff to view their own profile
    - Add policy for staff to view other active staff members
*/

-- First, drop existing policies that may cause recursion
DROP POLICY IF EXISTS "Administrators can manage staff" ON staff;
DROP POLICY IF EXISTS "Administrators can view all staff" ON staff;
DROP POLICY IF EXISTS "Staff can view their own profile" ON staff;

-- Ensure RLS is enabled
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Create new, simplified policies
CREATE POLICY "Staff can manage their own profile"
ON staff
FOR ALL
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

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

CREATE POLICY "Staff can view other active staff"
ON staff
FOR SELECT
TO authenticated
USING (status = 'Active');