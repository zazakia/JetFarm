---
name: local-env
description: Supabase seeding, auth user sync, and local development environment setup
---

# Local Environment Skill — POSCursor (Expo Router, NativeWind v4, WatermelonDB/Supabase)

## Environment Files

| File | Purpose | Supabase Project |
|------|---------|-----------------|
| `.env` | Default (may point to production) | `YOUR_SUPABASE_PROJECT` |
| `.env.local` | Local development overrides | User-specific |
| `.env.test` | Jest tests | Local/test project |
| `.env.production` | Production build | `YOUR_SUPABASE_PROJECT` |

> **CRITICAL**: Never use the production URL (`YOUR_SUPABASE_PROJECT.supabase.co`) for local development or tests. The `jest-setup.ts` safety guard will throw if this URL is detected.

## Env Variables

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable-key>
```

These are loaded by `babel-plugin-inline-dotenv` at build time and accessed via `process.env.EXPO_PUBLIC_*` in `src/database/supabase.ts`.

## Role System

The app has 7 user roles, each routing to a dedicated Expo Router group:

| Role | Route Group | Color |
|------|-------------|-------|
| `admin` | `/(admin)` | Red `#DC2626` |
| `collector` | `/(collector)` | Emerald `#059669` |
| `loan_encoder` | `/(loan-encoder)` | Blue `#2563EB` |
| `payment_encoder` | `/(payment-encoder)` | Orange `#EA580C` |
| `expenses_encoder` | `/(expenses-encoder)` | Violet `#7C3AED` |
| `borrower` | `/(borrower)` | Slate `#1E293B` |
| `main_office` | `/(admin)` | Slate `#1E293B` |

Defined in `src/constants/roles.ts` with labels, colors, icons, and home routes.

## Auth Architecture

Authentication flows through three tables that **must be synchronized**:

1. **`auth.users`** — Supabase Auth internal table (email, password hash)
2. **`auth.identities`** — Required for Supabase Auth to recognize the user. Missing identities cause "Invalid login credentials" errors even with correct passwords.
3. **`public.user_profiles`** — App-level profile with `role`, `full_name`, `auth_id` (FK to `auth.users.id`)

### Common Auth Failure Pattern
```
Login fails → auth.users exists → auth.identities MISSING → "Invalid login credentials"
```

**Fix**: When seeding users, always create all three records together.

## Seeding Users via SQL

Use the `supabase-mcp-server` `apply_migration` or `execute_sql` tool:

```sql
-- 1. Create auth user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
VALUES (
    '<uuid>',
    'admin@jetfarm.com',
    crypt('password123', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated'
);

-- 2. Create identity (CRITICAL — do not skip!)
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
    '<uuid>',
    '<same-user-uuid>',
    jsonb_build_object('sub', '<same-user-uuid>', 'email', 'admin@jetfarm.com'),
    'email',
    '<same-user-uuid>',
    NOW(), NOW(), NOW()
);

-- 3. Create user profile
INSERT INTO public.user_profiles (id, auth_id, email, role, full_name, is_active, created_at, updated_at)
VALUES (
    '<new-uuid>',
    '<same-user-uuid>',
    'admin@jetfarm.com',
    'admin',
    'System Admin',
    true,
    NOW(), NOW()
);
```

## Relevant Scripts

| Script | Purpose | Run With |
|--------|---------|----------|
| `scripts/seed-test-users.mjs` | Seeds admin + collector test users | `node scripts/seed-test-users.mjs` |
| `scripts/seed-collectors.mjs` | Creates collector records in `app_collectors` | `node scripts/seed-collectors.mjs` |
| `scripts/signup-collectors.js` | Signs up collectors via Supabase Auth | `node scripts/signup-collectors.js` |
| `scripts/create_test_user.js` | Creates a single test user | `node scripts/create_test_user.js` |
| `scripts/verify-auth.mjs` | Verifies auth.users ↔ user_profiles sync | `node scripts/verify-auth.mjs` |
| `scripts/verify_collector_logins.mjs` | Tests collector login credentials | `node scripts/verify_collector_logins.mjs` |
| `scripts/verify-connection.mjs` | Checks Supabase connection is working | `node scripts/verify-connection.mjs` |

## Supabase Migrations

Located in `supabase/migrations/`:
- `20260401000000_initial_schema.sql` — Full schema (tables, RLS, functions)
- `20260402102153_fix_users.sql` — Auth user fixes

Apply via: `supabase-mcp-server` `apply_migration` tool or `supabase db push`.

## Starting the App

```bash
# Start Expo dev server
npx expo start

# Android
npx expo run:android

# Web
npx expo start --web
```

## Stale Session Cleanup

`src/database/supabase.ts` automatically clears stale auth tokens on web:
- Extracts project ref from URL
- Removes any `sb-*-auth-token` localStorage entries that don't match the current project
- Prevents "Invalid Refresh Token" errors from cross-project contamination

## Troubleshooting Checklist

1. **"Invalid login credentials"** → Check `auth.identities` exists for the user
2. **"Invalid Refresh Token"** → Clear browser localStorage or the app will auto-clean on next load (web only)
3. **Login works but dashboard empty** → Check `user_profiles.role` matches the expected route, run sync
4. **Sync returns 0 rows** → Verify Supabase URL matches the project with data
5. **RLS blocking queries** → Check `scripts/fix_rls_local.sql` for local dev RLS bypass
6. **500 "Database error querying schema" on login** → GoTrue NULL token bug. Fix:
   ```bash
   docker exec supabase_db_jetfarm-local psql -U postgres -c \
     "UPDATE auth.users SET confirmation_token=COALESCE(confirmation_token,''), recovery_token=COALESCE(recovery_token,''), email_change=COALESCE(email_change,''), email_change_token_new=COALESCE(email_change_token_new,''), email_change_token_current=COALESCE(email_change_token_current,''), reauthentication_token=COALESCE(reauthentication_token,''), phone_change=COALESCE(phone_change,'') WHERE confirmation_token IS NULL OR recovery_token IS NULL OR email_change IS NULL;"
   docker restart supabase_auth_jetfarm-local
   ```
   **Prevention**: Migration `20260404120000_fix_auth_null_tokens.sql` runs automatically on `db reset`.
   **Regression tests**: `src/services/__tests__/AuthService.regression.test.ts` (14 tests, BUG-001/002/003)
   **Health check script**: `node scripts/check-auth-schema.mjs` — run before `expo start` if login fails.

## GoTrue NULL Token Bug — Root Cause Summary

| Factor | Detail |
|--------|--------|
| **Symptom** | `POST /auth/v1/token → 500 Database error querying schema` |
| **Root cause** | `auth.users` rows have `NULL` in token text columns; GoTrue v2+ panics scanning NULL into Go `string` |
| **Affected columns** | `confirmation_token`, `recovery_token`, `email_change`, `email_change_token_new`, `email_change_token_current`, `reauthentication_token`, `phone_change` |
| **Why it happened** | Seed `INSERT` statements omitted these columns → defaulted to `NULL` |
| **Permanent fix** | Migration `20260404130000_constrain_auth_null_tokens.sql` adds `NOT NULL DEFAULT ''` |
| **Regression guard** | 14 tests in `AuthService.regression.test.ts` tagged BUG-001/002/003 |
