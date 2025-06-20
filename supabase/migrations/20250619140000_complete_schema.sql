/*
  # Complete Schema for Senior Citizen Management System

  This migration contains all tables for the website in a single file.
  It can be used to recreate the entire database schema from scratch.

  Tables included:
  1. regions - Geographic regions
  2. provinces - Provinces with region reference
  3. lgus - Local Government Units with province reference
  4. barangays - Barangays with LGU and province reference
  5. citizens - Senior citizen personal information
  6. staff - Staff member information and credentials
  7. staff_assignments - Links staff to their assigned provinces/LGUs
  8. stakeholder_positions - Available stakeholder positions per level
  9. stakeholders - Stakeholder contact information
  10. stakeholder_contacts - Multiple contact methods for stakeholders
  11. broadcast_messages - System-wide announcements
  12. broadcast_message_views - Tracks which staff have viewed messages
  13. expanded_centenarian_cash_gifts - Cash gift records for elderly citizens
*/

-- Regions table
CREATE TABLE IF NOT EXISTS regions (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

-- Provinces table
CREATE TABLE IF NOT EXISTS provinces (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  region_code TEXT NOT NULL,
  CONSTRAINT fk_region FOREIGN KEY (region_code) REFERENCES regions(code) ON DELETE CASCADE
);

-- LGUs (Local Government Units) table
CREATE TABLE IF NOT EXISTS lgus (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  province_code TEXT NOT NULL,
  CONSTRAINT fk_province FOREIGN KEY (province_code) REFERENCES provinces(code) ON DELETE CASCADE
);

-- Barangays table
CREATE TABLE IF NOT EXISTS barangays (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  province_code TEXT NOT NULL,
  lgu_code TEXT NOT NULL,
  CONSTRAINT fk_province FOREIGN KEY (province_code) REFERENCES provinces(code) ON DELETE CASCADE,
  CONSTRAINT fk_lgu FOREIGN KEY (lgu_code) REFERENCES lgus(code) ON DELETE CASCADE
);

-- Citizens table
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
    status IN ('Encoded', 'Validated', 'Cleanlisted', 'Waitlisted', 'Paid', 'Unpaid', 'Compliance', 'Disqualified')
  ),
  payment_date DATE,
  osca_id TEXT NOT NULL DEFAULT 'N/A',
  rrn TEXT NOT NULL DEFAULT 'N/A',
  validator TEXT,
  validation_date DATE,
  encoded_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encoded_by TEXT,
  CONSTRAINT remarks_length CHECK (length(remarks) <= 500),
  CONSTRAINT encoded_by_not_empty CHECK (encoded_by IS NULL OR length(encoded_by) > 0),
  CONSTRAINT fk_province FOREIGN KEY (province_code) REFERENCES provinces(code) ON DELETE RESTRICT,
  CONSTRAINT fk_lgu FOREIGN KEY (lgu_code) REFERENCES lgus(code) ON DELETE RESTRICT,
  CONSTRAINT fk_barangay FOREIGN KEY (barangay_code) REFERENCES barangays(code) ON DELETE RESTRICT
);

-- Staff table
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
  position TEXT NOT NULL CHECK (position IN ('Administrator', 'PDO', 'LGU', 'NCSC Admin')),
  status TEXT NOT NULL DEFAULT 'Inactive' CHECK (status IN ('Active', 'Inactive')),
  last_login TIMESTAMPTZ
);

-- Staff Assignments table
CREATE TABLE IF NOT EXISTS staff_assignments (
  id SERIAL PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  province_code TEXT NOT NULL REFERENCES provinces(code) ON DELETE CASCADE,
  lgu_code TEXT REFERENCES lgus(code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, province_code, COALESCE(lgu_code, ''))
);

-- Stakeholder Positions table
CREATE TABLE IF NOT EXISTS stakeholder_positions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('province', 'lgu', 'barangay')),
  UNIQUE (name, level)
);

-- Stakeholders table
CREATE TABLE IF NOT EXISTS stakeholders (
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

-- Stakeholder Contacts table
CREATE TABLE IF NOT EXISTS stakeholder_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_id UUID NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('phone', 'email')),
  value TEXT NOT NULL,
  priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 3),
  UNIQUE (stakeholder_id, type, priority)
);

