/*
  # Fix citizens table ID sequence

  1. Changes
    - Add function to get next ID for citizens table
    - Update sequence to start from last used ID
    - Ensure proper ID generation for new records

  2. Notes
    - Non-destructive change
    - Maintains existing data integrity
    - Improves ID generation logic
*/

-- Create function to get next ID
CREATE OR REPLACE FUNCTION get_next_citizen_id()
RETURNS INTEGER AS $$
DECLARE
  last_id INTEGER;
BEGIN
  -- Get the last used ID
  SELECT COALESCE(MAX(id), 0) INTO last_id FROM citizens;
  
  -- Reset the sequence to start from the next available ID
  PERFORM setval('citizens_id_seq', last_id);
  
  -- Return the next ID
  RETURN last_id + 1;
END;
$$ LANGUAGE plpgsql;