/*
  # Update Staff Positions

  1. Changes
    - Update the CHECK constraint on the staff table's position field to include 'LGU' and 'NCSC Admin' as valid values
    
  2. Notes
    - This allows staff members to be registered with these additional position types
*/

-- Drop the existing CHECK constraint
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_position_check;

-- Add the updated CHECK constraint with additional position values
ALTER TABLE staff ADD CONSTRAINT staff_position_check 
  CHECK (position IN ('Administrator', 'PDO', 'LGU', 'NCSC Admin'));
