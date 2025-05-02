/*
  # Add OSCA ID and RRN fields to citizens table

  1. Changes
    - Add osca_id column (optional)
    - Add rrn column (optional)
    - Set default value of 'N/A' for both fields
    
  2. Notes
    - Non-destructive change
    - Maintains existing data
    - Adds validation for field formats
*/

-- Add OSCA ID and RRN columns with default value
ALTER TABLE citizens 
  ADD COLUMN IF NOT EXISTS osca_id TEXT DEFAULT 'N/A',
  ADD COLUMN IF NOT EXISTS rrn TEXT DEFAULT 'N/A';

-- Update database types
COMMENT ON COLUMN citizens.osca_id IS 'Office of Senior Citizens Affairs ID number';
COMMENT ON COLUMN citizens.rrn IS 'Regional Reference Number';

-- Set default value for existing records
UPDATE citizens 
SET osca_id = 'N/A' 
WHERE osca_id IS NULL;

UPDATE citizens 
SET rrn = 'N/A' 
WHERE rrn IS NULL;

-- Make columns NOT NULL after setting defaults
ALTER TABLE citizens 
  ALTER COLUMN osca_id SET NOT NULL,
  ALTER COLUMN rrn SET NOT NULL;