-- Test the calendar_year calculation function
-- This file can be run in the Supabase SQL editor to test the logic

-- First, create the function (same as in migration)
CREATE OR REPLACE FUNCTION calculate_calendar_year(birth_date DATE)
RETURNS INTEGER AS $$
DECLARE
  birth_year INTEGER;
  last_digit INTEGER;
  base_calendar_year INTEGER;
BEGIN
  -- Extract birth year
  birth_year := EXTRACT(YEAR FROM birth_date);
  
  -- Get last digit of birth year
  last_digit := birth_year % 10;
  
  -- Base calendar year starts at 2024
  base_calendar_year := 2024;
  
  -- Determine calendar year based on birth year pattern
  -- 5-year cycle: 2024, 2025, 2026, 2027, 2028
  -- This creates age groups where people are 80, 85, 90, 95, or 100 years old
  CASE last_digit
    WHEN 0 THEN RETURN base_calendar_year + 1; -- 1940,1930,1920 → 2025 (ages 85,95,105)
    WHEN 1 THEN RETURN base_calendar_year + 2; -- 1941,1931,1921 → 2026 (ages 85,95,105)
    WHEN 2 THEN RETURN base_calendar_year + 3; -- 1942,1932,1922 → 2027 (ages 85,95,105)
    WHEN 3 THEN RETURN base_calendar_year + 4; -- 1943,1933,1923 → 2028 (ages 85,95,105)
    WHEN 4 THEN RETURN base_calendar_year;     -- 1944,1934,1924 → 2024 (ages 80,90,100)
    WHEN 5 THEN RETURN base_calendar_year + 1; -- 1945,1935,1925 → 2025 (ages 80,90,100)
    WHEN 6 THEN RETURN base_calendar_year + 2; -- 1946,1936,1926 → 2026 (ages 80,90,100)
    WHEN 7 THEN RETURN base_calendar_year + 3; -- 1947,1937,1927 → 2027 (ages 80,90,100)
    WHEN 8 THEN RETURN base_calendar_year + 4; -- 1948,1938,1928 → 2028 (ages 80,90,100)
    WHEN 9 THEN RETURN base_calendar_year;     -- 1949,1939,1929 → 2024 (ages 75,85,95)
    ELSE RETURN base_calendar_year;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Test with your provided examples
SELECT 
  '1945-01-01'::DATE as birth_date,
  1945 as birth_year,
  calculate_calendar_year('1945-01-01'::DATE) as calendar_year,
  calculate_calendar_year('1945-01-01'::DATE) - 1945 as age,
  'Expected: 2025 (age 80)' as expected
UNION ALL
SELECT 
  '1940-01-01'::DATE,
  1940,
  calculate_calendar_year('1940-01-01'::DATE),
  calculate_calendar_year('1940-01-01'::DATE) - 1940,
  'Expected: 2025 (age 85)'
UNION ALL
SELECT 
  '1944-01-01'::DATE,
  1944,
  calculate_calendar_year('1944-01-01'::DATE),
  calculate_calendar_year('1944-01-01'::DATE) - 1944,
  'Expected: 2024 (age 80)'
UNION ALL
SELECT 
  '1939-01-01'::DATE,
  1939,
  calculate_calendar_year('1939-01-01'::DATE),
  calculate_calendar_year('1939-01-01'::DATE) - 1939,
  'Expected: 2024 (age 85)'
UNION ALL
SELECT 
  '1925-01-01'::DATE,
  1925,
  calculate_calendar_year('1925-01-01'::DATE),
  calculate_calendar_year('1925-01-01'::DATE) - 1925,
  'Expected: 2025 (age 100) - from your example'
UNION ALL
SELECT 
  '1930-01-01'::DATE,
  1930,
  calculate_calendar_year('1930-01-01'::DATE),
  calculate_calendar_year('1930-01-01'::DATE) - 1930,
  'Expected: 2025 (age 95) - from your example'
UNION ALL
SELECT 
  '1935-01-01'::DATE,
  1935,
  calculate_calendar_year('1935-01-01'::DATE),
  calculate_calendar_year('1935-01-01'::DATE) - 1935,
  'Expected: 2025 (age 90) - from your example'
UNION ALL
SELECT 
  '1938-01-01'::DATE,
  1938,
  calculate_calendar_year('1938-01-01'::DATE),
  calculate_calendar_year('1938-01-01'::DATE) - 1938,
  'Expected: 2028 (age 90) - new pattern'
UNION ALL
SELECT 
  '1941-01-01'::DATE,
  1941,
  calculate_calendar_year('1941-01-01'::DATE),
  calculate_calendar_year('1941-01-01'::DATE) - 1941,
  'Expected: 2026 (age 85) - new pattern'
UNION ALL
SELECT 
  '1942-01-01'::DATE,
  1942,
  calculate_calendar_year('1942-01-01'::DATE),
  calculate_calendar_year('1942-01-01'::DATE) - 1942,
  'Expected: 2027 (age 85) - new pattern'
ORDER BY birth_year;

-- Test additional years to show the pattern
SELECT 
  birth_year,
  birth_year % 10 as last_digit,
  calculate_calendar_year((birth_year || '-01-01')::DATE) as calendar_year,
  calculate_calendar_year((birth_year || '-01-01')::DATE) - birth_year as age
FROM generate_series(1920, 1950) as birth_year
ORDER BY birth_year;
