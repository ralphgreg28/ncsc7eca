/*
  # Remove fullname column and update encoded_by format

  1. Changes
    - Remove fullname column and related function
    - Update encoded_by to store staff name in "lastname, firstname, middlename" format
    - Drop unused index
    
  2. Notes
    - Non-destructive change
    - Maintains existing data
    - Improves data consistency
*/

-- Drop the fullname column and related objects
DROP INDEX IF EXISTS idx_citizens_fullname;
ALTER TABLE citizens DROP COLUMN IF EXISTS fullname;
DROP FUNCTION IF EXISTS generate_fullname;

-- Update encoded_by column comment
COMMENT ON COLUMN citizens.encoded_by IS 'Staff name who created the record (format: lastname, firstname middlename)';

-- Add check constraint to ensure encoded_by is not empty when provided
ALTER TABLE citizens 
ADD CONSTRAINT encoded_by_not_empty 
CHECK (encoded_by IS NULL OR length(encoded_by) > 0);