# Agri-One — the agribusiness-only branch

Branch: `agribusiness-only` (created from `main` at `3b5c1c5`).
Product name: **Agri-One**. The Android package id stays `com.jetfarm.app` so an existing
installer can be upgraded in place; only `app.json` `name`/`slug` and the in-app brand change.

## What this is

A parallel variant of JetFarm in which the cooperative-lending product is **physically
removed**, not hidden behind a flag. The lending screens, CIC regulatory reporting, the four
MPCo business-unit modules (including the only working one, water-station), marketplace,
payroll, franchise, QSR POS and commissary/branch operations are deleted from the source
tree, from the WatermelonDB schema, from the sync contract, and from the remote database.

Kept:

- the 13 agribusiness screens under `app/(admin)/agribusiness/`, `src/components/ParcelMap/`,
  the `Agri*` services, `LandSettlementEngine`, and the 15 `agri_*` tables
  (`agri_pending_layout_operations` stays local-only by design),
- the shared finance layer: `app/(admin)/accounting/`, journal entries, chart of accounts,
  cash/bank/expenses/transfers/suppliers/accounts-payable, and the 10 financial-statement
  reports,
- the admin shell: auth, users, areas, settings, sync center, backup/encryption, and the
  expenses-encoder group.

## Never replaces production

Production (`https://supabase.818.quest`, mirrored app on Hetzner, canonical releases on
Cloudflare Pages) is served only from `main`. This branch is a variant and must not be
deployed over it.

`supabase/migrations/20261021000000_retire_non_agribusiness_tables.sql` **destroys data**. It
is marked LOCAL/VARIANT ONLY and is protected twice:

1. its own guard counts the rows in every table it is about to drop and aborts unless the
   operator consciously opts in inside the same session:

   ```sql
   SET jetfarm.allow_non_agribusiness_data_loss = 'on';
   ```

   A fresh or reset local database has zero rows there, so `supabase db reset` applies it
   unattended — which is how it is proved, without that proof being possible against a
   database that has real lending records.
2. the human-only rule in `AGENTS.md`: `db:migrate:apply`,
   `scripts/apply-hetzner-migrations.mjs --apply`, the cloud `--apply` runner and every
   deploy path are never agent actions.

## Local proof recipe

```bash
# WSL Ubuntu owns the Docker stacks (never Docker Desktop on this box)
wsl -d Ubuntu
cd /mnt/d/GitHub/JetFarm
supabase db reset            # project_id = jetfarm-local, replays every migration + seed.sql
npm run check:sync           # expect "Tables reachable: 39/39 ... 0 failed"
```

After a reset, `public` holds 40 tables: the 39 remote names in
`src/services/syncTableContract.json -> remoteTableMap` plus `demo_inquiries`, which
`app/login.tsx` → `InquiryService` still posts to. Only these identities are seeded:
`admin@poscursor.com`, `cybergada@gmail.com`, `expenses_encoder@poscursor.com`,
`mainoffice@poscursor.com` (local-only password `12345678`).

## Rollback

The branch itself is disposable:

```bash
git checkout main && git branch -D agribusiness-only
```

A `supabase db reset` **re-applies** the drop, so resetting does not recover retired tables.
Before re-authoring the retirement migration, keep a plain dump:

```bash
docker exec supabase_db_jetfarm-local pg_dump -U postgres -d postgres \
  --schema=public -f /tmp/pre_s9_dump.sql
docker cp supabase_db_jetfarm-local:/tmp/pre_s9_dump.sql /tmp/
```

If the migration ever reaches the wrong database, detect it with

```sql
SELECT version FROM deploy_schema_migrations WHERE version = '20261021000000';
```

and restore from the latest backup snapshot. No compensating migration is attempted.

## Deliberate deviations

| Kept | Why |
|---|---|
| `stock_movements` | the kept `InventoryJournalService` and `accounting/inventory-journal` screen write it |
| `suppliers`, `accounts_payable_vouchers` | `AccountsPayableService` + `PurchaseJournalService` |
| `statutory_rates`, `statutory_fund_allocations` | the statutory-reserve note of the financial statements |
| `demo_inquiries` | `app/login.tsx` posts demo requests through `InquiryService` |
| `crj.tsx`, `cdj.tsx`, `suppliers.tsx` | pure `JournalEntry`/`CashReceiptsJournalService` surfaces; only their loan labels go |

Enforced by `src/database/nonAgriSchemaGuards.test.ts`, which derives the retired set from
the v50 migration and fails if a deviation is dropped or an undocumented one survives.
