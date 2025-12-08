-- Create function to get provincial paid by month statistics
CREATE OR REPLACE FUNCTION get_provincial_paid_by_month_stats(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_province_code TEXT DEFAULT NULL,
  p_lgu_code TEXT DEFAULT NULL,
  p_barangay_code TEXT DEFAULT NULL,
  p_calendar_years INTEGER[] DEFAULT ARRAY[2024, 2025, 2026, 2027, 2028]
)
RETURNS TABLE (
  province_name TEXT,
  province_code TEXT,
  calendar_year INTEGER,
  jan BIGINT,
  feb BIGINT,
  mar BIGINT,
  apr BIGINT,
  may BIGINT,
  jun BIGINT,
  jul BIGINT,
  aug BIGINT,
  sep BIGINT,
  oct BIGINT,
  nov BIGINT,
  "dec" BIGINT,
  total_paid BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_citizens AS (
    SELECT 
      c.id,
      c.province_code AS citizen_province_code,
      c.calendar_year,
      c.birth_date,
      p.name AS province_name
    FROM citizens c
    INNER JOIN provinces p ON c.province_code = p.code
    WHERE 
      c.status = 'Paid'
      AND c.birth_date IS NOT NULL
      AND (p_start_date IS NULL OR c.payment_date >= p_start_date)
      AND (p_end_date IS NULL OR c.payment_date <= p_end_date)
      AND (p_province_code IS NULL OR c.province_code = p_province_code)
      AND (p_lgu_code IS NULL OR c.lgu_code = p_lgu_code)
      AND (p_barangay_code IS NULL OR c.barangay_code = p_barangay_code)
      AND c.calendar_year = ANY(p_calendar_years)
  )
  SELECT 
    fc.province_name,
    fc.citizen_province_code AS province_code,
    fc.calendar_year,
    COUNT(*) FILTER (WHERE EXTRACT(MONTH FROM fc.birth_date) = 1) AS jan,
    COUNT(*) FILTER (WHERE EXTRACT(MONTH FROM fc.birth_date) = 2) AS feb,
    COUNT(*) FILTER (WHERE EXTRACT(MONTH FROM fc.birth_date) = 3) AS mar,
    COUNT(*) FILTER (WHERE EXTRACT(MONTH FROM fc.birth_date) = 4) AS apr,
    COUNT(*) FILTER (WHERE EXTRACT(MONTH FROM fc.birth_date) = 5) AS may,
    COUNT(*) FILTER (WHERE EXTRACT(MONTH FROM fc.birth_date) = 6) AS jun,
    COUNT(*) FILTER (WHERE EXTRACT(MONTH FROM fc.birth_date) = 7) AS jul,
    COUNT(*) FILTER (WHERE EXTRACT(MONTH FROM fc.birth_date) = 8) AS aug,
    COUNT(*) FILTER (WHERE EXTRACT(MONTH FROM fc.birth_date) = 9) AS sep,
    COUNT(*) FILTER (WHERE EXTRACT(MONTH FROM fc.birth_date) = 10) AS oct,
    COUNT(*) FILTER (WHERE EXTRACT(MONTH FROM fc.birth_date) = 11) AS nov,
    COUNT(*) FILTER (WHERE EXTRACT(MONTH FROM fc.birth_date) = 12) AS "dec",
    COUNT(*) AS total_paid
  FROM filtered_citizens fc
  GROUP BY fc.province_name, fc.citizen_province_code, fc.calendar_year
  ORDER BY fc.province_name, fc.calendar_year;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_provincial_paid_by_month_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_provincial_paid_by_month_stats TO anon;

-- Add comment
COMMENT ON FUNCTION get_provincial_paid_by_month_stats IS 'Returns paid citizens grouped by province, calendar year, and birth month';
