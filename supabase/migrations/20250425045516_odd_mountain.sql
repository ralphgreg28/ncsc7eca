/*
  # Add email field to staff table

  1. Changes
    - Add email column to staff table
    - Make email unique and required
    - Update existing records with generated email
    
  2. Security
    - Maintains existing RLS policies
    - Ensures email uniqueness
*/

-- Add email column
ALTER TABLE staff ADD COLUMN IF NOT EXISTS email TEXT;

-- Update existing records with generated email
UPDATE staff 
SET email = username || '@ncsc.gov.ph'
WHERE email IS NULL;

-- Make email required and unique
ALTER TABLE staff ALTER COLUMN email SET NOT NULL;
ALTER TABLE staff ADD CONSTRAINT staff_email_key UNIQUE (email);