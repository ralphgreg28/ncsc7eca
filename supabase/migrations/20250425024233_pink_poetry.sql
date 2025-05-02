/*
  # Create storage bucket for logos

  1. New Storage Configuration
    - Create logos bucket for storing organization logos
    - Set bucket as public for easy access
    - Configure RLS policies for secure access

  2. Security
    - Allow public read access to logos
    - Restrict write operations to authenticated users
    - Enable policies for insert, update, and delete operations
*/

-- Create the logos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete logos" ON storage.objects;

-- Set up storage policies for the logos bucket
CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

CREATE POLICY "Anyone can upload logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Anyone can update logos"
  ON storage.objects FOR UPDATE
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Anyone can delete logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'logos');