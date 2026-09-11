# POSCursor Operational Runbook

This document provides day-to-day operating procedures for the INFINITY FINANCE POSCursor system.

---

## 1. User Management

### Adding a New User
1. Go to **Supabase Dashboard → Authentication → Users**
2. Click **Invite User** and enter their email
3. The user sets their password via the emailed link
4. Go to **Table Editor → user_profiles** and insert a new row:

```sql
INSERT INTO user_profiles (id, full_name, role, is_active)
VALUES ('<supabase-auth-uid>', 'Full Name', 'collector', true);
```

Valid roles:
- `admin` — full access
- `collector` — field agent, sees only assigned borrowers
- `loan_encoder` — creates/edits loans
- `payment_encoder` — records payments
- `expenses_encoder` — records operational expenses

### Deactivating a User
```sql
UPDATE user_profiles SET is_active = false WHERE id = '<user-id>';
```

Also disable the user in **Supabase Auth Console → Users → [User] → Disable**.

---

## 2. Daily Operations

### Sync Monitoring
- Sync is triggered automatically on app launch (loading screen) and can be forced via the **Sync Now** button in the Admin Dashboard.
- Performance logs are printed with timestamps per table. Check logs if sync takes > 30 seconds.
- Sync order: `user_profiles → borrowers → loans → payment_schedules → payments → expenses → cash_transactions → bank_accounts → bank_transactions → collection_logs → financial_snapshots`

### Offline Usage
- Collectors operate offline by default. All data is saved locally.
- When connectivity is restored, press **Sync** to push pending records to Supabase.
- Pending-sync count badge is visible on the Collector Dashboard header.

---

## 3. KPI & Reporting

### Accessing Financial Reports
Navigate to **Admin → Reports Overview** to access:
- **Portfolio Quality** (PAR > 30 and PAR > 90 days)
- **Profitability** (ROA, ROE, OSS, FSS)
- **Collection Sheet** — daily payments grouped by collector
- **MFI KPIs** — full microfinance indicator dashboard

### Manual Snapshot (FinancialSnapshot)
Financial ratios use data from `financial_snapshots`. Insert monthly snapshots manually:

```sql
INSERT INTO financial_snapshots (
  id, snapshot_date, total_assets, total_equity,
  total_liabilities, loan_loss_reserve, operating_revenue, financial_costs
) VALUES (
  gen_random_uuid(), NOW(), 5000000, 3000000,
  2000000, 50000, 300000, 50000
);
```

---

## 4. Data Backup & Recovery

### Supabase Automated Backups
- Supabase Pro plan includes daily backups. Verify backups are enabled in:
  **Project Settings → Database → Backups**

### Manual Export
```bash
# Export a specific table via Supabase CLI
supabase db dump --table borrowers > borrowers_backup.sql
```

### Recovery from Backup
1. Contact Supabase support to restore from a Point-in-Time backup
2. Or apply a manual SQL dump via Table Editor

---

## 5. Common Troubleshooting

| Issue | Solution |
|---|---|
| Sync hangs / never completes | Check Supabase service status at `status.supabase.com`. Verify RLS policies allow authenticated reads. |
| Login fails | Ensure the user's Supabase Auth account is enabled and `user_profiles` row exists with correct `id`. |
| KPI shows zero values | Ensure `financial_snapshots` table has at least one row. Check that loans have `status = 'active'`. |
| Encrypted data appears garbled | This is expected raw storage. UI displays decrypted values via model getters. |
| App crashes on startup | Run `npm start` and check logs. Check that `.env` has valid Supabase credentials. |

---

## 6. Key Contacts

| Role | Responsibility |
|---|---|
| System Admin | Manages Supabase project, user accounts, and backups |
| MFI Admin (App) | Manages borrowers, loans, expense categories |
| Field Supervisors | Reviews daily collection sheets and KPI trends |
