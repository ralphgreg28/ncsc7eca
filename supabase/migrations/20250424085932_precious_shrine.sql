/*
  # Remove Sitio/Purok field from citizens table
  
  1. Changes
    - Remove sitio_purok column from citizens table
    
  2. Notes
    - This is a non-reversible change
    - Existing sitio_purok data will be permanently removed
*/

ALTER TABLE citizens DROP COLUMN IF EXISTS sitio_purok;