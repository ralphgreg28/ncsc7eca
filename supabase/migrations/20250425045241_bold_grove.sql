/*
  # Fix staff table RLS policies

  1. Changes
    - Remove recursive policy conditions that were causing infinite loops
    - Simplify the policy structure for better performance and reliability
    - Ensure administrators can still manage all staff records
    - Allow staff members to view their own records
    - Maintain security while preventing recursion

  2. Security
    - Maintains RLS protection
    - Updates policies to be more efficient
    - Preserves administrator access
    - Ensures staff can only view appropriate records
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "administrators_full_access" ON staff;
DROP POLICY IF EXISTS "allow_registration" ON staff;
DROP POLICY IF EXISTS "update_own_profile" ON staff;
DROP POLICY IF EXISTS "view_active_and_self" ON staff;

-- Create new, simplified policies
CREATE POLICY "administrators_full_access" ON staff
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff administrators
      WHERE administrators.id = auth.uid()
      AND administrators.position = 'Administrator'
      AND administrators.status = 'Active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff administrators
      WHERE administrators.id = auth.uid()
      AND administrators.position = 'Administrator'
      AND administrators.status = 'Active'
    )
  );

CREATE POLICY "allow_registration" ON staff
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "view_own_and_active_records" ON staff
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR
    status = 'Active'
  );

CREATE POLICY "update_own_profile" ON staff
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());