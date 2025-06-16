/*
  # Add Disqualified status to citizens table

  1. Changes
    - Add 'Disqualified' as a valid status value
    - Update existing status check constraint
    
  2. Notes
    - Non-destructive change that maintains existing data
    - Existing records will keep their current status
*/

-- Drop existing status check constraint
ALTER TABLE citizens DROP CONSTRAINT IF EXISTS citizens_status_check;

-- Add new status check constraint with Disqualified option
ALTER TABLE citizens ADD CONSTRAINT citizens_status_check 
  CHECK (status IN ('Encoded', 'Validated', 'Cleanlisted', 'Paid', 'Unpaid', 'Compliance', 'Disqualified'));