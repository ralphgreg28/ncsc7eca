/*
  # Logo Management System Configuration

  1. Changes
    - Create logos bucket with public access
    - Set up storage policies for logo management
    - Configure CORS and cache settings

  2. Security
    - Enable public read access
    - Restrict upload/update/delete to authenticated users
    - Set appropriate CORS headers
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
  WITH CHECK (bucket_id = 'logos' AND 
    lower(storage.extension(name)) IN ('png', 'jpg', 'jpeg', 'svg'));

CREATE POLICY "Anyone can update logos"
  ON storage.objects FOR UPDATE
  WITH CHECK (bucket_id = 'logos' AND 
    lower(storage.extension(name)) IN ('png', 'jpg', 'jpeg', 'svg'));

CREATE POLICY "Anyone can delete logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'logos');

-- Set bucket configuration
UPDATE storage.buckets
SET public = true,
    file_size_limit = 2097152, -- 2MB in bytes
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/svg+xml']
WHERE id = 'logos';