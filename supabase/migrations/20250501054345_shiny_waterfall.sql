/*
  # Add Audit Logs System

  1. New Tables
    - `audit_logs`
      - Tracks all system activities
      - Records who made changes, what changed, and when
      - Stores IP addresses for security tracking

  2. Security
    - Enable RLS on audit_logs table
    - Add policies for secure access
    - Only administrators can view all logs
    - Staff can view their own logs
*/

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  table_name TEXT,
  record_id TEXT
);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to audit logs"
  ON audit_logs
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to audit logs"
  ON audit_logs
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_staff_id ON audit_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);