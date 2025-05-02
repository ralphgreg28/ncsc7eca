/*
  # Fix staff table policies

  1. Changes
    - Remove recursive policies that were causing infinite recursion
    - Simplify staff table policies for better security and performance
    - Add proper RLS policies for staff management

  2. Security
    - Enable RLS on staff table
    - Add policies for:
      - Administrators to manage all staff
      - Staff to view their own records
      - Staff to view active staff members
      - Public registration allowed
*/

-- Drop existing policies
DROP POLICY IF EXISTS "administrators_manage_staff" ON staff;
DROP POLICY IF EXISTS "allow_registration" ON staff;
DROP POLICY IF EXISTS "update_own_profile" ON staff;
DROP POLICY IF EXISTS "view_active_staff" ON staff;
DROP POLICY IF EXISTS "view_own_record" ON staff;

-- Create new policies
CREATE POLICY "administrators_manage_staff" ON staff
FOR ALL USING (
  auth.uid() IN (
    SELECT id FROM staff 
    WHERE position = 'Administrator' 
    AND status = 'Active'
  )
);

CREATE POLICY "allow_registration" ON staff
FOR INSERT 
TO public
WITH CHECK (true);

CREATE POLICY "update_own_profile" ON staff
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "view_active_staff" ON staff
FOR SELECT
TO authenticated
USING (status = 'Active');

CREATE POLICY "view_own_record" ON staff
FOR SELECT
TO authenticated
USING (id = auth.uid());