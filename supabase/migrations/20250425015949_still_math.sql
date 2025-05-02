/*
  # Add payment status and date fields to citizens table

  1. Changes
    - Add status column with predefined values
    - Add payment_date column
    - Add check constraint for status values

  2. Notes
    - Status options: Encoded, Validated, Cleanlisted, Paid, Unpaid, Liquidated
    - Payment date can be null
*/

ALTER TABLE citizens ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Encoded' CHECK (status IN ('Encoded', 'Validated', 'Cleanlisted', 'Paid', 'Unpaid', 'Liquidated'));
ALTER TABLE citizens ADD COLUMN IF NOT EXISTS payment_date DATE;