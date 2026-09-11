---
description: How to bootstrap the local development environment for POSCursor
---

# Setup Local Environment Workflow

## 1. Install Dependencies
// turbo
Run: `npm install`

## 2. Configure Environment
Copy `.env` to `.env.local` and update with your local/dev Supabase credentials:
```env
EXPO_PUBLIC_SUPABASE_URL=https://<your-dev-project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

## 3. Verify Supabase Connection
// turbo
Run: `node scripts/verify-connection.mjs`

## 4. Apply Migrations
Use the `supabase-mcp-server` `apply_migration` tool to apply all migrations from `supabase/migrations/`:
- `20260401000000_initial_schema.sql`
- `20260402102153_fix_users.sql`

Or run: `npx supabase db push` if Supabase CLI is configured.

## 5. Seed Auth Users
Run: `node scripts/seed-test-users.mjs`

This creates:
- Admin user (`admin@poscursor.com`)
- Collector users

**IMPORTANT**: This script must create all three records: `auth.users`, `auth.identities`, and `public.user_profiles`. If identities are missing, login will fail with "Invalid login credentials".

## 6. Verify Auth
// turbo
Run: `node scripts/verify-auth.mjs`

Check output confirms all users have matching entries across auth.users, auth.identities, and user_profiles.

## 7. Seed Collectors
// turbo
Run: `node scripts/seed-collectors.mjs`

## 8. Start the App
// turbo
Run: `npx expo start`

## 9. Test Login
Open the app and use "Quick Access" buttons on the login screen to verify:
- Admin login works → redirects to `/(admin)`
- Collector login works → redirects to `/(collector)`

## Troubleshooting
- **"Invalid login credentials"**: Run `node scripts/verify-auth.mjs` — check for missing `auth.identities`
- **Dashboard shows no data**: Force sync from Sync Center
- **RLS blocking queries**: Apply `scripts/fix_rls_local.sql` to disable RLS for local dev
