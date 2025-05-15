/*
  Fix multiple permissive policies issue on stakeholder_contacts table
  
  Problem: Table public.stakeholder_contacts has multiple permissive policies for role anon 
  for action SELECT. Policies include {"Allow public read access to contacts","Allow public update to contacts"}
  
  Solution: Drop the overly permissive "ALL" policy and replace it with specific policies for UPDATE, INSERT, and DELETE
*/

-- Drop the overly permissive policy
DROP POLICY "Allow public update to contacts" ON stakeholder_contacts;

-- Create specific policies for each action type
CREATE POLICY "Allow public update to contacts" ON stakeholder_contacts
  FOR UPDATE TO public USING (true);

CREATE POLICY "Allow public insert to contacts" ON stakeholder_contacts
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public delete to contacts" ON stakeholder_contacts
  FOR DELETE TO public USING (true);

-- The existing "Allow public read access to contacts" policy remains for SELECT operations
