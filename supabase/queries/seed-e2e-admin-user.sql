-- Seed the Playwright E2E admin account into the jetfarm-local Supabase stack.
-- tests/playwright-auth.ts loginAsAdmin() signs in as admin@jetfarm.com.
-- Follows the local-env auth pattern: auth.users + auth.identities + user_profiles
-- must be created together, and the GoTrue token columns must be '' (never NULL).
-- Idempotent: safe to re-run; always refreshes the password to the E2E default.
--
-- Usage:
--   docker exec -i supabase_db_jetfarm-local psql -U postgres -d postgres < supabase/queries/seed-e2e-admin-user.sql

-- 1) auth.users (email has no unique constraint here, so guard with NOT EXISTS)
INSERT INTO auth.users (
    id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    reauthentication_token, phone_change,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, instance_id
)
SELECT
    gen_random_uuid(), 'authenticated', 'authenticated', 'admin@jetfarm.com',
    crypt('12345678', gen_salt('bf')),
    now(), '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"JetFarm E2E Admin"}'::jsonb,
    now(), now(), '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@jetfarm.com');

-- 2) Refresh credentials / confirm the address for an already-present user
UPDATE auth.users
SET encrypted_password   = crypt('12345678', gen_salt('bf')),
    email_confirmed_at   = COALESCE(email_confirmed_at, now()),
    confirmation_token   = COALESCE(confirmation_token, ''),
    recovery_token       = COALESCE(recovery_token, ''),
    email_change         = COALESCE(email_change, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    reauthentication_token = COALESCE(reauthentication_token, ''),
    phone_change         = COALESCE(phone_change, ''),
    updated_at           = now()
WHERE email = 'admin@jetfarm.com';

-- 3) auth.identities — required, or login reports "Invalid login credentials"
INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
)
SELECT
    gen_random_uuid(),
    u.id,
    u.id::text,
    jsonb_build_object('sub', u.id::text, 'email', u.email),
    'email', now(), now(), now()
FROM auth.users u
WHERE u.email = 'admin@jetfarm.com'
  AND NOT EXISTS (
      SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
  );

-- 4) App-level profile drives the admin route group
INSERT INTO public.user_profiles (id, email, full_name, role, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'admin@jetfarm.com', 'JetFarm E2E Admin', 'admin', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE email = 'admin@jetfarm.com');

UPDATE public.user_profiles
SET role = 'admin', is_active = true, deleted_at = NULL, updated_at = now()
WHERE email = 'admin@jetfarm.com';
