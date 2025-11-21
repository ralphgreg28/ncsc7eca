/*
  # Fix calendar_year calculation for ages 100+
  
  Updates the calculate_calendar_year function to properly handle
  birth years ≤ 1928 using the birth_year + 100 formula.
  
  Also drops and recreates the calendar_year column to force
  recalculation for all existing data.
*/

-- Step 1: Drop and recreate the function with correct logic
CREATE OR REPLACE FUNCTION calculate_calendar_year(birth_date DATE)
RETURNS INTEGER AS $$
DECLARE
  birth_year INTEGER;
  last_digit INTEGER;
  base_calendar_year INTEGER;
BEGIN
  -- Extract birth year
  birth_year := EXTRACT(YEAR FROM birth_date);
  
  -- For ages 100 and above (birth years ≤ 1928), calendar year is birth_year + 100
  -- This ensures they get their proper calendar year at exactly age 100
  -- Example: Birth year 1918 → Calendar year 2018 (age 100)
  -- Example: Birth year 1923 → Calendar year 2023 (age 100)
  -- Example: Birth year 1928 → Calendar year 2028 (age 100)
  IF birth_year <= 1928 THEN
    RETURN birth_year + 100;
  END IF;
  
  -- Get last digit of birth year
  last_digit := birth_year % 10;
  
  -- Base calendar year starts at 2024
  base_calendar_year := 2024;
  
  -- Determine calendar year based on birth year pattern
  -- 5-year cycle: 2024, 2025, 2026, 2027, 2028
  -- This creates age groups where people are 80, 85, 90, 95, or 100 years old
  CASE last_digit
    WHEN 0 THEN RETURN base_calendar_year + 1; -- 1940,1930 → 2025 (ages 85,95)
    WHEN 1 THEN RETURN base_calendar_year + 2; -- 1941,1931 → 2026 (ages 85,95)
    WHEN 2 THEN RETURN base_calendar_year + 3; -- 1942,1932 → 2027 (ages 85,95)
    WHEN 3 THEN RETURN base_calendar_year + 4; -- 1943,1933 → 2028 (ages 85,95)
    WHEN 4 THEN RETURN base_calendar_year;     -- 1944,1934 → 2024 (ages 80,90)
    WHEN 5 THEN RETURN base_calendar_year + 1; -- 1945,1935 → 2025 (ages 80,90)
    WHEN 6 THEN RETURN base_calendar_year + 2; -- 1946,1936 → 2026 (ages 80,90)
    WHEN 7 THEN RETURN base_calendar_year + 3; -- 1947,1937 → 2027 (ages 80,90)
    WHEN 8 THEN RETURN base_calendar_year + 4; -- 1948,1938 → 2028 (ages 80,90)
    WHEN 9 THEN RETURN base_calendar_year;     -- 1949,1939,1929 → 2024 (ages 75,85,95)
    ELSE RETURN base_calendar_year;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Drop the existing calendar_year column
-- This is necessary to force recalculation of all existing data
ALTER TABLE citizens DROP COLUMN IF EXISTS calendar_year;

-- Step 3: Recreate the calendar_year column with the updated function
-- This will recalculate all values using the new logic
ALTER TABLE citizens 
ADD COLUMN calendar_year INTEGER 
GENERATED ALWAYS AS (calculate_calendar_year(birth_date)) STORED;

-- Step 4: Recreate the index for performance
CREATE INDEX IF NOT EXISTS idx_citizens_calendar_year ON citizens(calendar_year);

-- Step 5: Re-add the column comment
COMMENT ON COLUMN citizens.calendar_year IS 'Automatically calculated calendar year based on birth_date to assign ages of 80, 85, 90, 95, or 100. Birth years ≤ 1928 use formula birth_year + 100.';
