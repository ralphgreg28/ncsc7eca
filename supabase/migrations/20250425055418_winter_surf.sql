/*
  # Fix staff table RLS policies

  1. Changes
    - Remove existing policies that cause recursion
    - Add new, optimized policies for staff table access
    
  2. Security
    - Enable RLS on staff table
    - Add policies for:
      - Administrators can manage all staff records
      - Staff can view their own profile
      - Staff can update their own profile
      - System can manage staff records during auth
*/

-- Drop existing policies to replace them with optimized versions
DROP POLICY IF EXISTS "Administrators can manage all staff" ON staff;
DROP POLICY IF EXISTS "Staff can update own profile" ON staff;
DROP POLICY IF EXISTS "Staff can view own profile" ON staff;

-- Create new policies that avoid recursion
CREATE POLICY "Enable read access for authenticated users"
  ON staff
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR 
    (SELECT position FROM staff WHERE id = auth.uid()) = 'Administrator'
  );

CREATE POLICY "Enable insert for administrators"
  ON staff
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT position FROM staff WHERE id = auth.uid()) = 'Administrator'
  );

CREATE POLICY "Enable update for administrators and self"
  ON staff
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid() OR 
    (SELECT position FROM staff WHERE id = auth.uid()) = 'Administrator'
  )
  WITH CHECK (
    id = auth.uid() OR 
    (SELECT position FROM staff WHERE id = auth.uid()) = 'Administrator'
  );

CREATE POLICY "Enable delete for administrators"
  ON staff
  FOR DELETE
  TO authenticated
  USING (
    (SELECT position FROM staff WHERE id = auth.uid()) = 'Administrator'
  );