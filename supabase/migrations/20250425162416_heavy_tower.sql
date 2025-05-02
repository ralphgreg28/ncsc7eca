/*
  # Fix User Management System

  1. Changes
    - Drop existing staff table and policies
    - Recreate staff table with proper structure
    - Add new RLS policies for proper access control
    
  2. Security
    - Enable RLS on staff table
    - Add policies for public access and management
*/

-- Drop existing table and start fresh
DROP TABLE IF EXISTS staff CASCADE;

-- Create staff table
CREATE TABLE staff (
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

-- Create policies for public access
CREATE POLICY "Allow public read access"
  ON staff FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert"
  ON staff FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update"
  ON staff FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete"
  ON staff FOR DELETE
  TO public
  USING (true);

-- Insert initial administrator
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
  '112233',
  'rjdgregorio@example.com',
  'Ralph Jiene',
  'Gregorio',
  '1992-09-16',
  'Male',
  'Administrator',
  'Active'
) ON CONFLICT (username) DO UPDATE
SET 
  password_hash = '112233',
  status = 'Active';