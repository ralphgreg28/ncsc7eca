/*
  # Add remarks field to citizens table

  1. Changes
    - Add remarks column to citizens table
    - Make it nullable and text type
    - Add validation to ensure remarks don't exceed 500 characters

  2. Notes
    - This is a non-destructive change
    - Existing records will have null remarks
*/

ALTER TABLE citizens ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE citizens ADD CONSTRAINT remarks_length CHECK (length(remarks) <= 500);