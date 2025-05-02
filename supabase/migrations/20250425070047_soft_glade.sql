/*
  # Staff Management System Schema

  1. New Tables
    - `staff`
      - Stores staff member information and credentials
    - `audit_logs`
      - Tracks system activities and changes
    - `sessions`
      - Manages active user sessions

  2. Security
    - Enable RLS on all tables
    - Add policies for secure access
    - Password hashing with SHA-256
*/

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  extension_name TEXT,
  birth_date DATE NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
  contact_number TEXT,
  position TEXT NOT NULL CHECK (position IN ('Administrator', 'Staff')),
  status TEXT NOT NULL DEFAULT 'Inactive' CHECK (status IN ('Active', 'Inactive')),
  last_login TIMESTAMPTZ,
  force_password_change BOOLEAN DEFAULT TRUE
);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL
);

-- Enable Row Level Security
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access to active staff" ON staff;
DROP POLICY IF EXISTS "Administrators can manage staff" ON staff;
DROP POLICY IF EXISTS "Staff can view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Administrators can view all audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can create audit logs" ON audit_logs;

-- Create policies
CREATE POLICY "Public read access to active staff"
  ON staff FOR SELECT
  TO public
  USING (status = 'Active');

CREATE POLICY "Administrators can manage staff"
  ON staff FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.id = auth.uid()
      AND s.position = 'Administrator'
      AND s.status = 'Active'
    )
  );

CREATE POLICY "Staff can view audit logs"
  ON audit_logs FOR SELECT
  TO public
  USING (staff_id = auth.uid());

CREATE POLICY "Administrators can view all audit logs"
  ON audit_logs FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.id = auth.uid()
      AND s.position = 'Administrator'
      AND s.status = 'Active'
    )
  );

CREATE POLICY "System can create audit logs"
  ON audit_logs FOR INSERT
  TO public
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_staff_updated_at ON staff;
CREATE TRIGGER update_staff_updated_at
    BEFORE UPDATE ON staff
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial administrator
INSERT INTO staff (
  username,
  password_hash,
  email,
  first_name,
  last_name,
  middle_name,
  birth_date,
  sex,
  position,
  status,
  force_password_change
) VALUES (
  'rjdgregorio',
  '96cae35ce8a9b0244178bf28e4966c2ce1b8385723a96a6b838858cdd6ca0a1e', -- SHA-256 hash of '112233'
  'rjdgregorio@example.com',
  'Ralph Jiene',
  'Gregorio',
  'Dela Cruz',
  '1992-09-16',
  'Male',
  'Administrator',
  'Active',
  true
) ON CONFLICT (username) DO NOTHING;