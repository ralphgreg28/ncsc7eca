/*
  # Add RLS policies for stakeholders table

  1. Security Changes
    - Add policies to allow authenticated users to:
      - Insert new stakeholders
      - Update existing stakeholders
    - Maintain existing read access policy
    
  2. Notes
    - All authenticated users can create and update stakeholders
    - Existing read access policy remains unchanged
    - Delete operations remain restricted
*/

-- Policy to allow authenticated users to insert new stakeholders
CREATE POLICY "Allow authenticated users to insert stakeholders"
ON public.stakeholders
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy to allow authenticated users to update stakeholders
CREATE POLICY "Allow authenticated users to update stakeholders"
ON public.stakeholders
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);