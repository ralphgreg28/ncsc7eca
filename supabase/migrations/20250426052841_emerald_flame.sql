/*
  # Update stakeholders RLS policies

  1. Changes
    - Drop existing RLS policies
    - Create new policies that allow public access
    - Enable all operations for authenticated users
    
  2. Security
    - Allow read access for all users
    - Allow write operations for authenticated users
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for active staff" ON stakeholders;
DROP POLICY IF EXISTS "Enable insert for active staff" ON stakeholders;
DROP POLICY IF EXISTS "Enable update for active staff" ON stakeholders;
DROP POLICY IF EXISTS "Enable delete for active staff" ON stakeholders;

-- Create new policies
CREATE POLICY "Enable read access for all users"
ON stakeholders
FOR SELECT
TO public
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