# Metabase BI Deployment Guide — Viterbo Foods OPC
## Drag-and-Drop Dashboards for Crispy King (39 Branches)

### Prerequisites
- Hetzner Cloud CPX11 VPS (€4.85/mo ≈ ₱305/mo) — Singapore datacenter
- Docker + Docker Compose installed
- Supabase PostgreSQL connection string (read-only recommended)

---

## 1. Docker Compose Setup

```yaml
# docker-compose.yml — save on your Hetzner VPS
version: '3.9'

services:
  metabase:
    image: metabase/metabase:latest
    container_name: metabase
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      MB_DB_TYPE: postgres
      MB_DB_DBNAME: metabase_app
      MB_DB_PORT: 5432
      MB_DB_USER: metabase
      MB_DB_PASS: "${METABASE_DB_PASSWORD}"
      MB_DB_HOST: metabase-db
      JAVA_TIMEZONE: Asia/Manila
    depends_on:
      - metabase-db
    volumes:
      - metabase-data:/metabase-data

  metabase-db:
    image: postgres:15-alpine
    container_name: metabase-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: metabase_app
      POSTGRES_USER: metabase
      POSTGRES_PASSWORD: "${METABASE_DB_PASSWORD}"
    volumes:
      - metabase-pgdata:/var/lib/postgresql/data

  caddy:
    image: caddy:2-alpine
    container_name: caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
      - caddy-config:/config

volumes:
  metabase-data:
  metabase-pgdata:
  caddy-data:
  caddy-config:
```

## 2. Caddyfile (Auto-TLS)

```
# Caddyfile
bi.crispyking.ph {
    reverse_proxy metabase:3000
}
```

## 3. Deploy

```bash
# SSH into Hetzner VPS
ssh root@your-vps-ip

# Create project directory
mkdir -p /opt/metabase && cd /opt/metabase

# Create .env file
echo 'METABASE_DB_PASSWORD=your_secure_password_here' > .env

# Copy docker-compose.yml and Caddyfile (from above)

# Launch
docker compose up -d

# Metabase will be available at https://bi.crispyking.ph after ~60 seconds
```

## 4. Connect to Supabase PostgreSQL

1. Open Metabase → Admin → Databases → Add Database
2. **Database type:** PostgreSQL
3. **Host:** `db.YOUR_SUPABASE_PROJECT.supabase.co`
4. **Port:** `5432`
5. **Database name:** `postgres`
6. **Username:** `postgres` (or create a read-only role)
7. **Password:** Your Supabase database password
8. **SSL:** Required

> **Recommendation:** Create a read-only PostgreSQL role for Metabase to prevent
> accidental writes from dashboard queries.

```sql
-- Run in Supabase SQL Editor
CREATE ROLE metabase_reader WITH LOGIN PASSWORD 'strong_password_here';
GRANT USAGE ON SCHEMA public TO metabase_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO metabase_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO metabase_reader;
```

## 5. Pre-Built Dashboard Queries

### Dashboard 1: Executive Overview (Harrison Viterbo)

```sql
-- Top/Bottom 5 Branches by Net Income (Current Month)
SELECT
    branch_id AS "Branch",
    SUM(CASE WHEN coa.account_type = 'income'
        THEN jel.credit_amount - jel.debit_amount ELSE 0 END) AS "Gross Sales",
    SUM(CASE WHEN coa.code LIKE '5%'
        THEN jel.debit_amount - jel.credit_amount ELSE 0 END) AS "COGS",
    SUM(CASE WHEN coa.code LIKE '6%'
        THEN jel.debit_amount - jel.credit_amount ELSE 0 END) AS "OPEX",
    SUM(CASE WHEN coa.account_type = 'income'
        THEN jel.credit_amount - jel.debit_amount ELSE 0 END)
    - SUM(CASE WHEN coa.code LIKE '5%' OR coa.code LIKE '6%'
        THEN jel.debit_amount - jel.credit_amount ELSE 0 END) AS "Net Income"
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN chart_of_accounts coa ON coa.code = jel.account_code
WHERE je.is_posted = TRUE
  AND je.deleted_at IS NULL
  AND je.fiscal_year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND je.fiscal_month = EXTRACT(MONTH FROM CURRENT_DATE)
GROUP BY branch_id
ORDER BY "Net Income" DESC;
```

### Dashboard 2: BIR 8 Books Export

```sql
-- Simply query the pre-built views:
SELECT * FROM vw_bir_sales_journal WHERE "Branch" = 'BAGACAY';
SELECT * FROM vw_bir_cash_receipts_journal;
SELECT * FROM vw_bir_cash_disbursement_journal;
SELECT * FROM vw_bir_accounts_receivable;
SELECT * FROM vw_bir_accounts_payable;
SELECT * FROM vw_bir_purchase_journal;
SELECT * FROM vw_bir_inventory_journal;
SELECT * FROM vw_bir_general_journal;
```

### Dashboard 3: Franchise Royalty Summary

```sql
SELECT * FROM vw_franchise_royalty_summary
WHERE "Year" = 2026
ORDER BY "Month" DESC, "Gross Sales" DESC;
```

### Dashboard 4: Device Health Monitor

```sql
-- Devices not seen in 24+ hours (potential theft/failure)
SELECT
    device_name,
    branch_id,
    app_version,
    last_heartbeat,
    EXTRACT(HOURS FROM NOW() - last_heartbeat) AS "Hours Since Last Seen",
    is_locked,
    wipe_requested
FROM device_registry
WHERE is_active = TRUE
  AND last_heartbeat < NOW() - INTERVAL '24 hours'
ORDER BY last_heartbeat ASC;
```

## 6. Scheduled Email Reports

1. Metabase → Dashboard → Click ⚙️ → **Subscriptions**
2. Add email subscription:
   - **Recipients:** harrison@viterbofoods.com, supervisors
   - **Schedule:** Every Monday 7:00 AM (Manila time)
   - **Format:** PDF attachment
3. This replaces the manual Excel MANCOM report compilation entirely.

## Monthly Cost: ₱305/month (Hetzner CPX11)
