-- Fix for "Paid Citizens by Specific Ages" data inconsistency
-- This updates the get_dashboard_paid_by_age function to prevent duplicate counting

CREATE OR REPLACE FUNCTION get_dashboard_paid_by_age(
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
  total_paid int;
BEGIN
  -- Get total paid count first
  SELECT COUNT(*)::int INTO total_paid
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
    AND calendar_year = ANY(p_calendar_years);

  -- Calculate age groups
  WITH paid_citizens AS (
    SELECT 
      birth_date,
      sex,
      calendar_year,
      calendar_year - EXTRACT(YEAR FROM birth_date)::int as age
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
      age as target_age,
      COUNT(*)::int as count,
      COUNT(*) FILTER (WHERE sex = 'Male')::int as male_count,
      COUNT(*) FILTER (WHERE sex = 'Female')::int as female_count,
      CASE WHEN age = 100 THEN 100000 ELSE 10000 END as cash_gift
    FROM paid_citizens
    WHERE age IN (80, 85, 90, 95, 100)
    GROUP BY age
    ORDER BY age
  )
  SELECT json_agg(
    json_build_object(
      'age', target_age,
      'count', count,
      'maleCount', male_count,
      'femaleCount', female_count,
      'malePercentage', CASE WHEN count > 0 THEN (male_count::numeric / count * 100) ELSE 0 END,
      'femalePercentage', CASE WHEN count > 0 THEN (female_count::numeric / count * 100) ELSE 0 END,
      'percentage', CASE WHEN total_paid > 0 THEN (count::numeric / total_paid * 100) ELSE 0 END,
      'cashGift', cash_gift,
      'totalAmount', count * cash_gift
    ) ORDER BY target_age
  )
  INTO result
  FROM age_groups;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;
