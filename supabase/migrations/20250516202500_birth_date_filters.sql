-- Create a function to get distinct birth years from citizens table
CREATE OR REPLACE FUNCTION get_distinct_birth_years()
RETURNS TABLE (year int) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT EXTRACT(YEAR FROM birth_date)::int AS year
  FROM citizens
  ORDER BY year DESC;
END;
$$ LANGUAGE plpgsql;

-- Add an index on birth_date to improve performance of date-based queries
CREATE INDEX IF NOT EXISTS idx_citizens_birth_date ON citizens (birth_date);

-- Add an index on the month part of birth_date to improve performance of month-based queries
CREATE INDEX IF NOT EXISTS idx_citizens_birth_month ON citizens (date_part('month', birth_date));
