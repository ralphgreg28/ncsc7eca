-- Function to get distinct calendar years from citizens table
CREATE OR REPLACE FUNCTION get_distinct_calendar_years()
RETURNS TABLE (calendar_year INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT c.calendar_year
  FROM citizens c
  WHERE c.calendar_year IS NOT NULL
  ORDER BY c.calendar_year ASC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_distinct_calendar_years() TO authenticated;
