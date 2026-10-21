-- Local auth/profile seed for `supabase db reset`
-- Agribusiness-only variant: seeds the roles this build still ships (admin,
-- expenses_encoder, main_office). The lending identities were removed with the
-- teardown because their record tables are retired by
-- 20261021000000_retire_non_agribusiness_tables.sql and the collector-id resolver
-- is gone from AuthService. Do not name a retired table in this file - the
-- supabaseMigrations regression guard asserts seed.sql stays free of them.
-- Password is the same local-only '12345678' the login screen quick-login expects.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
    pw_poscursor text := crypt('12345678', gen_salt('bf'));
BEGIN
    CREATE TEMP TABLE IF NOT EXISTS seed_login_users (
        id uuid PRIMARY KEY,
        email text NOT NULL UNIQUE,
        full_name text NOT NULL,
        app_role text NOT NULL
    ) ON COMMIT DROP;

    TRUNCATE seed_login_users;

    INSERT INTO seed_login_users (id, email, full_name, app_role)
    VALUES
        ('00000000-0000-0000-0000-000000000001', 'admin@agri-one.com', 'Admin User', 'admin'),
        ('00000000-0000-0000-0000-000000000002', 'cybergada@gmail.com', 'Cybergada Master', 'admin'),
        ('00000000-0000-0000-0000-000000000006', 'expenses_encoder@agri-one.com', 'Expenses Encoder', 'expenses_encoder'),
        ('00000000-0000-0000-0000-000000000011', 'mainoffice@agri-one.com', 'Main Office', 'main_office');

    DELETE FROM auth.identities
    WHERE user_id IN (SELECT id FROM seed_login_users)
       OR lower(provider_id) IN (SELECT lower(email) FROM seed_login_users);

    DELETE FROM auth.users
    WHERE id IN (SELECT id FROM seed_login_users)
       OR lower(email) IN (SELECT lower(email) FROM seed_login_users)
       OR lower(email) = 'encoder@poscursor.com';

    DELETE FROM public.user_profiles
    WHERE id IN (SELECT id::text FROM seed_login_users)
       OR lower(email) IN (SELECT lower(email) FROM seed_login_users)
       OR lower(email) = 'encoder@poscursor.com';

    -- Purge the lending/branch identities that APPEND-ONLY migrations still create.
    -- Migration history cannot be rewritten (20260402102153_fix_users.sql:23,46 seeds a
    -- 'collector' auth user + profile on every reset), so the retired roles are removed
    -- here instead - seed.sql is the local-only surface, which keeps this deletion away
    -- from any runner that applies supabase/migrations to a shared database.
    CREATE TEMP TABLE IF NOT EXISTS seed_retired_profiles ON COMMIT DROP AS
    SELECT id, email
    FROM public.user_profiles
    WHERE role IN (
        'collector', 'loan_encoder', 'payment_encoder', 'borrower',
        'branch_cashier', 'branch_manager', 'area_supervisor',
        'commissary_keeper', 'executive'
    );

    DELETE FROM auth.identities
    WHERE user_id IN (SELECT id FROM seed_login_users)
       OR lower(provider_id) IN (SELECT lower(email) FROM seed_retired_profiles);

    DELETE FROM auth.users
    WHERE id IN (SELECT id FROM seed_login_users)
       OR lower(email) IN (SELECT lower(email) FROM seed_retired_profiles);

    DELETE FROM public.user_profiles
    WHERE id IN (SELECT id FROM seed_retired_profiles);

    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        last_sign_in_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change_token_current,
        reauthentication_token,
        email_change,
        phone_change
    )
    SELECT
        id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        email,
        pw_poscursor,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', full_name, 'role', app_role),
        now(),
        now(),
        now(),
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    FROM seed_login_users;

    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    )
    SELECT
        gen_random_uuid(),
        id,
        jsonb_build_object('sub', id::text, 'email', email),
        'email',
        email,
        now(),
        now(),
        now()
    FROM seed_login_users;

    INSERT INTO public.user_profiles (id, full_name, email, role, is_active, created_at, updated_at)
    SELECT id::text, full_name, email, app_role, true, now(), now()
    FROM seed_login_users;
END $$;
