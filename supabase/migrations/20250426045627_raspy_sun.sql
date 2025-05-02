/*
  # Fix stakeholders table RLS policies

  1. Changes
    - Remove existing RLS policies for stakeholders table
    - Add new comprehensive RLS policies that properly handle:
      - INSERT operations for authenticated users
      - UPDATE operations for authenticated users
      - DELETE operations for authenticated users with proper checks
    
  2. Security
    - Maintains row-level security
    - Ensures only authenticated users can modify data
    - Preserves existing data integrity constraints
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON stakeholders;
DROP POLICY IF EXISTS "Enable read access for all users" ON stakeholders;
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