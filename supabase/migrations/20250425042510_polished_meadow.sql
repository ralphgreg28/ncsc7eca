/*
  # Fix staff table RLS policies

  1. Changes
    - Remove recursive policies that were causing infinite loops
    - Implement new, more efficient policies for staff management
    
  2. Security
    - Maintain existing security model but with optimized policy conditions
    - Ensure administrators can still manage all staff
    - Allow staff to view active members and their own profile
    - Allow staff to update their own profile
*/

-- Drop existing policies
DROP POLICY IF EXISTS "administrators_can_manage" ON staff;
DROP POLICY IF EXISTS "staff_can_read_active_and_self" ON staff;
DROP POLICY IF EXISTS "staff_can_update_self" ON staff;

-- Create new policies without recursion
CREATE POLICY "enable_read_for_authenticated" ON staff
  FOR SELECT TO authenticated
  USING (
    -- Allow access to active staff members and own profile
    status = 'Active' OR id = auth.uid()
  );

CREATE POLICY "enable_insert_for_administrators" ON staff
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Check if the user has an administrator record without recursion
    EXISTS (
      SELECT 1 FROM staff
      WHERE id = auth.uid()
        AND position = 'Administrator'
        AND status = 'Active'
    )
  );

CREATE POLICY "enable_update_for_administrators_and_self" ON staff
  FOR UPDATE TO authenticated
  USING (
    -- Allow administrators to update any record, and users to update their own
    (
      EXISTS (
        SELECT 1 FROM staff
        WHERE id = auth.uid()
          AND position = 'Administrator'
          AND status = 'Active'
      )
    ) OR id = auth.uid()
  )
  WITH CHECK (
    -- Same conditions for the check clause
    (
      EXISTS (
        SELECT 1 FROM staff
        WHERE id = auth.uid()
          AND position = 'Administrator'
          AND status = 'Active'
      )
    ) OR id = auth.uid()
  );

CREATE POLICY "enable_delete_for_administrators" ON staff
  FOR DELETE TO authenticated
  USING (
    -- Only administrators can delete records
    EXISTS (
      SELECT 1 FROM staff
      WHERE id = auth.uid()
        AND position = 'Administrator'
        AND status = 'Active'
    )
  );