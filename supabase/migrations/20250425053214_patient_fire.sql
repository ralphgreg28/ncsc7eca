/*
  # Authentication System Setup

  1. New Tables
    - `staff`
      - Stores staff member information and credentials
      - Includes personal details, role, and status
    - `staff_provinces`
      - Links PDO staff to assigned provinces
    - `audit_logs`
      - Tracks system activities and login attempts
    - `failed_login_attempts`
      - Tracks failed login attempts for rate limiting

  2. Security
    - Enable RLS on all tables
    - Add policies for secure access
    - Password hashing with SHA-256
    - Rate limiting support
*/

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  extension_name TEXT,
  birth_date DATE NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
  position TEXT NOT NULL CHECK (position IN ('Administrator', 'PDO')),
  status TEXT NOT NULL DEFAULT 'Inactive' CHECK (status IN ('Active', 'Inactive')),
  email_verified BOOLEAN DEFAULT FALSE,
  force_password_change BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMPTZ,
  last_password_change TIMESTAMPTZ,
  created_by UUID REFERENCES staff(id)
);

-- Staff Provinces table
CREATE TABLE IF NOT EXISTS staff_provinces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  province_code TEXT NOT NULL REFERENCES provinces(code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, province_code)
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

-- Failed Login Attempts table
CREATE TABLE IF NOT EXISTS failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  identifier TEXT NOT NULL, -- username or email
  ip_address TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 1
);

-- Enable Row Level Security
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for staff table
CREATE POLICY "Staff can view their own profile"
  ON staff
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Staff can update their own profile"
  ON staff
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Administrators can manage all staff"
  ON staff
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.id = auth.uid()
      AND s.position = 'Administrator'
      AND s.status = 'Active'
    )
  );

-- Policies for staff_provinces table
CREATE POLICY "Staff can view their province assignments"
  ON staff_provinces
  FOR SELECT
  TO authenticated
  USING (staff_id = auth.uid());

CREATE POLICY "Administrators can manage province assignments"
  ON staff_provinces
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.id = auth.uid()
      AND s.position = 'Administrator'
      AND s.status = 'Active'
    )
  );

-- Policies for audit_logs table
CREATE POLICY "Administrators can view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.id = auth.uid()
      AND s.position = 'Administrator'
      AND s.status = 'Active'
    )
  );

CREATE POLICY "System can create audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policies for failed_login_attempts table
CREATE POLICY "System can manage failed login attempts"
  ON failed_login_attempts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert initial administrator account
INSERT INTO staff (
  email,
  username,
  password_hash,
  last_name,
  first_name,
  middle_name,
  birth_date,
  sex,
  position,
  status,
  force_password_change
) VALUES (
  'rjdgregorio@ncsc.gov.ph',
  'rjdgregorio',
  '96cae35ce8a9b0244178bf28e4966c2ce1b8385723a96a6b838858cdd6ca0a1e', -- SHA-256 hash of '112233'
  'Gregorio',
  'Ralph Jiene',
  'Dela Cruz',
  '1992-09-16',
  'Male',
  'Administrator',
  'Active',
  true
) ON CONFLICT (username) DO NOTHING;