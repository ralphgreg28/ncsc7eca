/*
  # Initial Schema for Senior Citizen Management System

  1. New Tables
    - `citizens`
      - Stores senior citizen personal information
      - Includes name, birthdate, sex, and address details
    - `regions`
      - Geographic regions table
    - `provinces`
      - Provinces with region reference
    - `lgus`
      - Local Government Units with province reference
    - `barangays`
      - Barangays with LGU and province reference

  2. Security
    - Enable RLS on all tables
    - Add policies for basic data access
*/

-- Citizens table
CREATE TABLE IF NOT EXISTS citizens (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  extension_name TEXT,
  birth_date DATE NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
  province_code TEXT NOT NULL,
  lgu_code TEXT NOT NULL,
  barangay_code TEXT NOT NULL,
  sitio_purok TEXT
);

-- Regions table
CREATE TABLE IF NOT EXISTS regions (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

-- Provinces table
CREATE TABLE IF NOT EXISTS provinces (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  region_code TEXT NOT NULL,
  CONSTRAINT fk_region FOREIGN KEY (region_code) REFERENCES regions(code) ON DELETE CASCADE
);

-- LGUs (Local Government Units) table
CREATE TABLE IF NOT EXISTS lgus (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  province_code TEXT NOT NULL,
  CONSTRAINT fk_province FOREIGN KEY (province_code) REFERENCES provinces(code) ON DELETE CASCADE
);

-- Barangays table
CREATE TABLE IF NOT EXISTS barangays (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  province_code TEXT NOT NULL,
  lgu_code TEXT NOT NULL,
  CONSTRAINT fk_province FOREIGN KEY (province_code) REFERENCES provinces(code) ON DELETE CASCADE,
  CONSTRAINT fk_lgu FOREIGN KEY (lgu_code) REFERENCES lgus(code) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE lgus ENABLE ROW LEVEL SECURITY;
ALTER TABLE barangays ENABLE ROW LEVEL SECURITY;

-- Create policies
-- For now, allow all operations since we're not implementing authentication
CREATE POLICY "Allow all operations on citizens" ON citizens FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on regions" ON regions FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on provinces" ON provinces FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on lgus" ON lgus FOR ALL TO PUBLIC USING (true);
CREATE POLICY "Allow all operations on barangays" ON barangays FOR ALL TO PUBLIC USING (true);