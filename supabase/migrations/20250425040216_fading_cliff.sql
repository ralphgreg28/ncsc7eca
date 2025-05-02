/*
  # Authentication and User Management System

  1. New Tables
    - `staff`
      - Stores staff member information
      - Includes personal details, role, and status
    - `staff_provinces`
      - Links PDO staff members to their assigned provinces
    - `audit_logs`
      - Tracks system activities for monitoring

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access
    - Set up foreign key constraints
*/

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  username TEXT UNIQUE NOT NULL,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  extension_name TEXT,
  birth_date DATE NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
  position TEXT NOT NULL CHECK (position IN ('Administrator', 'PDO', 'Focal')),
  agency_lgu TEXT,
  status TEXT NOT NULL DEFAULT 'Inactive' CHECK (status IN ('Active', 'Inactive')),
  CONSTRAINT check_agency_lgu CHECK (
    (position = 'Focal' AND agency_lgu IS NOT NULL) OR
    (position != 'Focal')
  )
);

-- Staff Provinces table (for PDO assignments)
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

-- Enable Row Level Security
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies for staff table
CREATE POLICY "Staff can view their own profile"
  ON staff
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Administrators can view all staff"
  ON staff
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE id = auth.uid()
      AND position = 'Administrator'
      AND status = 'Active'
    )
  );

CREATE POLICY "Administrators can manage staff"
  ON staff
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE id = auth.uid()
      AND position = 'Administrator'
      AND status = 'Active'
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
      SELECT 1 FROM staff
      WHERE id = auth.uid()
      AND position = 'Administrator'
      AND status = 'Active'
    )
  );

-- Policies for audit_logs table
CREATE POLICY "Administrators can view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE id = auth.uid()
      AND position = 'Administrator'
      AND status = 'Active'
    )
  );

CREATE POLICY "System can create audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert initial administrator account
INSERT INTO staff (
  username,
  last_name,
  first_name,
  middle_name,
  birth_date,
  sex,
  position,
  status
) VALUES (
  'rjdgregorio',
  'Gregorio',
  'Ralph Jiene',
  'Dela Cruz',
  '1992-09-16',
  'Male',
  'Administrator',
  'Active'
) ON CONFLICT (username) DO NOTHING;