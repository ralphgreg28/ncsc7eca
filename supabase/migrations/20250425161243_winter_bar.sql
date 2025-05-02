/*
  # Update staff table and administrator account
  
  1. Changes
    - Drop existing policies to avoid conflicts
    - Recreate staff table if it doesn't exist
    - Update administrator account with correct password
    
  2. Security
    - Enable RLS
    - Add policies for public access
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON staff;
DROP POLICY IF EXISTS "Enable self-update" ON staff;
DROP POLICY IF EXISTS "Enable registration" ON staff;

-- Create staff table
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  extension_name TEXT,
  birth_date DATE NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
  position TEXT NOT NULL CHECK (position IN ('Administrator', 'PDO')),
  status TEXT NOT NULL DEFAULT 'Inactive' CHECK (status IN ('Active', 'Inactive')),
  last_login TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users"
  ON staff FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable self-update"
  ON staff FOR UPDATE
  TO public
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable registration"
  ON staff FOR INSERT
  TO public
  WITH CHECK (true);

-- Insert administrator account
INSERT INTO staff (
  username,
  password_hash,
  email,
  first_name,
  last_name,
  birth_date,
  sex,
  position,
  status
) VALUES (
  'rjdgregorio',
  '@Wtfwasthat16',
  'rjdgregorio@example.com',
  'Ralph Jiene',
  'Gregorio',
  '1992-09-16',
  'Male',
  'Administrator',
  'Active'
) ON CONFLICT (username) DO UPDATE
SET 
  password_hash = '@Wtfwasthat16',
  status = 'Active';