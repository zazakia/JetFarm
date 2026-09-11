# POSCursor Deployment Guide

This guide covers how to deploy the POSCursor React Native Expo app to production.

---

## 1. Environment Setup

### Required Environment Variables

Create a `.env` file in `jetfarm-local/`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_SUPABASE_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
```

> **IMPORTANT**: Never commit `.env` to source control. Ensure `.env` is in `.gitignore`.

---

## 2. Supabase Backend Setup

### 2.1 Required Tables

Execute these migrations in the Supabase SQL editor. All tables must have a `deleted_at` column for soft-delete sync support.

| Table | Key Columns |
|---|---|
| `user_profiles` | `id`, `full_name`, `role`, `is_active` |
| `borrowers` | `id`, `full_name`, `address`, `phone`, `collector_id` |
| `loans` | `id`, `borrower_id`, `loan_number`, `principal_amount`, `status` |
| `payments` | `id`, `loan_id`, `amount`, `payment_date` |
| `payment_schedules` | `id`, `loan_id`, `due_date`, `scheduled_amount`, `status` |
| `expenses` | `id`, `category`, `amount`, `expense_date` |
| `cash_transactions` | `id`, `type`, `amount`, `transaction_date` |
| `bank_accounts` | `id`, `bank_name`, `account_number`, `starting_balance` |
| `bank_transactions` | `id`, `bank_account_id`, `type`, `amount` |
| `collection_logs` | `id`, `collector_id`, `log_date`, `total_collected` |
| `financial_snapshots` | `id`, `snapshot_date`, `total_assets`, `total_equity` |

### 2.2 Row-Level Security (RLS)

Enable RLS on all tables. At minimum, apply this policy pattern:

```sql
-- Allow authenticated users to read all data
CREATE POLICY "auth_read" ON borrowers
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow updates only from authenticated users
CREATE POLICY "auth_write" ON borrowers
  FOR ALL USING (auth.role() = 'authenticated');
```

### 2.3 User Accounts

User accounts are created via Supabase Auth Console. After creating a user, insert their profile:

```sql
INSERT INTO user_profiles (id, full_name, role, is_active)
VALUES ('auth-uid-here', 'John Doe', 'admin', true);
```

Valid roles: `admin`, `collector`, `loan_encoder`, `payment_encoder`, `expenses_encoder`

---

## 3. Building for Production

### 3.1 Android APK / AAB

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Build Android APK (for testing)
eas build --platform android --profile preview

# Build Android AAB (for Play Store)
eas build --platform android --profile production
```

### 3.2 iOS IPA

```bash
eas build --platform ios --profile production
```

### 3.3 Local Android Build (Debug)

```bash
# Start Android emulator, then:
npm run android
```

---

## 4. `eas.json` Configuration

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "preview": {
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" },
      "ios": {}
    }
  }
}
```

---

## 5. Deployment to Netlify (Web)

Netlify is the recommended platform for the Admin Web Dashboard.

### 5.1 Prerequisites
- A Netlify account.
- The project's GitHub repository connected to Netlify.

### 5.2 Environment Variables in Netlify
Before deploying, you **MUST** set these in the Netlify dashboard under **Site Settings > Build & Deploy > Environment**:

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Project Anon Key |

### 5.3 Build Settings
Netlify will automatically detect the `netlify.toml` file, but if you need to set them manually:
- **Build command**: `npm run export:web`
- **Publish directory**: `dist`

### 5.4 Handling Client-Side Routing
The `netlify.toml` in this repository already handles SPA routing by redirecting all requests to `index.html`.

---

## 6. Verification Checklist (Pre-Launch)

- [ ] Supabase RLS policies applied to all tables
- [ ] `.env` variables set correctly (never hardcoded in source)
- [ ] All user profiles created with correct roles
- [ ] Test sync by creating a record offline and toggling connectivity
- [ ] Verify PII fields are encrypted in the local SQLite DB
- [ ] Run `npm test` → all 84 tests pass
- [ ] Test on both Android and iOS (or web for admin)
