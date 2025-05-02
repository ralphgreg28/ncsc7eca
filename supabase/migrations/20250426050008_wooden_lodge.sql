/*
  # Update stakeholders RLS policies

  1. Changes
    - Drop existing RLS policies for stakeholders table
    - Create new policies that properly check staff status and permissions
    
  2. Security
    - Only active staff members can manage stakeholders
    - Maintains data integrity by checking user authentication
    - Preserves existing RLS enablement
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable delete for active users" ON stakeholders;
DROP POLICY IF EXISTS "Enable insert for active users" ON stakeholders;
DROP POLICY IF EXISTS "Enable read access for active users" ON stakeholders;
DROP POLICY IF EXISTS "Enable update for active users" ON stakeholders;

-- Create new comprehensive policies
CREATE POLICY "Enable read access for active staff"
ON stakeholders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
    AND staff.status = 'Active'
  )
);

CREATE POLICY "Enable insert for active staff"
ON stakeholders
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
    AND staff.status = 'Active'
  )
);

CREATE POLICY "Enable update for active staff"
ON stakeholders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
    AND staff.status = 'Active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
    AND staff.status = 'Active'
  )
);

CREATE POLICY "Enable delete for active staff"
ON stakeholders
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
    AND staff.status = 'Active'
  )
);