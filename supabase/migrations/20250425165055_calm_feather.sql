/*
  # Add fullname and encoded date fields to citizens table

  1. Changes
    - Add computed fullname column
    - Add encoded_date column with default value
    - Add encoded_by column to track who created the record
    
  2. Notes
    - Fullname is automatically generated from name fields
    - Encoded date is automatically set on record creation
    - Both fields are managed by the database
*/

-- Add encoded_date and encoded_by columns
ALTER TABLE citizens 
ADD COLUMN IF NOT EXISTS encoded_date TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS encoded_by TEXT;

-- Create function to generate fullname
CREATE OR REPLACE FUNCTION generate_fullname(
  last_name TEXT,
  first_name TEXT,
  middle_name TEXT,
  extension_name TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN CONCAT_WS(' ',
    UPPER(last_name) || ',',
    INITCAP(first_name),
    CASE 
      WHEN middle_name IS NOT NULL AND middle_name != '' 
      THEN INITCAP(middle_name)
      ELSE NULL 
    END,
    CASE 
      WHEN extension_name IS NOT NULL AND extension_name != '' 
      THEN '(' || extension_name || ')'
      ELSE NULL 
    END
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add computed fullname column
ALTER TABLE citizens
ADD COLUMN IF NOT EXISTS fullname TEXT GENERATED ALWAYS AS (
  generate_fullname(last_name, first_name, middle_name, extension_name)
) STORED;

-- Create index on fullname for better search performance
CREATE INDEX IF NOT EXISTS idx_citizens_fullname ON citizens(fullname);

-- Update existing records to ensure encoded_date is set
UPDATE citizens 
SET encoded_date = created_at 
WHERE encoded_date IS NULL;

-- Make encoded_date required
ALTER TABLE citizens 
ALTER COLUMN encoded_date SET NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN citizens.fullname IS 'Automatically generated full name';
COMMENT ON COLUMN citizens.encoded_date IS 'Date when the record was created';
COMMENT ON COLUMN citizens.encoded_by IS 'Username of the staff member who created the record';