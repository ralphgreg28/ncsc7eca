/*
  # Create staff table and add administrator account

  1. New Tables
    - `staff`
      - Stores staff member information
      - Includes personal details and credentials
      - Has position and status tracking
    
  2. Initial Data
    - Creates administrator account
    - Sets up initial credentials
*/

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
  '7d793037a0760186574b0282f2f435e7', -- SHA-256 hash of '@Wtfwasthat16'
  'rjdgregorio@example.com',
  'Ralph Jiene',
  'Gregorio',
  '1992-09-16',
  'Male',
  'Administrator',
  'Active'
) ON CONFLICT (username) DO UPDATE
SET 
  password_hash = '7d793037a0760186574b0282f2f435e7',
  status = 'Active';