-- Fix: GoTrue crashes with "Scan error on column ... converting NULL to string"
-- when auth.users rows have NULL values in token columns.
-- This migration sets all NULL token fields to empty strings.
-- See: https://github.com/supabase/gotrue/issues/

UPDATE auth.users
SET
  confirmation_token       = COALESCE(confirmation_token, ''),
  recovery_token           = COALESCE(recovery_token, ''),
  email_change_token_new   = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token   = COALESCE(reauthentication_token, ''),
  email_change             = COALESCE(email_change, ''),
  phone_change             = COALESCE(phone_change, '')
WHERE
  confirmation_token IS NULL
  OR recovery_token IS NULL
  OR email_change_token_new IS NULL
  OR email_change_token_current IS NULL
  OR reauthentication_token IS NULL
  OR email_change IS NULL
  OR phone_change IS NULL;
