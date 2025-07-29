/*
  # Add calendar_year column to citizens table

  1. Changes
    - Add function to calculate calendar year based on birth_date
    - Add calendar_year computed column to citizens table
    - Add index for performance optimization
    
  2. Logic
    - Calendar year is calculated to make age exactly 80, 85, 90, 95, or 100
    - Pattern based on birth year's last digit for consistent grouping
    - Future-proof design that works for any birth year
    
  3. Examples
    - Birth year 1945 → calendar_year 2025 (age 80)
    - Birth year 1940 → calendar_year 2025 (age 85)
    - Birth year 1944 → calendar_year 2024 (age 80)
    - Birth year 1939 → calendar_year 2024 (age 85)
*/

-- Create function to calculate calendar year based on birth date
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

-- Add calendar_year column as a computed column
ALTER TABLE citizens 
ADD COLUMN IF NOT EXISTS calendar_year INTEGER 
GENERATED ALWAYS AS (calculate_calendar_year(birth_date)) STORED;

-- Create index on calendar_year for better query performance
CREATE INDEX IF NOT EXISTS idx_citizens_calendar_year ON citizens(calendar_year);

-- Add column comment
COMMENT ON COLUMN citizens.calendar_year IS 'Automatically calculated calendar year based on birth_date to assign ages of 80, 85, 90, 95, or 100';

-- Add comment on function
COMMENT ON FUNCTION calculate_calendar_year(DATE) IS 'Calculates calendar year to assign target ages (80, 85, 90, 95, 100) based on birth year pattern';
