/*
  # Add validator column to citizens table

  1. Changes
    - Add `validator` column to `citizens` table
      - Type: text
      - Nullable: true (since existing records won't have a validator)
      - Description: Stores the identifier of the user who validated the citizen record

  2. Notes
    - Using text type to match existing column patterns in the table
    - Column is nullable to maintain compatibility with existing records
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'citizens' 
    AND column_name = 'validator'
  ) THEN
    ALTER TABLE citizens ADD COLUMN validator text;
  END IF;
END $$;