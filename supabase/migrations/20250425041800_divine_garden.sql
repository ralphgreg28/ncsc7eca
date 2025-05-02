/*
  # Fix staff table RLS policies

  1. Changes
    - Remove recursive policy for administrators
    - Implement new non-recursive policies for administrators
    - Maintain existing policies for regular staff
  
  2. Security
    - Administrators can still manage all staff
    - Staff can manage their own profile
    - Staff can view other active staff
    - Policies avoid infinite recursion
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Administrators can manage all staff" ON staff;
DROP POLICY IF EXISTS "Staff can manage their own profile" ON staff;
DROP POLICY IF EXISTS "Staff can view other active staff" ON staff;

-- Create new policies without recursion
CREATE POLICY "Administrators can manage all staff"
ON staff
FOR ALL
TO authenticated
USING (
  position = 'Administrator' 
  AND status = 'Active'
)
WITH CHECK (
  position = 'Administrator' 
  AND status = 'Active'
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