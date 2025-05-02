/*
  # Add Stakeholders Directory Schema

  1. New Tables
    - `stakeholder_positions`
      - Defines available stakeholder positions per level
    - `stakeholders`
      - Stores stakeholder contact information
    - `stakeholder_contacts`
      - Stores multiple contact numbers and emails

  2. Security
    - Enable RLS on all tables
    - Add policies for secure access
*/

-- Create stakeholder_positions table
CREATE TABLE stakeholder_positions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('province', 'lgu', 'barangay')),
  UNIQUE (name, level)
);

-- Create stakeholders table
CREATE TABLE stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  position_id INTEGER NOT NULL REFERENCES stakeholder_positions(id),
  province_code TEXT NOT NULL REFERENCES provinces(code),
  lgu_code TEXT REFERENCES lgus(code),
  barangay_code TEXT REFERENCES barangays(code),
  name TEXT NOT NULL,
  CONSTRAINT valid_hierarchy CHECK (
    (lgu_code IS NULL AND barangay_code IS NULL) OR -- Province level
    (lgu_code IS NOT NULL AND barangay_code IS NULL) OR -- LGU level
    (lgu_code IS NOT NULL AND barangay_code IS NOT NULL) -- Barangay level
  )
);

-- Create stakeholder_contacts table
CREATE TABLE stakeholder_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_id UUID NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('phone', 'email')),
  value TEXT NOT NULL,
  priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 3),
  UNIQUE (stakeholder_id, type, priority)
);

-- Enable RLS
ALTER TABLE stakeholder_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to positions" ON stakeholder_positions
  FOR SELECT TO public USING (true);

CREATE POLICY "Allow public read access to stakeholders" ON stakeholders
  FOR SELECT TO public USING (true);

CREATE POLICY "Allow public update to stakeholders" ON stakeholders
  FOR UPDATE TO public USING (true);

CREATE POLICY "Allow public read access to contacts" ON stakeholder_contacts
  FOR SELECT TO public USING (true);

CREATE POLICY "Allow public update to contacts" ON stakeholder_contacts
  FOR ALL TO public USING (true);

-- Insert default positions
INSERT INTO stakeholder_positions (name, level) VALUES
  ('PSWDO', 'province'),
  ('Mayor', 'lgu'),
  ('C/MSWDO', 'lgu'),
  ('OSCA Head', 'lgu'),
  ('Federated President', 'lgu'),
  ('Focal Person', 'lgu'),
  ('Chapter President', 'barangay'),
  ('Barangay Worker', 'barangay');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_stakeholder_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stakeholder_timestamp
  BEFORE UPDATE ON stakeholders
  FOR EACH ROW
  EXECUTE FUNCTION update_stakeholder_timestamp();