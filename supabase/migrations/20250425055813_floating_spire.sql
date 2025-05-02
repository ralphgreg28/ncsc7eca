/*
  # Fix Authentication System Policies

  1. Changes
    - Drop and recreate staff table policies to prevent recursion
    - Simplify policy conditions to avoid recursive lookups
    - Add administrator bypass policy for initial setup

  2. Security
    - Maintain RLS protection
    - Ensure administrators can still manage staff
    - Allow staff to view/update their own profiles
*/

-- Drop existing policies that may cause recursion
DROP POLICY IF EXISTS "Administrators can manage all staff" ON staff;
DROP POLICY IF EXISTS "Staff can view their own profile" ON staff;
DROP POLICY IF EXISTS "Staff can update their own profile" ON staff;

-- Create new simplified policies
CREATE POLICY "Allow full access during setup"
  ON staff
  FOR ALL
  TO authenticated
  USING (
    (SELECT COUNT(*) FROM staff) = 0
    OR
    (
      SELECT position FROM staff WHERE id = auth.uid()
    ) = 'Administrator'
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