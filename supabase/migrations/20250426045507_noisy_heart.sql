/*
  # Fix stakeholders table RLS policies

  1. Changes
    - Remove existing RLS policies for stakeholders table
    - Add new policies for authenticated users:
      - Allow insert for authenticated users
      - Allow update for authenticated users
      - Allow read access for all users
    
  2. Security
    - Ensures only authenticated users can create/update stakeholders
    - Maintains public read access
    - Prevents unauthorized modifications
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read access to stakeholders" ON stakeholders;
DROP POLICY IF EXISTS "Allow authenticated users to insert stakeholders" ON stakeholders;
DROP POLICY IF EXISTS "Allow authenticated users to update stakeholders" ON stakeholders;
DROP POLICY IF EXISTS "Allow public update to stakeholders" ON stakeholders;

-- Create new policies
CREATE POLICY "Enable read access for all users" 
ON stakeholders FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Enable insert for authenticated users" 
ON stakeholders FOR INSERT 
TO authenticated 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" 
ON stakeholders FOR UPDATE 
TO authenticated 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');