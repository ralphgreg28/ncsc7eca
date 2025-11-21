-- Step 1: Check if the function exists
SELECT 
    p.proname as function_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_provincial_paid_by_age_stats';

-- Step 2: Drop the function if it exists (to ensure clean creation)
DROP FUNCTION IF EXISTS get_provincial_paid_by_age_stats(
  TIMESTAMP WITH TIME ZONE,
  TIMESTAMP WITH TIME ZONE,
  TEXT,
  TEXT,
  TEXT,
  INTEGER[]
);

-- Step 3: Create the function
CREATE OR REPLACE FUNCTION get_provincial_paid_by_age_stats(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_province_code TEXT DEFAULT NULL,
  p_lgu_code TEXT DEFAULT NULL,
  p_barangay_code TEXT DEFAULT NULL,
  p_calendar_years INTEGER[] DEFAULT ARRAY[2024, 2025, 2026, 2027, 2028]
)
RETURNS TABLE (
  province_name TEXT,
  province_code TEXT,
  calendar_year INTEGER,
  age_80 INTEGER,
  age_85 INTEGER,
  age_90 INTEGER,
  age_95 INTEGER,
  age_100 INTEGER,
  total_paid INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH province_age_stats AS (
    SELECT 
      p.name AS province_name,
      p.code AS province_code,
      c.calendar_year,
      COUNT(*) FILTER (WHERE (c.calendar_year - EXTRACT(YEAR FROM c.birth_date)::INTEGER) = 80) AS age_80,
      COUNT(*) FILTER (WHERE (c.calendar_year - EXTRACT(YEAR FROM c.birth_date)::INTEGER) = 85) AS age_85,
      COUNT(*) FILTER (WHERE (c.calendar_year - EXTRACT(YEAR FROM c.birth_date)::INTEGER) = 90) AS age_90,
      COUNT(*) FILTER (WHERE (c.calendar_year - EXTRACT(YEAR FROM c.birth_date)::INTEGER) = 95) AS age_95,
      COUNT(*) FILTER (WHERE (c.calendar_year - EXTRACT(YEAR FROM c.birth_date)::INTEGER) = 100) AS age_100,
      COUNT(*) AS total_paid
    FROM citizens c
    INNER JOIN provinces p ON c.province_code = p.code
    WHERE 
      c.status = 'Paid'
      AND c.calendar_year = ANY(p_calendar_years)
      AND (c.calendar_year - EXTRACT(YEAR FROM c.birth_date)::INTEGER) IN (80, 85, 90, 95, 100)
      AND (p_start_date IS NULL OR c.created_at >= p_start_date)
      AND (p_end_date IS NULL OR c.created_at <= p_end_date)
      AND (p_province_code IS NULL OR c.province_code = p_province_code)
      AND (p_lgu_code IS NULL OR c.lgu_code = p_lgu_code)
      AND (p_barangay_code IS NULL OR c.barangay_code = p_barangay_code)
    GROUP BY p.name, p.code, c.calendar_year
  )
  SELECT 
    pas.province_name,
    pas.province_code,
    pas.calendar_year,
    COALESCE(pas.age_80, 0)::INTEGER,
    COALESCE(pas.age_85, 0)::INTEGER,
    COALESCE(pas.age_90, 0)::INTEGER,
    COALESCE(pas.age_95, 0)::INTEGER,
    COALESCE(pas.age_100, 0)::INTEGER,
    COALESCE(pas.total_paid, 0)::INTEGER
  FROM province_age_stats pas
  ORDER BY pas.province_name, pas.calendar_year;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION get_provincial_paid_by_age_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_provincial_paid_by_age_stats TO anon;

-- Step 5: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
