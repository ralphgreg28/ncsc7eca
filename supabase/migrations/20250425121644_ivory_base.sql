/*
  # Add validation date column to citizens table

  1. Changes
    - Add `validation_date` column to `citizens` table
      - Type: date
      - Nullable: true
      - No default value

  2. Notes
    - Using IF NOT EXISTS to prevent errors if column already exists
    - Column is nullable since not all records may have a validation date
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'citizens' 
    AND column_name = 'validation_date'
  ) THEN
    ALTER TABLE citizens ADD COLUMN validation_date date;
  END IF;
END $$;