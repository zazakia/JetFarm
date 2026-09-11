-- Verify every active user email, repair missing auth records, and keep cross-device login sync healthy.
-- Run this in the Supabase SQL Editor for the target project.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
    default_password TEXT := crypt('12345678', gen_salt('bf'));
    target_user RECORD;
    auth_user_id UUID;
BEGIN
    -- 1) Prevent GoTrue crashes caused by NULL token columns.
    UPDATE auth.users
    SET
        confirmation_token         = COALESCE(confirmation_token, ''),
        recovery_token             = COALESCE(recovery_token, ''),
        email_change_token_new     = COALESCE(email_change_token_new, ''),
        email_change_token_current = COALESCE(email_change_token_current, ''),
        reauthentication_token     = COALESCE(reauthentication_token, ''),
        email_change               = COALESCE(email_change, ''),
        phone_change               = COALESCE(phone_change, '')
    WHERE
        confirmation_token IS NULL
        OR recovery_token IS NULL
        OR email_change_token_new IS NULL
        OR email_change_token_current IS NULL
        OR reauthentication_token IS NULL
        OR email_change IS NULL
        OR phone_change IS NULL;

    CREATE TEMP TABLE target_users (
        email TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL
    ) ON COMMIT DROP;

    -- 2) Use existing active profiles as the main source of truth.
    INSERT INTO target_users (email, full_name, role)
    SELECT DISTINCT ON (LOWER(TRIM(email)))
        LOWER(TRIM(email)) AS email,
        COALESCE(NULLIF(TRIM(full_name), ''), LOWER(TRIM(email))) AS full_name,
        role
    FROM public.user_profiles
    WHERE email IS NOT NULL
      AND TRIM(email) <> ''
      AND COALESCE(is_active, true) = true
      AND deleted_at IS NULL
    ORDER BY LOWER(TRIM(email)), updated_at DESC NULLS LAST, created_at DESC NULLS LAST;

    -- 3) Keep the known quick-login users available even if their profiles were never created locally.
    INSERT INTO target_users (email, full_name, role) VALUES
        ('bjaylargo@gmail.com', 'Bjay Largo Admin', 'admin'),
        ('bisayangcollector@gmail.com', 'Bisayang Collector', 'collector'),
        ('cybergada@gmail.com', 'Cybergada Master', 'admin'),
        ('admin@poscursor.com', 'Admin User', 'admin'),
        ('collector@poscursor.com', 'Master Collector', 'collector'),
        ('mainoffice@poscursor.com', 'Main Office', 'collector'),
        ('jayson.cayanong@poscursor.com', 'Jayson Cayanong', 'collector'),
        ('cresencio.junco@poscursor.com', 'Cresencio Junco', 'collector'),
        ('gerald.gera@poscursor.com', 'Gerald Gera', 'collector'),
        ('bernie.casera@poscursor.com', 'Bernie Casera', 'collector'),
        ('encoder@poscursor.com', 'Loan Encoder', 'loan_encoder')
    ON CONFLICT (email) DO NOTHING;

    FOR target_user IN
        SELECT email, full_name, role
        FROM target_users
        ORDER BY role, email
    LOOP
        SELECT id
        INTO auth_user_id
        FROM auth.users
        WHERE LOWER(email) = target_user.email
        LIMIT 1;

        -- 4) Create the auth user if it does not exist.
        IF auth_user_id IS NULL THEN
            auth_user_id := gen_random_uuid();

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
                confirmation_token,
                recovery_token,
                email_change_token_new,
                email_change_token_current,
                reauthentication_token,
                email_change,
                phone_change,
                is_sso_user
            )
            VALUES (
                auth_user_id,
                '00000000-0000-0000-0000-000000000000',
                'authenticated',
                'authenticated',
                target_user.email,
                default_password,
                NOW(),
                jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
                jsonb_build_object('full_name', target_user.full_name, 'role', target_user.role),
                NOW(),
                NOW(),
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                false
            );
        ELSE
            -- 5) Verify/repair existing auth users.
            UPDATE auth.users
            SET
                email = target_user.email,
                email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
                raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
                raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
                    || jsonb_build_object('full_name', target_user.full_name, 'role', target_user.role),
                confirmation_token = COALESCE(confirmation_token, ''),
                recovery_token = COALESCE(recovery_token, ''),
                email_change_token_new = COALESCE(email_change_token_new, ''),
                email_change_token_current = COALESCE(email_change_token_current, ''),
                reauthentication_token = COALESCE(reauthentication_token, ''),
                email_change = COALESCE(email_change, ''),
                phone_change = COALESCE(phone_change, ''),
                updated_at = NOW()
            WHERE id = auth_user_id;
        END IF;

        -- 6) Ensure the email identity exists so password logins work everywhere.
        IF NOT EXISTS (
            SELECT 1
            FROM auth.identities
            WHERE user_id = auth_user_id
              AND provider = 'email'
        ) THEN
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
            VALUES (
                gen_random_uuid(),
                auth_user_id,
                jsonb_build_object('sub', auth_user_id::text, 'email', target_user.email),
                'email',
                target_user.email,
                NOW(),
                NOW(),
                NOW()
            );
        ELSE
            UPDATE auth.identities
            SET
                identity_data = jsonb_build_object('sub', auth_user_id::text, 'email', target_user.email),
                provider_id = target_user.email,
                updated_at = NOW()
            WHERE user_id = auth_user_id
              AND provider = 'email';
        END IF;

        -- 7) Refresh the profile row used by app auth/role resolution.
        UPDATE public.user_profiles
        SET
            full_name = target_user.full_name,
            email = target_user.email,
            role = target_user.role,
            is_active = true,
            deleted_at = NULL,
            updated_at = NOW()
        WHERE LOWER(TRIM(email)) = target_user.email;

        IF NOT FOUND THEN
            INSERT INTO public.user_profiles (
                id,
                full_name,
                email,
                role,
                is_active,
                created_at,
                updated_at
            )
            VALUES (
                auth_user_id::text,
                target_user.full_name,
                target_user.email,
                target_user.role,
                true,
                NOW(),
                NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                email = EXCLUDED.email,
                role = EXCLUDED.role,
                is_active = true,
                deleted_at = NULL,
                updated_at = NOW();
        END IF;

        -- 8) Keep collectors linked for collector dashboards and sync.
        IF target_user.role = 'collector' THEN
            UPDATE public.app_collectors
            SET
                full_name = target_user.full_name,
                auth_id = auth_user_id,
                is_active = true,
                deleted_at = NULL,
                updated_at = NOW()
            WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(target_user.full_name))
               OR auth_id = auth_user_id;

            IF NOT FOUND THEN
                INSERT INTO public.app_collectors (
                    id,
                    full_name,
                    auth_id,
                    is_active,
                    created_at,
                    updated_at
                )
                VALUES (
                    gen_random_uuid()::text,
                    target_user.full_name,
                    auth_user_id,
                    true,
                    NOW(),
                    NOW()
                );
            END IF;
        END IF;
    END LOOP;
END $$;

-- Optional post-run checks
SELECT
    u.email,
    u.email_confirmed_at IS NOT NULL AS email_verified,
    EXISTS (
        SELECT 1
        FROM auth.identities i
        WHERE i.user_id = u.id
          AND i.provider = 'email'
    ) AS has_email_identity
FROM auth.users u
WHERE LOWER(u.email) IN (
    SELECT email FROM public.user_profiles WHERE email IS NOT NULL AND deleted_at IS NULL
)
ORDER BY LOWER(u.email);
