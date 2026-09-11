-- =============================================================================
-- PERMANENT FIX: Prevent GoTrue 500 "Database error querying schema"
-- =============================================================================
-- GoTrue (Supabase Auth) crashes when scanning auth.users rows that have NULL
-- in token/change columns. This migration:
--   1. Coalesces any remaining NULLs to '' (safe idempotent cleanup)
--   2. Adds NOT NULL DEFAULT '' constraints so the columns can NEVER be NULL again
--
-- Affected columns (all text, all optional semantically but NOT structurally):
--   confirmation_token, recovery_token, email_change, email_change_token_new,
--   email_change_token_current, reauthentication_token, phone_change
-- =============================================================================

-- Step 1: Clean up any remaining NULLs (safe to run multiple times)
UPDATE auth.users SET
    confirmation_token        = COALESCE(confirmation_token, ''),
    recovery_token            = COALESCE(recovery_token, ''),
    email_change              = COALESCE(email_change, ''),
    email_change_token_new    = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    reauthentication_token    = COALESCE(reauthentication_token, ''),
    phone_change              = COALESCE(phone_change, '')
WHERE
    confirmation_token IS NULL
    OR recovery_token IS NULL
    OR email_change IS NULL
    OR email_change_token_new IS NULL
    OR email_change_token_current IS NULL
    OR reauthentication_token IS NULL
    OR phone_change IS NULL;

-- Step 2: Add NOT NULL + DEFAULT '' constraints when the migration role owns
-- auth.users. Newer Supabase local images keep auth.users owned by a dedicated
-- auth role, so direct ALTER TABLE can fail during `supabase db reset`.
DO $$
BEGIN
    IF pg_has_role(
        current_user,
        (SELECT relowner FROM pg_class WHERE oid = 'auth.users'::regclass),
        'MEMBER'
    ) THEN
        ALTER TABLE auth.users
            ALTER COLUMN confirmation_token        SET DEFAULT '',
            ALTER COLUMN recovery_token            SET DEFAULT '',
            ALTER COLUMN email_change              SET DEFAULT '',
            ALTER COLUMN email_change_token_new    SET DEFAULT '',
            ALTER COLUMN email_change_token_current SET DEFAULT '',
            ALTER COLUMN reauthentication_token    SET DEFAULT '',
            ALTER COLUMN phone_change              SET DEFAULT '';

        ALTER TABLE auth.users
            ALTER COLUMN confirmation_token        SET NOT NULL,
            ALTER COLUMN recovery_token            SET NOT NULL,
            ALTER COLUMN email_change              SET NOT NULL,
            ALTER COLUMN email_change_token_new    SET NOT NULL,
            ALTER COLUMN email_change_token_current SET NOT NULL,
            ALTER COLUMN reauthentication_token    SET NOT NULL,
            ALTER COLUMN phone_change              SET NOT NULL;
    ELSE
        RAISE NOTICE 'Skipping auth.users token constraints because % is not a member of the table owner role', current_user;
    END IF;
END $$;
