/*
  # Update stakeholders RLS policies for public access

  1. Changes
    - Drop existing RLS policies
    - Create new policies that allow public access for all operations
    - Remove authentication requirements
    
  2. Security
    - Allow all operations for all users
    - No authentication required
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON stakeholders;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON stakeholders;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON stakeholders;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON stakeholders;

-- Create new policies for public access
CREATE POLICY "Allow public read access"
ON stakeholders
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public insert"
ON stakeholders
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public update"
ON stakeholders
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete"
ON stakeholders
FOR DELETE
TO public
USING (true);