-- Broadcast Messages table
CREATE TABLE IF NOT EXISTS broadcast_messages (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL
);

-- Broadcast Message Views table
CREATE TABLE IF NOT EXISTS broadcast_message_views (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES broadcast_messages(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, staff_id)
);

-- Expanded Centenarian Cash Gifts table
CREATE TABLE IF NOT EXISTS expanded_centenarian_cash_gifts (
  eca_id SERIAL PRIMARY KEY,
  citizen_id INTEGER NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  eca_year INTEGER NOT NULL,
  birth_date DATE NOT NULL,
  eca_type TEXT NOT NULL CHECK (eca_type IN (
    'octogenarian_80', 'octogenarian_85', 'nonagenarian_90', 'nonagenarian_95', 'centenarian_100'
  )),
  eca_status TEXT NOT NULL DEFAULT 'Applied' CHECK (eca_status IN (
    'Applied', 'Validated', 'Paid', 'Unpaid', 'Disqualified'
  )),
  payment_date DATE,
  cash_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,
  remarks TEXT,
  UNIQUE (citizen_id, eca_year, eca_type)
);

-- Create updated_at trigger for stakeholders
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

-- Create updated_at trigger for expanded_centenarian_cash_gifts
CREATE OR REPLACE FUNCTION update_eca_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_eca_timestamp
  BEFORE UPDATE ON expanded_centenarian_cash_gifts
  FOR EACH ROW
  EXECUTE FUNCTION update_eca_timestamp();

-- Enable Row Level Security
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE lgus ENABLE ROW LEVEL SECURITY;
ALTER TABLE barangays ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_message_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE expanded_centenarian_cash_gifts ENABLE ROW LEVEL SECURITY;

-- Create public access policies
CREATE POLICY "Allow all operations on regions" ON regions FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on provinces" ON provinces FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on lgus" ON lgus FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on barangays" ON barangays FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on citizens" ON citizens FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on staff" ON staff FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on staff_assignments" ON staff_assignments FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on stakeholder_positions" ON stakeholder_positions FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on stakeholders" ON stakeholders FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on stakeholder_contacts" ON stakeholder_contacts FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on broadcast_messages" ON broadcast_messages FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on broadcast_message_views" ON broadcast_message_views FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on expanded_centenarian_cash_gifts" ON expanded_centenarian_cash_gifts FOR ALL TO PUBLIC USING (true);

-- Add comments to tables
COMMENT ON TABLE regions IS 'Geographic regions of the Philippines';
COMMENT ON TABLE provinces IS 'Provinces within regions';
COMMENT ON TABLE lgus IS 'Local Government Units (cities/municipalities) within provinces';
COMMENT ON TABLE barangays IS 'Barangays within LGUs';
COMMENT ON TABLE citizens IS 'Senior citizen personal information and status';
COMMENT ON TABLE staff IS 'System users with authentication credentials';
COMMENT ON TABLE staff_assignments IS 'Staff assignments to provinces and LGUs';
COMMENT ON TABLE stakeholder_positions IS 'Available stakeholder position types';
COMMENT ON TABLE stakeholders IS 'Stakeholder contact information';
COMMENT ON TABLE stakeholder_contacts IS 'Contact methods for stakeholders';
COMMENT ON TABLE broadcast_messages IS 'System-wide announcements';
COMMENT ON TABLE broadcast_message_views IS 'Tracks which staff have viewed messages';
COMMENT ON TABLE expanded_centenarian_cash_gifts IS 'Cash gift records for elderly citizens';

-- Add comments to key columns
COMMENT ON COLUMN citizens.osca_id IS 'Office of Senior Citizens Affairs ID number';
COMMENT ON COLUMN citizens.rrn IS 'Regional Reference Number';
COMMENT ON COLUMN citizens.encoded_by IS 'Staff name who created the record (format: lastname, firstname middlename)';
COMMENT ON COLUMN citizens.encoded_date IS 'Date when the record was created';
COMMENT ON COLUMN citizens.validator IS 'Staff who validated the citizen record';
COMMENT ON COLUMN citizens.validation_date IS 'Date when the record was validated';
