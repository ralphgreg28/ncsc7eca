/*
  # Fix stakeholders table RLS policies

  1. Changes
    - Drop existing RLS policies for stakeholders table
    - Create new comprehensive RLS policies that properly handle all operations
    
  2. Security
    - Enable RLS on stakeholders table (already enabled)
    - Add policies for:
      - SELECT: Allow authenticated users to read all stakeholder records
      - INSERT: Allow authenticated users to create new stakeholder records
      - UPDATE: Allow authenticated users to update stakeholder records
      - DELETE: Allow authenticated users to delete stakeholder records
    
  3. Notes
    - All operations require authentication
    - No additional role-based restrictions are added since the application handles access control
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON stakeholders;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON stakeholders;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON stakeholders;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON stakeholders;

-- Create new comprehensive policies
CREATE POLICY "Enable read access for authenticated users"
ON stakeholders
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON stakeholders
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
ON stakeholders
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users"
ON stakeholders
FOR DELETE
TO authenticated
USING (true);