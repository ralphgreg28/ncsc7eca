/*
  # Update citizens table schema
  
  1. Changes
    - Add OSCA ID and RRN fields
    - Add foreign key constraints
    - Add column comments
    - Update status options to include 'Disqualified'
    
  2. Security
    - Enable RLS
    - Update public access policy
*/

-- Create citizens table
CREATE TABLE IF NOT EXISTS citizens (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  extension_name TEXT,
  birth_date DATE NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
  province_code TEXT NOT NULL,
  lgu_code TEXT NOT NULL,
  barangay_code TEXT NOT NULL,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'Encoded' CHECK (
    status IN ('Encoded', 'Validated', 'Cleanlisted', 'Paid', 'Unpaid', 'Compliance', 'Disqualified')
  ),
  payment_date DATE,
  osca_id TEXT NOT NULL DEFAULT 'N/A',
  rrn TEXT NOT NULL DEFAULT 'N/A',
  CONSTRAINT remarks_length CHECK (length(remarks) <= 500),
  CONSTRAINT fk_province FOREIGN KEY (province_code) REFERENCES provinces(code) ON DELETE RESTRICT,
  CONSTRAINT fk_lgu FOREIGN KEY (lgu_code) REFERENCES lgus(code) ON DELETE RESTRICT,
  CONSTRAINT fk_barangay FOREIGN KEY (barangay_code) REFERENCES barangays(code) ON DELETE RESTRICT
);

-- Add column comments
COMMENT ON COLUMN citizens.osca_id IS 'Office of Senior Citizens Affairs ID number';
COMMENT ON COLUMN citizens.rrn IS 'Regional Reference Number';

-- Enable RLS
ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow all operations on citizens" ON citizens;

-- Create public access policy
CREATE POLICY "Allow all operations on citizens"
  ON citizens
  FOR ALL
  TO public
  USING (true);