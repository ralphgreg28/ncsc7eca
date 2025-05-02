-- Create staff_assignments table to store which provinces and LGUs a PDO user can access
CREATE TABLE IF NOT EXISTS staff_assignments (
  id SERIAL PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  province_code TEXT NOT NULL REFERENCES provinces(code) ON DELETE CASCADE,
  lgu_code TEXT REFERENCES lgus(code) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure uniqueness of staff_id + province_code + lgu_code combination
  UNIQUE(staff_id, province_code, lgu_code)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_assignments_staff_id ON staff_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_province_code ON staff_assignments(province_code);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_lgu_code ON staff_assignments(lgu_code);

-- Add comment to table
COMMENT ON TABLE staff_assignments IS 'Stores which provinces and LGUs a PDO user can access and manage';
