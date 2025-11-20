-- Force PostgREST to reload the schema cache
-- Run this after creating the dashboard functions

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Alternative: You can also just wait 1-2 minutes for auto-reload
-- Or restart your Supabase project from the dashboard
