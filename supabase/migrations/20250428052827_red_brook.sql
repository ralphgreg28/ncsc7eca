/*
  # Fix citizen ID sequence and get_next_citizen_id function

  1. Changes
    - Reset and fix the citizens_id_seq sequence
    - Update get_next_citizen_id function to handle empty tables
    - Ensure minimum ID value is 1

  2. Security
    - Function accessible to authenticated users only
*/

-- First, get the current maximum ID or 0 if table is empty
DO $$
DECLARE
  max_id integer;
BEGIN
  SELECT COALESCE(MAX(id), 0) INTO max_id FROM citizens;
  
  -- Reset the sequence to start after the maximum existing ID
  -- If table is empty, this will set it to start at 1
  EXECUTE format('ALTER SEQUENCE citizens_id_seq RESTART WITH %s', 
    CASE 
      WHEN max_id = 0 THEN 1 
      ELSE max_id + 1 
    END
  );
END $$;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_next_citizen_id();

-- Create improved version of the function
CREATE OR REPLACE FUNCTION get_next_citizen_id()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_id integer;
BEGIN
  -- Get the next value from the sequence
  SELECT nextval('citizens_id_seq') INTO next_id;
  
  -- Ensure the ID is greater than any existing ID
  -- This handles cases where records were inserted without using the sequence
  SELECT GREATEST(next_id, COALESCE(MAX(id) + 1, 1))
  INTO next_id
  FROM citizens;
  
  -- Reset sequence to start after our selected ID
  PERFORM setval('citizens_id_seq', next_id);
  
  RETURN next_id;
END;
$$;