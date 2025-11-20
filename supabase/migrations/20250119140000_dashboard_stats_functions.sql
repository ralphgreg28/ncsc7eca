-- Dashboard Statistics Functions
-- These functions calculate aggregated statistics at the database level for improved performance

-- Function to get basic stats (total citizens, by status, by sex)
CREATE OR REPLACE FUNCTION get_dashboard_basic_stats(
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
      id,
      status,
      sex,
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
  SELECT json_build_object(
    'totalCitizens', (SELECT COUNT(*) FROM age_filtered),
    'byStatus', (
      SELECT COALESCE(json_agg(json_build_object('status', status, 'count', count)), '[]'::json)
      FROM (
        SELECT status, COUNT(*)::int as count
        FROM age_filtered
        GROUP BY status
        ORDER BY status
      ) t
    ),
    'bySex', (
      SELECT COALESCE(json_agg(json_build_object('sex', sex, 'count', count)), '[]'::json)
      FROM (
        SELECT sex, COUNT(*)::int as count
        FROM age_filtered
        GROUP BY sex
        ORDER BY sex
      ) t
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Function to get age distribution
CREATE OR REPLACE FUNCTION get_dashboard_age_distribution(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_province_code text DEFAULT NULL,
  p_lgu_code text DEFAULT NULL,
  p_barangay_code text DEFAULT NULL,
  p_status_filter text[] DEFAULT NULL,
  p_payment_date_start date DEFAULT NULL,
  p_payment_date_end date DEFAULT NULL,
  p_calendar_years int[] DEFAULT ARRAY[2024, 2025, 2026, 2027, 2028]
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result json;
  reference_year int;
BEGIN
  reference_year := p_calendar_years[1];
  
  WITH filtered_citizens AS (
    SELECT birth_date
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
  age_calc AS (
    SELECT 
      CASE
        WHEN age BETWEEN 80 AND 84 THEN '80'
        WHEN age BETWEEN 85 AND 89 THEN '85'
        WHEN age BETWEEN 90 AND 94 THEN '90'
        WHEN age BETWEEN 95 AND 99 THEN '95'
        WHEN age >= 100 THEN '100+'
      END as age_range
    FROM (
      SELECT reference_year - EXTRACT(YEAR FROM birth_date)::int as age
      FROM filtered_citizens
    ) ages
    WHERE age >= 80
  )
  SELECT json_agg(json_build_object('range', range, 'count', count) ORDER BY range)
  INTO result
  FROM (
    SELECT 
      age_range as range,
      COUNT(*)::int as count
    FROM age_calc
    WHERE age_range IS NOT NULL
    GROUP BY age_range
    ORDER BY 
      CASE age_range
        WHEN '80' THEN 1
        WHEN '85' THEN 2
        WHEN '90' THEN 3
        WHEN '95' THEN 4
        WHEN '100+' THEN 5
      END
  ) t;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Function to get monthly/quarterly distribution
CREATE OR REPLACE FUNCTION get_dashboard_birth_distribution(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_province_code text DEFAULT NULL,
  p_lgu_code text DEFAULT NULL,
  p_barangay_code text DEFAULT NULL,
  p_status_filter text[] DEFAULT NULL,
  p_payment_date_start date DEFAULT NULL,
  p_payment_date_end date DEFAULT NULL,
  p_calendar_years int[] DEFAULT ARRAY[2024, 2025, 2026, 2027, 2028]
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result json;
BEGIN
  WITH filtered_citizens AS (
    SELECT birth_date
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
  )
  SELECT json_build_object(
    'byMonth', (
      SELECT json_agg(json_build_object('month', month_name, 'count', count) ORDER BY month_num)
      FROM (
        SELECT 
          EXTRACT(MONTH FROM birth_date)::int as month_num,
          TO_CHAR(birth_date, 'Month') as month_name,
          COUNT(*)::int as count
        FROM filtered_citizens
        GROUP BY month_num, month_name
      ) months
    ),
    'byQuarter', (
      SELECT json_agg(json_build_object('quarter', quarter, 'count', count) ORDER BY quarter)
      FROM (
        SELECT 
          'Q' || EXTRACT(QUARTER FROM birth_date)::text as quarter,
          COUNT(*)::int as count
        FROM filtered_citizens
        GROUP BY EXTRACT(QUARTER FROM birth_date)
      ) quarters
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Function to calculate payment statistics with amounts
CREATE OR REPLACE FUNCTION get_dashboard_payment_stats(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_province_code text DEFAULT NULL,
  p_lgu_code text DEFAULT NULL,
  p_barangay_code text DEFAULT NULL,
  p_status_filter text[] DEFAULT NULL,
  p_payment_date_start date DEFAULT NULL,
  p_payment_date_end date DEFAULT NULL,
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
    FROM filtered_citizens fc
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
    'total', (SELECT COUNT(*)::int FROM filtered_citizens),
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

-- Function to get province statistics
CREATE OR REPLACE FUNCTION get_dashboard_province_stats(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_province_code text DEFAULT NULL,
  p_lgu_code text DEFAULT NULL,
  p_barangay_code text DEFAULT NULL,
  p_status_filter text[] DEFAULT NULL,
  p_payment_date_start date DEFAULT NULL,
  p_payment_date_end date DEFAULT NULL,
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
      status
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
    FROM filtered_citizens
    GROUP BY province_code
  ) stats ON p.code = stats.province_code;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Function to get LGU statistics for a specific province
CREATE OR REPLACE FUNCTION get_dashboard_lgu_stats(
  p_province_code text,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_lgu_code text DEFAULT NULL,
  p_barangay_code text DEFAULT NULL,
  p_status_filter text[] DEFAULT NULL,
  p_payment_date_start date DEFAULT NULL,
  p_payment_date_end date DEFAULT NULL,
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
      status
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
    FROM filtered_citizens
    GROUP BY lgu_code
  ) stats ON l.code = stats.lgu_code
  WHERE l.province_code = p_province_code;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Function to get paid citizens by specific age
CREATE OR REPLACE FUNCTION get_dashboard_paid_by_age(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_province_code text DEFAULT NULL,
  p_lgu_code text DEFAULT NULL,
  p_barangay_code text DEFAULT NULL,
  p_status_filter text[] DEFAULT NULL,
  p_payment_date_start date DEFAULT NULL,
  p_payment_date_end date DEFAULT NULL,
  p_calendar_years int[] DEFAULT ARRAY[2024, 2025, 2026, 2027, 2028]
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result json;
  total_paid int;
BEGIN
  WITH paid_citizens AS (
    SELECT 
      birth_date,
      sex,
      calendar_year
    FROM citizens
    WHERE 
      status = 'Paid'
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
      AND (p_province_code IS NULL OR province_code = p_province_code)
      AND (p_lgu_code IS NULL OR lgu_code = p_lgu_code)
      AND (p_barangay_code IS NULL OR barangay_code = p_barangay_code)
      AND (p_status_filter IS NULL OR status = ANY(p_status_filter))
      AND (p_payment_date_start IS NULL OR payment_date >= p_payment_date_start)
      AND (p_payment_date_end IS NULL OR payment_date <= p_payment_date_end)
      AND calendar_year = ANY(p_calendar_years)
  ),
  age_groups AS (
    SELECT 
      target_age,
      COUNT(*)::int as count,
      COUNT(*) FILTER (WHERE sex = 'Male')::int as male_count,
      COUNT(*) FILTER (WHERE sex = 'Female')::int as female_count,
      CASE WHEN target_age = 100 THEN 100000 ELSE 10000 END as cash_gift
    FROM (
      SELECT 
        pc.sex,
        ages.target_age
      FROM paid_citizens pc
      CROSS JOIN (SELECT unnest(ARRAY[80, 85, 90, 95, 100]) as target_age) ages
      WHERE EXISTS (
        SELECT 1
        FROM unnest(p_calendar_years) AS year
        WHERE year - EXTRACT(YEAR FROM pc.birth_date)::int = ages.target_age
      )
    ) age_matches
    GROUP BY target_age
    ORDER BY target_age
  )
  SELECT 
    (SELECT COUNT(*)::int FROM paid_citizens),
    json_agg(
      json_build_object(
        'age', target_age,
        'count', count,
        'maleCount', male_count,
        'femaleCount', female_count,
        'malePercentage', CASE WHEN count > 0 THEN (male_count::numeric / count * 100) ELSE 0 END,
        'femalePercentage', CASE WHEN count > 0 THEN (female_count::numeric / count * 100) ELSE 0 END,
        'percentage', CASE WHEN $1 > 0 THEN (count::numeric / $1 * 100) ELSE 0 END,
        'cashGift', cash_gift,
        'totalAmount', count * cash_gift
      ) ORDER BY target_age
    )
  INTO total_paid, result
  FROM age_groups;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;
