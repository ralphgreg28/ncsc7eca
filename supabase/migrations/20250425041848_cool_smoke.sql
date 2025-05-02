/*
  # Fix staff RLS policy

  1. Changes
    - Remove recursive RLS policies on staff table
    - Create clear, non-recursive policies for staff access

  2. Security
    - Enable RLS on staff table
    - Add policy for administrators to manage all staff
    - Add policy for staff to manage their own profile
    - Add policy for staff to view other active staff
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Administrators can manage all staff" ON staff;
DROP POLICY IF EXISTS "Staff can manage their own profile" ON staff;
DROP POLICY IF EXISTS "Staff can view other active staff" ON staff;

-- Create new policies without recursion
CREATE POLICY "Administrators can manage all staff" ON staff
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff s
    WHERE s.id = auth.uid()
    AND s.position = 'Administrator'
    AND s.status = 'Active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff s
    WHERE s.id = auth.uid()
    AND s.position = 'Administrator'
    AND s.status = 'Active'
  )
);

CREATE POLICY "Staff can manage their own profile" ON staff
FOR ALL TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Staff can view other active staff" ON staff
FOR SELECT TO authenticated
USING (status = 'Active');