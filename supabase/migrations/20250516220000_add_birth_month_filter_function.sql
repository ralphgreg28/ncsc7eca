-- Create a function to filter citizens by birth month
CREATE OR REPLACE FUNCTION filter_citizens_by_birth_month(months integer[])
RETURNS TABLE (id bigint) 
LANGUAGE sql
STABLE
AS $$
  SELECT id 
  FROM citizens 
  WHERE EXTRACT(MONTH FROM birth_date) = ANY(months);
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION filter_citizens_by_birth_month(integer[]) TO authenticated;
