/*
  # Fix Staff RLS Policies

  1. Changes
    - Drop existing problematic staff policies
    - Create new, optimized policies for staff management
    
  2. Security
    - Enable RLS on staff table
    - Add policy for administrators to manage all staff
    - Add policy for staff to manage their own profile
    - Add policy for viewing active staff members
*/

-- First, drop all existing policies to start fresh
DROP POLICY IF EXISTS "Administrators can manage all staff" ON staff;
DROP POLICY IF EXISTS "Staff can manage their own profile" ON staff;
DROP POLICY IF EXISTS "Staff can view other active staff" ON staff;

-- Ensure RLS is enabled
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Create new policies with optimized conditions
CREATE POLICY "Administrators can manage all staff"
ON staff
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM staff s
    WHERE s.id = auth.uid()
    AND s.position = 'Administrator'
    AND s.status = 'Active'
    LIMIT 1
  )
);

CREATE POLICY "Staff can manage their own profile"
ON staff
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Staff can view other active staff"
ON staff
FOR SELECT
TO authenticated
USING (status = 'Active');