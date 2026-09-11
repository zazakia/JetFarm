-- Ensure pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Clear existing to avoid conflict issues in manual seeding
DELETE FROM auth.identities WHERE user_id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004');
DELETE FROM auth.users WHERE email IN ('admin@poscursor.com', 'cybergada@gmail.com', 'collector@poscursor.com', 'encoder@poscursor.com');

-- Function for inserting auth users
DO $$
DECLARE
    pw_poscursor TEXT := extensions.crypt('12345678', extensions.gen_salt('bf'));
BEGIN
    -- admin@poscursor.com (Admin)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token, email_change_token_new, email_change_token_current, reauthentication_token, email_change, phone_change)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@poscursor.com', pw_poscursor, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Admin User"}', now(), now(), now(), '', '', '', '', '', '', '');

    -- cybergada@gmail.com (Admin)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token, email_change_token_new, email_change_token_current, reauthentication_token, email_change, phone_change)
    VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cybergada@gmail.com', pw_poscursor, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Cybergada Master"}', now(), now(), now(), '', '', '', '', '', '', '');

    -- collector@poscursor.com (Collector)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token, email_change_token_new, email_change_token_current, reauthentication_token, email_change, phone_change)
    VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'collector@poscursor.com', pw_poscursor, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Master Collector"}', now(), now(), now(), '', '', '', '', '', '', '');

    -- encoder@poscursor.com (Encoder)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token, email_change_token_new, email_change_token_current, reauthentication_token, email_change, phone_change)
    VALUES ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'encoder@poscursor.com', pw_poscursor, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Loan Encoder"}', now(), now(), now(), '', '', '', '', '', '', '');

    -- IDENTITIES (Required for GoTrue v2+)
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES 
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '{"sub":"00000000-0000-0000-0000-000000000001"}', 'email', 'admin@poscursor.com', now(), now(), now()),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '{"sub":"00000000-0000-0000-0000-000000000002"}', 'email', 'cybergada@gmail.com', now(), now(), now()),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', '{"sub":"00000000-0000-0000-0000-000000000003"}', 'email', 'collector@poscursor.com', now(), now(), now()),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', '{"sub":"00000000-0000-0000-0000-000000000004"}', 'email', 'encoder@poscursor.com', now(), now(), now());

END $$;

-- Populate public.user_profiles
DELETE FROM public.user_profiles WHERE id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004');

INSERT INTO public.user_profiles (id, full_name, email, role, is_active, created_at, updated_at)
VALUES 
('00000000-0000-0000-0000-000000000001', 'Admin User', 'admin@poscursor.com', 'admin', true, now(), now()),
('00000000-0000-0000-0000-000000000002', 'Cybergada Master', 'cybergada@gmail.com', 'admin', true, now(), now()),
('00000000-0000-0000-0000-000000000003', 'Master Collector', 'collector@poscursor.com', 'collector', true, now(), now()),
('00000000-0000-0000-0000-000000000004', 'Loan Encoder', 'encoder@poscursor.com', 'loan_encoder', true, now(), now());
