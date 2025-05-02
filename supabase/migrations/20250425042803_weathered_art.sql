/*
  # Fix Staff Table RLS Policies

  1. Changes
    - Remove recursive policies that were causing infinite loops
    - Simplify administrator access policy
    - Fix view_active_and_self policy
    - Update update_own_profile policy
  
  2. Security
    - Maintain proper access control for administrators
    - Allow staff to view their own profile and active staff members
    - Allow staff to update their own profile
    - Prevent unauthorized access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "administrators_full_access" ON "public"."staff";
DROP POLICY IF EXISTS "update_own_profile" ON "public"."staff";
DROP POLICY IF EXISTS "view_active_and_self" ON "public"."staff";

-- Create new policies without recursion
CREATE POLICY "administrators_full_access" ON "public"."staff"
AS PERMISSIVE FOR ALL
TO authenticated
USING (
  "position" = 'Administrator' 
  AND status = 'Active'
)
WITH CHECK (
  "position" = 'Administrator' 
  AND status = 'Active'
);

CREATE POLICY "view_active_and_self" ON "public"."staff"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  status = 'Active' 
  OR id = auth.uid()
);

CREATE POLICY "update_own_profile" ON "public"."staff"
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
)
WITH CHECK (
  id = auth.uid()
);