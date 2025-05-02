/*
  # Fix stakeholders table RLS policies

  1. Changes
    - Drop existing RLS policies
    - Add new policies that check user status
    - Allow active users to perform all operations
    
  2. Security
    - Only active users can manage stakeholders
    - Maintains data integrity
    - Prevents unauthorized access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON stakeholders;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON stakeholders;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON stakeholders;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON stakeholders;

-- Create new policies that check user status
CREATE POLICY "Enable read access for active users"
ON stakeholders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE id = auth.uid()
    AND status = 'Active'
  )
);

CREATE POLICY "Enable insert for active users"
ON stakeholders
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE id = auth.uid()
    AND status = 'Active'
  )
);

CREATE POLICY "Enable update for active users"
ON stakeholders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE id = auth.uid()
    AND status = 'Active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE id = auth.uid()
    AND status = 'Active'
  )
);

CREATE POLICY "Enable delete for active users"
ON stakeholders
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE id = auth.uid()
    AND status = 'Active'
  )
);