/*
  # Add password handling for staff registration

  1. Changes
    - Add password_hash field to staff table
    - Update existing records with a default hash
    - Add constraint to ensure password is not empty
    
  2. Notes
    - Uses a temporary default hash for existing records
    - Ensures no constraint violations
*/

-- Add password field initially without constraint
ALTER TABLE staff ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Update existing records with a default hash
UPDATE staff 
SET password_hash = encode(sha256(('changeme' || username)::bytea), 'hex')
WHERE password_hash IS NULL OR password_hash = '';

-- Now make the column required and add the constraint
ALTER TABLE staff ALTER COLUMN password_hash SET NOT NULL;
ALTER TABLE staff ADD CONSTRAINT password_not_empty CHECK (password_hash != '');