-- Fix dashboard function signatures to have consistent parameters
-- Add p_age_start and p_age_end to functions that are missing them

-- Drop existing versions of the functions to avoid "function name is not unique" errors
DROP FUNCTION IF EXISTS get_dashboard_payment_stats(
  timestamptz, timestamptz, text, text, text, text[], date, date, int[]
);

DROP FUNCTION IF EXISTS get_dashboard_province_stats(
  timestamptz, timestamptz, text, text, text, text[], date, date, int[]
);

DROP FUNCTION IF EXISTS get_dashboard_lgu_stats(
  text, timestamptz, timestamptz, text, text, text[], date, date, int[]
);

-- Update get_dashboard_payment_stats to include age parameters
CREATE OR REPLACE FUNCTION get_dashboard_payment_stats(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_province_code text DEFAULT NULL,
  p_lgu_code text DEFAULT NULL,
  p_barangay_code text DEFAULT NULL,
  p_status_filter text[] DEFAULT NULL,
  p_payment_date_start date DEFAULT NULL,
  p_payment_date_end date DEFAULT NULL,
  p_age_start int DEFAULT NULL,
  p_age_end int DEFAULT NULL,
  p_calendar_years int[] DEFAULT ARRAY[2024, 2025, 2026, 2027, 2028]
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result json;
BEGIN
  WITH filtered_citizens AS (
    SELECT 
      status,
      birth_date,
      calendar_year
    FROM citizens
    WHERE 
      (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
      AND (p_province_code IS NULL OR province_code = p_province_code)
      AND (p_lgu_code IS NULL OR lgu_code = p_lgu_code)
      AND (p_barangay_code IS NULL OR barangay_code = p_barangay_code)
      AND (p_status_filter IS NULL OR status = ANY(p_status_filter))
      AND (p_payment_date_start IS NULL OR payment_date >= p_payment_date_start)
      AND (p_payment_date_end IS NULL OR payment_date <= p_payment_date_end)
      AND calendar_year = ANY(p_calendar_years)
  ),
  age_filtered AS (
    SELECT *
    FROM filtered_citizens fc
    WHERE (
      p_age_start IS NULL OR p_age_end IS NULL OR
      EXISTS (
        SELECT 1
        FROM unnest(p_calendar_years) AS year
        WHERE (year - EXTRACT(YEAR FROM fc.birth_date)::int) >= COALESCE(p_age_start, 0)
          AND (year - EXTRACT(YEAR FROM fc.birth_date)::int) <= COALESCE(p_age_end, 200)
      )
    )
  ),
  status_counts AS (
    SELECT 
      status,
      COUNT(*)::int as count,
      SUM(
        CASE 
          WHEN (
            SELECT MAX(year - EXTRACT(YEAR FROM fc.birth_date)::int)
            FROM unnest(p_calendar_years) AS year
          ) >= 100 THEN 100000
          WHEN (
            SELECT MAX(year - EXTRACT(YEAR FROM fc.birth_date)::int)
            FROM unnest(p_calendar_years) AS year
          ) >= 80 THEN 10000
          ELSE 0
        END
      )::bigint as amount
    FROM age_filtered fc
    GROUP BY status
  )
  SELECT json_build_object(
    'paid', COALESCE((SELECT count FROM status_counts WHERE status = 'Paid'), 0),
    'unpaid', COALESCE((SELECT count FROM status_counts WHERE status = 'Unpaid'), 0),
    'encoded', COALESCE((SELECT count FROM status_counts WHERE status = 'Encoded'), 0),
    'validated', COALESCE((SELECT count FROM status_counts WHERE status = 'Validated'), 0),
    'cleanlisted', COALESCE((SELECT count FROM status_counts WHERE status = 'Cleanlisted'), 0),
    'waitlisted', COALESCE((SELECT count FROM status_counts WHERE status = 'Waitlisted'), 0),
    'compliance', COALESCE((SELECT count FROM status_counts WHERE status = 'Compliance'), 0),
    'disqualified', COALESCE((SELECT count FROM status_counts WHERE status = 'Disqualified'), 0),
    'total', (SELECT COUNT(*)::int FROM age_filtered),
    'paidAmount', COALESCE((SELECT amount FROM status_counts WHERE status = 'Paid'), 0),
    'unpaidAmount', COALESCE((SELECT amount FROM status_counts WHERE status = 'Unpaid'), 0),
    'encodedAmount', COALESCE((SELECT amount FROM status_counts WHERE status = 'Encoded'), 0),
    'validatedAmount', COALESCE((SELECT amount FROM status_counts WHERE status = 'Validated'), 0),
    'cleanlistedAmount', COALESCE((SELECT amount FROM status_counts WHERE status = 'Cleanlisted'), 0),
    'waitlistedAmount', COALESCE((SELECT amount FROM status_counts WHERE status = 'Waitlisted'), 0),
    'complianceAmount', COALESCE((SELECT amount FROM status_counts WHERE status = 'Compliance'), 0),
    'disqualifiedAmount', COALESCE((SELECT amount FROM status_counts WHERE status = 'Disqualified'), 0)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Update get_dashboard_province_stats to include age parameters
CREATE OR REPLACE FUNCTION get_dashboard_province_stats(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_province_code text DEFAULT NULL,
  p_lgu_code text DEFAULT NULL,
  p_barangay_code text DEFAULT NULL,
  p_status_filter text[] DEFAULT NULL,
  p_payment_date_start date DEFAULT NULL,
  p_payment_date_end date DEFAULT NULL,
  p_age_start int DEFAULT NULL,
  p_age_end int DEFAULT NULL,
  p_calendar_years int[] DEFAULT ARRAY[2024, 2025, 2026, 2027, 2028]
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result json;
BEGIN
  WITH filtered_citizens AS (
    SELECT 
      province_code,
      status,
      birth_date,
      calendar_year
    FROM citizens
    WHERE 
      (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
      AND (p_province_code IS NULL OR province_code = p_province_code)
      AND (p_lgu_code IS NULL OR lgu_code = p_lgu_code)
      AND (p_barangay_code IS NULL OR barangay_code = p_barangay_code)
      AND (p_status_filter IS NULL OR status = ANY(p_status_filter))
      AND (p_payment_date_start IS NULL OR payment_date >= p_payment_date_start)
      AND (p_payment_date_end IS NULL OR payment_date <= p_payment_date_end)
      AND calendar_year = ANY(p_calendar_years)
  ),
  age_filtered AS (
    SELECT *
    FROM filtered_citizens fc
    WHERE (
      p_age_start IS NULL OR p_age_end IS NULL OR
      EXISTS (
        SELECT 1
        FROM unnest(p_calendar_years) AS year
        WHERE (year - EXTRACT(YEAR FROM fc.birth_date)::int) >= COALESCE(p_age_start, 0)
          AND (year - EXTRACT(YEAR FROM fc.birth_date)::int) <= COALESCE(p_age_end, 200)
      )
    )
  )
  SELECT json_agg(
    json_build_object(
      'name', p.name,
      'paid', COALESCE(stats.paid, 0),
      'unpaid', COALESCE(stats.unpaid, 0),
      'encoded', COALESCE(stats.encoded, 0),
      'validated', COALESCE(stats.validated, 0),
      'cleanlisted', COALESCE(stats.cleanlisted, 0),
      'waitlisted', COALESCE(stats.waitlisted, 0),
      'compliance', COALESCE(stats.compliance, 0),
      'disqualified', COALESCE(stats.disqualified, 0),
      'total', COALESCE(stats.total, 0)
    ) ORDER BY p.name
  )
  INTO result
  FROM provinces p
  LEFT JOIN (
    SELECT 
      province_code,
      COUNT(*) FILTER (WHERE status = 'Paid')::int as paid,
      COUNT(*) FILTER (WHERE status = 'Unpaid')::int as unpaid,
      COUNT(*) FILTER (WHERE status = 'Encoded')::int as encoded,
      COUNT(*) FILTER (WHERE status = 'Validated')::int as validated,
      COUNT(*) FILTER (WHERE status = 'Cleanlisted')::int as cleanlisted,
      COUNT(*) FILTER (WHERE status = 'Waitlisted')::int as waitlisted,
      COUNT(*) FILTER (WHERE status = 'Compliance')::int as compliance,
      COUNT(*) FILTER (WHERE status = 'Disqualified')::int as disqualified,
      COUNT(*)::int as total
    FROM age_filtered
    GROUP BY province_code
  ) stats ON p.code = stats.province_code;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Update get_dashboard_lgu_stats to include age parameters
CREATE OR REPLACE FUNCTION get_dashboard_lgu_stats(
  p_province_code text,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_lgu_code text DEFAULT NULL,
  p_barangay_code text DEFAULT NULL,
  p_status_filter text[] DEFAULT NULL,
  p_payment_date_start date DEFAULT NULL,
  p_payment_date_end date DEFAULT NULL,
  p_age_start int DEFAULT NULL,
  p_age_end int DEFAULT NULL,
  p_calendar_years int[] DEFAULT ARRAY[2024, 2025, 2026, 2027, 2028]
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result json;
BEGIN
  WITH filtered_citizens AS (
    SELECT 
      lgu_code,
      status,
      birth_date,
      calendar_year
    FROM citizens
    WHERE 
      province_code = p_province_code
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
      AND (p_lgu_code IS NULL OR lgu_code = p_lgu_code)
      AND (p_barangay_code IS NULL OR barangay_code = p_barangay_code)
      AND (p_status_filter IS NULL OR status = ANY(p_status_filter))
      AND (p_payment_date_start IS NULL OR payment_date >= p_payment_date_start)
      AND (p_payment_date_end IS NULL OR payment_date <= p_payment_date_end)
      AND calendar_year = ANY(p_calendar_years)
  ),
  age_filtered AS (
    SELECT *
    FROM filtered_citizens fc
    WHERE (
      p_age_start IS NULL OR p_age_end IS NULL OR
      EXISTS (
        SELECT 1
        FROM unnest(p_calendar_years) AS year
        WHERE (year - EXTRACT(YEAR FROM fc.birth_date)::int) >= COALESCE(p_age_start, 0)
          AND (year - EXTRACT(YEAR FROM fc.birth_date)::int) <= COALESCE(p_age_end, 200)
      )
    )
  )
  SELECT json_agg(
    json_build_object(
      'name', l.name,
      'paid', COALESCE(stats.paid, 0),
      'unpaid', COALESCE(stats.unpaid, 0),
      'encoded', COALESCE(stats.encoded, 0),
      'validated', COALESCE(stats.validated, 0),
      'cleanlisted', COALESCE(stats.cleanlisted, 0),
      'waitlisted', COALESCE(stats.waitlisted, 0),
      'compliance', COALESCE(stats.compliance, 0),
      'disqualified', COALESCE(stats.disqualified, 0),
      'total', COALESCE(stats.total, 0)
    ) ORDER BY l.name
  )
  INTO result
  FROM lgus l
  LEFT JOIN (
    SELECT 
      lgu_code,
      COUNT(*) FILTER (WHERE status = 'Paid')::int as paid,
      COUNT(*) FILTER (WHERE status = 'Unpaid')::int as unpaid,
      COUNT(*) FILTER (WHERE status = 'Encoded')::int as encoded,
      COUNT(*) FILTER (WHERE status = 'Validated')::int as validated,
      COUNT(*) FILTER (WHERE status = 'Cleanlisted')::int as cleanlisted,
      COUNT(*) FILTER (WHERE status = 'Waitlisted')::int as waitlisted,
      COUNT(*) FILTER (WHERE status = 'Compliance')::int as compliance,
      COUNT(*) FILTER (WHERE status = 'Disqualified')::int as disqualified,
      COUNT(*)::int as total
    FROM age_filtered
    GROUP BY lgu_code
  ) stats ON l.code = stats.lgu_code
  WHERE l.province_code = p_province_code;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_dashboard_payment_stats TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_dashboard_province_stats TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_dashboard_lgu_stats TO authenticated, anon;
