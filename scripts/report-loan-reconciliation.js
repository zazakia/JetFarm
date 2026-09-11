#!/usr/bin/env node

/**
 * Read-only loan/payment reconciliation report.
 *
 * This script performs SELECT-only checks against the local Supabase Postgres
 * database and writes a Markdown report. It does not mutate app data or schema.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DEFAULT_LIMIT = 25;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const idx = line.indexOf('=');
        if (idx === -1) return [line, ''];
        const key = line.slice(0, idx).trim();
        let value = line.slice(idx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return [key, value];
      })
  );
}

function loadEnv() {
  return {
    ...loadEnvFile('.env'),
    ...loadEnvFile('.env.development'),
    ...loadEnvFile('.env.local'),
    ...process.env,
  };
}

function parseArgs(argv) {
  const args = { limit: DEFAULT_LIMIT, output: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit') {
      args.limit = Number(argv[++i] || DEFAULT_LIMIT);
    } else if (arg === '--output') {
      args.output = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/report-loan-reconciliation.js [--limit 25] [--output docs/reconciliation/report.md]\n\nRead-only. Generates a loan/payment reconciliation Markdown report.`);
      process.exit(0);
    } else if (arg === '--apply') {
      throw new Error('This report script is read-only and does not support --apply.');
    }
  }

  if (!Number.isFinite(args.limit) || args.limit < 1) args.limit = DEFAULT_LIMIT;
  return args;
}

function sqlLimit(limit) {
  return Math.max(1, Math.min(500, Number(limit) || DEFAULT_LIMIT));
}

function makeClient(env) {
  const url = env.SUPABASE_DB_URL || env.DATABASE_URL;
  if (url) return new Client({ connectionString: url });

  return new Client({
    host: env.SUPABASE_DB_HOST || '127.0.0.1',
    port: Number(env.SUPABASE_DB_PORT || 45422),
    user: env.SUPABASE_DB_USER || 'postgres',
    password: env.EXPO_PUBLIC_SUPABASE_DB_PASSWORD || env.SUPABASE_DB_PASSWORD || env.POSTGRES_PASSWORD || 'postgres',
    database: env.SUPABASE_DB_NAME || 'postgres',
  });
}

async function query(client, name, sql, params = []) {
  const result = await client.query(sql, params);
  return { name, rows: result.rows };
}

function formatValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.join(', ');
  return String(value).replace(/\r?\n/g, ' ');
}

function markdownTable(rows) {
  if (!rows || rows.length === 0) return '_No rows._\n';

  const headers = Object.keys(rows[0]);
  const lines = [];
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const row of rows) {
    lines.push(`| ${headers.map((h) => formatValue(row[h]).replace(/\|/g, '\\|')).join(' |')} |`);
  }
  return `${lines.join('\n')}\n`;
}

function section(title, rows) {
  return `\n## ${title}\n\n${markdownTable(rows)}`;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const limit = sqlLimit(args.limit);
  const env = loadEnv();
  const client = makeClient(env);

  await client.connect();

  try {
    // Enforce read-only at the transaction level. The script only uses SELECTs,
    // but this makes accidental future writes fail loudly.
    await client.query('begin read only');

    const reports = [];

    reports.push(await query(client, 'Record Counts', `
      select 'loans' as table_name, count(*)::int as count from app_loans where deleted_at is null
      union all select 'payments', count(*)::int from app_payments where deleted_at is null
      union all select 'payment_schedules', count(*)::int from app_payment_schedules where deleted_at is null
      union all select 'savings_transactions', count(*)::int from app_savings_transactions where deleted_at is null
      order by table_name;
    `));

    reports.push(await query(client, 'Summary Counts', `
      with loan_paid as (
        select l.id, l.borrower_id, l.loan_number, l.status, l.total_amount, coalesce(sum(p.amount),0) as paid
        from app_loans l
        left join app_payments p on p.loan_id = l.id and p.deleted_at is null
        where l.deleted_at is null
        group by l.id, l.borrower_id, l.loan_number, l.status, l.total_amount
      ), schedule_totals as (
        select l.id, l.total_amount, coalesce(sum(s.scheduled_amount),0) as schedule_total, count(s.id) as schedule_count
        from app_loans l
        left join app_payment_schedules s on s.loan_id = l.id and s.deleted_at is null
        where l.deleted_at is null and l.status in ('active','paid','defaulted')
        group by l.id, l.total_amount
      ), duplicate_active as (
        select borrower_id
        from app_loans
        where deleted_at is null and status = 'active'
        group by borrower_id
        having count(*) > 1
      ), schedule_status_expected as (
        select
          s.id,
          s.status,
          case
            when coalesce(lp.paid,0) >= sum(s.scheduled_amount) over (partition by s.loan_id order by s.due_date, s.id rows unbounded preceding) - 1 then 'paid'
            when coalesce(lp.paid,0) > coalesce(sum(s.scheduled_amount) over (partition by s.loan_id order by s.due_date, s.id rows between unbounded preceding and 1 preceding),0) + 1 then 'partial'
            when s.due_date < now() and s.status <> 'paid' then 'late'
            else 'pending'
          end as expected_status
        from app_payment_schedules s
        join app_loans l on l.id = s.loan_id and l.deleted_at is null
        left join loan_paid lp on lp.id = s.loan_id
        where s.deleted_at is null and l.status in ('active','defaulted')
      ), savings_overcredit as (
        select l.id
        from app_loans l
        join app_payments p on p.loan_id = l.id and p.deleted_at is null
        join app_savings_transactions st on st.reference_id = p.id and st.deleted_at is null
        where l.deleted_at is null and st.type = 'deposit' and coalesce(st.notes,'') ilike 'Auto-deposit from payment%'
        group by l.id, l.deposit_amount
        having sum(st.amount) > coalesce(l.deposit_amount,0) + 1
      )
      select 'schedule_total_mismatches' as issue, count(*)::int as count from schedule_totals where abs(schedule_total - total_amount) > 1
      union all select 'paid_status_with_balance', count(*)::int from loan_paid where status = 'paid' and total_amount - paid > 1
      union all select 'active_status_fully_paid', count(*)::int from loan_paid where status = 'active' and total_amount - paid <= 0
      union all select 'overpaid_loans', count(*)::int from loan_paid where paid > total_amount + 1
      union all select 'orphan_payments', count(*)::int from app_payments p left join app_loans l on l.id = p.loan_id and l.deleted_at is null where p.deleted_at is null and l.id is null
      union all select 'orphan_schedules', count(*)::int from app_payment_schedules s left join app_loans l on l.id = s.loan_id and l.deleted_at is null where s.deleted_at is null and l.id is null
      union all select 'borrowers_with_multiple_active_loans', count(*)::int from duplicate_active
      union all select 'renewals_old_loan_not_paid', count(*)::int from app_loans new join app_loans old on old.id = new.previous_loan_id where new.deleted_at is null and old.deleted_at is null and new.is_reloan = true and old.status <> 'paid'
      union all select 'payments_without_schedule_id', count(*)::int from app_payments where deleted_at is null and (schedule_id is null or schedule_id = '')
      union all select 'schedule_status_mismatches', count(*)::int from schedule_status_expected where status <> expected_status
      union all select 'potential_savings_overcredits', count(*)::int from savings_overcredit
      order by issue;
    `));

    reports.push(await query(client, 'Schedule Total Mismatches', `
      select
        l.id,
        l.loan_number,
        b.full_name as borrower_name,
        l.status,
        l.total_amount::numeric(14,2) as loan_total,
        coalesce(sum(s.scheduled_amount),0)::numeric(14,2) as schedule_total,
        (coalesce(sum(s.scheduled_amount),0) - l.total_amount)::numeric(14,2) as difference,
        count(s.id)::int as schedule_count
      from app_loans l
      left join app_borrowers b on b.id::text = l.borrower_id
      left join app_payment_schedules s on s.loan_id = l.id and s.deleted_at is null
      where l.deleted_at is null and l.status in ('active','paid','defaulted')
      group by l.id, l.loan_number, b.full_name, l.status, l.total_amount
      having abs(coalesce(sum(s.scheduled_amount),0) - l.total_amount) > 1
      order by abs(coalesce(sum(s.scheduled_amount),0) - l.total_amount) desc
      limit $1;
    `, [limit]));

    reports.push(await query(client, 'Paid Loans With Remaining Balance', `
      select
        l.id,
        l.loan_number,
        b.full_name as borrower_name,
        l.total_amount::numeric(14,2) as loan_total,
        coalesce(sum(p.amount),0)::numeric(14,2) as paid,
        (l.total_amount - coalesce(sum(p.amount),0))::numeric(14,2) as balance
      from app_loans l
      left join app_borrowers b on b.id::text = l.borrower_id
      left join app_payments p on p.loan_id = l.id and p.deleted_at is null
      where l.deleted_at is null and l.status = 'paid'
      group by l.id, l.loan_number, b.full_name, l.total_amount
      having l.total_amount - coalesce(sum(p.amount),0) > 1
      order by balance desc
      limit $1;
    `, [limit]));

    reports.push(await query(client, 'Overpaid Loans', `
      select
        l.id,
        l.loan_number,
        b.full_name as borrower_name,
        l.status,
        l.total_amount::numeric(14,2) as loan_total,
        coalesce(sum(p.amount),0)::numeric(14,2) as paid,
        (coalesce(sum(p.amount),0) - l.total_amount)::numeric(14,2) as overpaid
      from app_loans l
      join app_payments p on p.loan_id = l.id and p.deleted_at is null
      left join app_borrowers b on b.id::text = l.borrower_id
      where l.deleted_at is null
      group by l.id, l.loan_number, b.full_name, l.status, l.total_amount
      having coalesce(sum(p.amount),0) > l.total_amount + 1
      order by overpaid desc
      limit $1;
    `, [limit]));

    reports.push(await query(client, 'Borrowers With Multiple Active Loans', `
      select
        l.borrower_id,
        b.full_name as borrower_name,
        count(*)::int as active_count,
        string_agg(coalesce(nullif(l.loan_number,''), l.id), ', ' order by l.release_date nulls last) as active_loans
      from app_loans l
      left join app_borrowers b on b.id::text = l.borrower_id
      where l.deleted_at is null and l.status = 'active'
      group by l.borrower_id, b.full_name
      having count(*) > 1
      order by active_count desc, borrower_name
      limit $1;
    `, [limit]));

    reports.push(await query(client, 'Renewals Whose Previous Loan Is Not Paid', `
      select
        old.id as old_loan_id,
        old.loan_number as old_loan_number,
        old.status as old_status,
        new.id as renewal_loan_id,
        new.loan_number as renewal_loan_number,
        new.deducted_amount::numeric(14,2) as deducted_amount,
        b.full_name as borrower_name
      from app_loans new
      join app_loans old on old.id = new.previous_loan_id
      left join app_borrowers b on b.id::text = new.borrower_id
      where new.deleted_at is null
        and old.deleted_at is null
        and new.is_reloan = true
        and old.status <> 'paid'
      order by borrower_name, old.loan_number
      limit $1;
    `, [limit]));

    reports.push(await query(client, 'Schedule Status Mismatches', `
      with loan_paid as (
        select l.id, coalesce(sum(p.amount),0) as paid
        from app_loans l
        left join app_payments p on p.loan_id = l.id and p.deleted_at is null
        where l.deleted_at is null
        group by l.id
      ), expected as (
        select
          s.id,
          s.loan_id,
          l.loan_number,
          b.full_name as borrower_name,
          s.due_date,
          s.scheduled_amount,
          s.status,
          coalesce(lp.paid,0) as total_paid,
          case
            when coalesce(lp.paid,0) >= sum(s.scheduled_amount) over (partition by s.loan_id order by s.due_date, s.id rows unbounded preceding) - 1 then 'paid'
            when coalesce(lp.paid,0) > coalesce(sum(s.scheduled_amount) over (partition by s.loan_id order by s.due_date, s.id rows between unbounded preceding and 1 preceding),0) + 1 then 'partial'
            when s.due_date < now() and s.status <> 'paid' then 'late'
            else 'pending'
          end as expected_status
        from app_payment_schedules s
        join app_loans l on l.id = s.loan_id and l.deleted_at is null
        left join app_borrowers b on b.id::text = l.borrower_id
        left join loan_paid lp on lp.id = s.loan_id
        where s.deleted_at is null and l.status in ('active','defaulted')
      )
      select
        id,
        loan_number,
        borrower_name,
        due_date,
        scheduled_amount::numeric(14,2) as scheduled_amount,
        total_paid::numeric(14,2) as total_paid,
        status,
        expected_status
      from expected
      where status <> expected_status
      order by due_date, loan_number
      limit $1;
    `, [limit]));

    reports.push(await query(client, 'Payments Missing Schedule Link Samples', `
      select
        p.id,
        p.loan_id,
        l.loan_number,
        b.full_name as borrower_name,
        p.amount::numeric(14,2) as amount,
        p.payment_date,
        p.receipt_number
      from app_payments p
      left join app_loans l on l.id = p.loan_id
      left join app_borrowers b on b.id::text = l.borrower_id
      where p.deleted_at is null and (p.schedule_id is null or p.schedule_id = '')
      order by p.payment_date desc nulls last
      limit $1;
    `, [limit]));

    reports.push(await query(client, 'Potential Savings Overcredits', `
      select
        l.id as loan_id,
        l.loan_number,
        b.full_name as borrower_name,
        l.deposit_amount::numeric(14,2) as loan_deposit_amount,
        sum(st.amount)::numeric(14,2) as auto_deposit_total,
        (sum(st.amount) - coalesce(l.deposit_amount,0))::numeric(14,2) as overcredit
      from app_loans l
      join app_payments p on p.loan_id = l.id and p.deleted_at is null
      join app_savings_transactions st on st.reference_id = p.id and st.deleted_at is null
      left join app_borrowers b on b.id::text = l.borrower_id
      where l.deleted_at is null
        and st.type = 'deposit'
        and coalesce(st.notes,'') ilike 'Auto-deposit from payment%'
      group by l.id, l.loan_number, b.full_name, l.deposit_amount
      having sum(st.amount) > coalesce(l.deposit_amount,0) + 1
      order by overcredit desc
      limit $1;
    `, [limit]));

    await client.query('commit');

    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const outPath = args.output || path.join('docs', 'reconciliation', `loan-payment-reconciliation-${stamp}.md`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const body = [
      '# Loan and Payment Reconciliation Report',
      '',
      `Generated: ${now.toISOString()}`,
      '',
      'Mode: read-only SELECT report. No database rows or schema objects were changed.',
      '',
      `Sample limit per detail section: ${limit}`,
      '',
      '## Recommended Review Order',
      '',
      '1. Renewals whose previous loan is not paid',
      '2. Borrowers with multiple active loans',
      '3. Overpaid loans',
      '4. Paid loans with remaining balance',
      '5. Schedule total/status mismatches',
      '6. Payments missing schedule links',
      '7. Potential savings overcredits',
      '',
      ...reports.map((r) => section(r.name, r.rows)),
      '',
      '## Notes',
      '',
      '- This report intentionally does not apply fixes.',
      '- Existing historical statuses may encode imported business truth that is not reconstructable from payment totals alone.',
      '- Any repair script should default to dry-run and require an explicit `--apply` flag.',
      '- Conservative repair candidates are schedule status recomputation, renewal old-loan closure, and schedule link backfill where FIFO allocation is unambiguous.',
      '',
    ].join('\n');

    fs.writeFileSync(outPath, body);

    console.log(`Read-only reconciliation report written to: ${outPath}`);
    console.log('No database changes were made.');
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {
      // ignore rollback errors after failed connection/query
    }
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('[report-loan-reconciliation] Failed:', error);
  process.exit(1);
});
