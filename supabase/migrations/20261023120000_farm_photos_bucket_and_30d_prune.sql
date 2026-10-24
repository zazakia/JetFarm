-- Migration: 20261023120000_farm_photos_bucket_and_30d_prune.sql
-- Description: Sets up farm-photos bucket, public read / auth insert policies,
-- and schedules an automated pg_cron job to delete cloud photos older than 30 days.

-- 1. Create farm-photos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('farm-photos', 'farm-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage RLS Policies
DROP POLICY IF EXISTS "farm_photos_authenticated_insert" ON storage.objects;
CREATE POLICY "farm_photos_authenticated_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'farm-photos');

DROP POLICY IF EXISTS "farm_photos_public_select" ON storage.objects;
CREATE POLICY "farm_photos_public_select"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'farm-photos');

-- 3. Cleanup function: deletes farm-photos older than 30 days
CREATE OR REPLACE FUNCTION delete_expired_farm_photos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = 'farm-photos'
      AND created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- 4. Enable pg_cron and schedule daily at 00:00 midnight
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron'
    ) THEN
        CREATE EXTENSION IF NOT EXISTS pg_cron;

        -- Unschedule existing job if already registered to avoid duplication
        IF EXISTS (
            SELECT 1 FROM cron.job WHERE jobname = 'cleanup-farm-photos-daily'
        ) THEN
            PERFORM cron.unschedule('cleanup-farm-photos-daily');
        END IF;

        -- Run every day at midnight (00:00 UTC)
        PERFORM cron.schedule(
            'cleanup-farm-photos-daily',
            '0 0 * * *',
            'SELECT delete_expired_farm_photos();'
        );
    END IF;
END $$;
