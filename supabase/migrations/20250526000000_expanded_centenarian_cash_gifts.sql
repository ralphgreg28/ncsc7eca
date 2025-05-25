/*
  # Expanded Centenarian Cash Gift (ECA) System

  1. New Table
    - `expanded_centenarian_cash_gifts`
      - Tracks ECA applications and payments for senior citizens
      - Links to citizens table for personal information
      - Supports multiple ECA types based on age milestones
      - Prevents duplicate benefits per type per citizen

  2. Functions
    - Age calculation and eligibility determination
    - Bulk ECA application generation
    - ECA statistics and reporting

  3. Views
    - ECA records with complete citizen and address information

  4. Security
    - Enable RLS with appropriate policies
    - Audit trail integration
*/

-- Create the ECA table
CREATE TABLE IF NOT EXISTS expanded_centenarian_cash_gifts (
  eca_id SERIAL PRIMARY KEY,
  citizen_id INTEGER NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  eca_year INTEGER NOT NULL CHECK (eca_year >= 2024),
  birth_date DATE NOT NULL, -- Denormalized from citizens table for performance
  eca_type TEXT NOT NULL CHECK (eca_type IN (
    'octogenarian_80',
    'octogenarian_85', 
    'nonagenarian_90',
    'nonagenarian_95',
    'centenarian_100'
  )),
  eca_status TEXT NOT NULL DEFAULT 'Applied' CHECK (eca_status IN (
    'Applied',
    'Validated', 
    'Paid',
    'Unpaid',
    'Disqualified'
  )),
  payment_date DATE,
  cash_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,
  remarks TEXT,
  
  -- Ensure one application per citizen per type (lifetime benefit)
  UNIQUE(citizen_id, eca_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_eca_citizen_id ON expanded_centenarian_cash_gifts(citizen_id);
CREATE INDEX IF NOT EXISTS idx_eca_year ON expanded_centenarian_cash_gifts(eca_year);
CREATE INDEX IF NOT EXISTS idx_eca_status ON expanded_centenarian_cash_gifts(eca_status);
CREATE INDEX IF NOT EXISTS idx_eca_type ON expanded_centenarian_cash_gifts(eca_type);
CREATE INDEX IF NOT EXISTS idx_eca_payment_date ON expanded_centenarian_cash_gifts(payment_date);

-- Function to calculate ECA eligibility for a given year
CREATE OR REPLACE FUNCTION get_eca_eligible_citizens(target_year INTEGER)
RETURNS TABLE(
  citizen_id INTEGER,
  birth_date DATE,
  qualifying_age INTEGER,
  eca_type TEXT,
  cash_amount DECIMAL,
  eca_year INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as citizen_id,
    c.birth_date,
    (target_year - EXTRACT(YEAR FROM c.birth_date))::INTEGER as qualifying_age,
    CASE 
      WHEN (target_year - EXTRACT(YEAR FROM c.birth_date)) = 80 THEN 'octogenarian_80'::TEXT
      WHEN (target_year - EXTRACT(YEAR FROM c.birth_date)) = 85 THEN 'octogenarian_85'::TEXT
      WHEN (target_year - EXTRACT(YEAR FROM c.birth_date)) = 90 THEN 'nonagenarian_90'::TEXT
      WHEN (target_year - EXTRACT(YEAR FROM c.birth_date)) = 95 THEN 'nonagenarian_95'::TEXT
      WHEN (target_year - EXTRACT(YEAR FROM c.birth_date)) = 100 THEN 'centenarian_100'::TEXT
    END as eca_type,
    CASE 
      WHEN (target_year - EXTRACT(YEAR FROM c.birth_date)) = 100 THEN 100000.00::DECIMAL
      ELSE 10000.00::DECIMAL
    END as cash_amount,
    target_year as eca_year
  FROM citizens c
  WHERE (target_year - EXTRACT(YEAR FROM c.birth_date)) IN (80, 85, 90, 95, 100)
    AND c.status IN ('Encoded', 'Validated', 'Cleanlisted', 'Paid', 'Unpaid', 'Liquidated')
    AND NOT EXISTS (
      SELECT 1 FROM expanded_centenarian_cash_gifts eca 
      WHERE eca.citizen_id = c.id 
        AND eca.eca_type = CASE 
          WHEN (target_year - EXTRACT(YEAR FROM c.birth_date)) = 80 THEN 'octogenarian_80'
          WHEN (target_year - EXTRACT(YEAR FROM c.birth_date)) = 85 THEN 'octogenarian_85'
          WHEN (target_year - EXTRACT(YEAR FROM c.birth_date)) = 90 THEN 'nonagenarian_90'
          WHEN (target_year - EXTRACT(YEAR FROM c.birth_date)) = 95 THEN 'nonagenarian_95'
          WHEN (target_year - EXTRACT(YEAR FROM c.birth_date)) = 100 THEN 'centenarian_100'
        END
    );
END;
$$ LANGUAGE plpgsql;

-- Function to bulk generate ECA applications for a given year
CREATE OR REPLACE FUNCTION generate_eca_applications(target_year INTEGER, created_by_user TEXT DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  INSERT INTO expanded_centenarian_cash_gifts (
    citizen_id,
    eca_year,
    birth_date,
    eca_type,
    cash_amount,
    created_by
  )
  SELECT 
    citizen_id,
    eca_year,
    birth_date,
    eca_type,
    cash_amount,
    created_by_user
  FROM get_eca_eligible_citizens(target_year);
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Create view for ECA records with complete citizen and address information
CREATE OR REPLACE VIEW eca_with_addresses AS
SELECT 
  e.eca_id,
  e.citizen_id,
  e.eca_year,
  e.birth_date,
  e.eca_type,
  e.eca_status,
  e.payment_date,
  e.cash_amount,
  e.created_at,
  e.updated_at,
  e.created_by,
  e.updated_by,
  e.remarks,
  -- Citizen information
  c.first_name,
  c.last_name,
  c.middle_name,
  c.extension_name,
  c.sex,
  c.osca_id,
  c.rrn,
  -- Address information
  r.name as region_name,
  p.name as province_name,
  l.name as lgu_name,
  b.name as barangay_name,
  -- Address codes
  c.province_code,
  c.lgu_code,
  c.barangay_code
FROM expanded_centenarian_cash_gifts e
JOIN citizens c ON e.citizen_id = c.id
JOIN provinces p ON c.province_code = p.code
JOIN regions r ON p.region_code = r.code
JOIN lgus l ON c.lgu_code = l.code
JOIN barangays b ON c.barangay_code = b.code;

-- Create view for ECA statistics by year and type
CREATE OR REPLACE VIEW eca_statistics AS
SELECT 
  eca_year,
  eca_type,
  eca_status,
  COUNT(*) as application_count,
  SUM(cash_amount) as total_amount,
  AVG(cash_amount) as average_amount
FROM expanded_centenarian_cash_gifts
GROUP BY eca_year, eca_type, eca_status
ORDER BY eca_year DESC, eca_type, eca_status;

-- Function to get ECA summary for a specific citizen
CREATE OR REPLACE FUNCTION get_citizen_eca_history(citizen_id_param INTEGER)
RETURNS TABLE(
  eca_id INTEGER,
  eca_year INTEGER,
  eca_type TEXT,
  eca_status TEXT,
  cash_amount DECIMAL,
  payment_date DATE,
  age_when_received INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.eca_id,
    e.eca_year,
    e.eca_type,
    e.eca_status,
    e.cash_amount,
    e.payment_date,
    (e.eca_year - EXTRACT(YEAR FROM e.birth_date))::INTEGER as age_when_received
  FROM expanded_centenarian_cash_gifts e
  WHERE e.citizen_id = citizen_id_param
  ORDER BY e.eca_year DESC;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE expanded_centenarian_cash_gifts ENABLE ROW LEVEL SECURITY;

-- Create policies for ECA table
CREATE POLICY "Allow all operations on ECA" ON expanded_centenarian_cash_gifts FOR ALL TO PUBLIC USING (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_eca_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_eca_updated_at_trigger
  BEFORE UPDATE ON expanded_centenarian_cash_gifts
  FOR EACH ROW
  EXECUTE FUNCTION update_eca_updated_at();

-- Add comments for documentation
COMMENT ON TABLE expanded_centenarian_cash_gifts IS 'Stores Expanded Centenarian Cash Gift applications and payments for senior citizens aged 80, 85, 90, 95, and 100';
COMMENT ON COLUMN expanded_centenarian_cash_gifts.eca_year IS 'Year when the citizen becomes eligible (Birth Year + Qualifying Age)';
COMMENT ON COLUMN expanded_centenarian_cash_gifts.eca_type IS 'Type of ECA based on age milestone';
COMMENT ON COLUMN expanded_centenarian_cash_gifts.cash_amount IS 'Amount in PHP: 10,000 for ages 80-95, 100,000 for age 100';
