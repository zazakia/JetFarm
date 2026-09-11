#!/usr/bin/env node

/**
 * Read-only integrity audit for loan/payment/schedule/renewal relationships.
 *
 * Produces a markdown report under docs/reconciliation/ and prints a short
 * summary to stdout. No writes are performed.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const idx = line.indexOf('=');
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

function makeClient(env) {
  if (env.SUPABASE_DB_URL || env.DATABASE_URL) {
    return new Client({ connectionString: env.SUPABASE_DB_URL || env.DATABASE_URL });
  }

  return new Client({
    host: env.SUPABASE_DB_HOST || '127.0.0.1',
    port: Number(env.SUPABASE_DB_PORT || 45422),
    user: env.SUPABASE_DB_USER || 'postgres',
    password: env.EXPO_PUBLIC_SUPABASE_DB_PASSWORD || env.SUPABASE_DB_PASSWORD || env.POSTGRES_PASSWORD || 'postgres',
    database: env.SUPABASE_DB_NAME || 'postgres',
  });
}

function parseArgs(argv) {
  const args = { limit: 25, output: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit') args.limit = Number(argv[++i] || 25);
    else if (arg === '--output') args.output = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/report-loan-payment-integrity.js [--limit 25] [--output docs/reconciliation/<file>.md]');
      process.exit(0);
    }
  }
  if (!Number.isFinite(args.limit) || args.limit < 1) args.limit = 25;
  args.limit = Math.min(args.limit, 500);
  return args;
}

function fmt(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\r?\n/g, ' ');
}

function mdTable(rows) {
  if (!rows || rows.length === 0) return '_No rows._\n';
  const headers = Object.keys(rows[0]);
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${headers.map((key) => fmt(row[key]).replace(/\|/g, '\\|')).join(' | ')} |`),
  ].join('\n') + '\n';
}

async function query(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const client = makeClient(env);

  await client.connect();

  try {
    await client.query('begin read only');

    const summary = await query(client, `
      with loan_paid as (
        select l.id, l.status, l.total_amount, coalesce(sum(p.amount),0) as paid
        from app_loans l
        left join app_payments p on p.loan_id = l.id and p.deleted_at is null
        where l.deleted_at is null
        group by l.id, l.status, l.total_amount
      ),
      active_dupes as (
        select borrower_id
        from app_loans
        where deleted_at is null and status = 'active'
        group by borrower_id
        having count(*) > 1
      ),
      renewal_not_paid as (
        select new.id
        from app_loans new
        join app_loans old on old.id = new.previous_loan_id
        where new.deleted_at is null
          and old.deleted_at is null
          and new.is_reloan = true
          and old.status <> 'paid'
      ),
      schedule_status_expected as (
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
      ),
      schedule_total_mismatch as (
        select l.id
        from app_loans l
        left join app_payment_schedules s on s.loan_id = l.id and s.deleted_at is null
        where l.deleted_at is null and l.status in ('active','paid','defaulted')
        group by l.id, l.total_amount
        having abs(coalesce(sum(s.scheduled_amount),0) - l.total_amount) > 1
      ),
      overcredit as (
        select l.id
        from app_loans l
        join app_payments p on p.loan_id = l.id and p.deleted_at is null
        join app_savings_transactions st on st.reference_id = p.id and st.deleted_at is null
        where l.deleted_at is null
          and st.type = 'deposit'
          and coalesce(st.notes,'') ilike 'Auto-deposit from payment%'
        group by l.id, l.deposit_amount
        having sum(st.amount) > coalesce(l.deposit_amount,0) + 1
      )
      select 'paid_status_with_balance' as issue, count(*)::int as count from loan_paid where status = 'paid' and total_amount - paid > 1
      union all select 'active_status_fully_paid', count(*)::int from loan_paid where status = 'active' and total_amount - paid <= 0
      union all select 'overpaid_loans', count(*)::int from loan_paid where paid > total_amount + 1
      union all select 'payments_without_schedule_id', count(*)::int from app_payments where deleted_at is null and (schedule_id is null or schedule_id = '')
      union all select 'schedule_status_mismatches', count(*)::int from schedule_status_expected where status <> expected_status
      union all select 'schedule_total_mismatches', count(*)::int from schedule_total_mismatch
      union all select 'borrowers_with_multiple_active_loans', count(*)::int from active_dupes
      union all select 'renewals_old_loan_not_paid', count(*)::int from renewal_not_paid
      union all select 'potential_savings_overcredits', count(*)::int from overcredit
      order by issue;
    `);

    const details = {
      activeLoanDuplicates: await query(client, `
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
      `, [args.limit]),
      scheduleStatusMismatches: await query(client, `
        with loan_paid as (
          select l.id, coalesce(sum(p.amount),0) as paid
          from app_loans l
          left join app_payments p on p.loan_id = l.id and p.deleted_at is null
          where l.deleted_at is null
          group by l.id
        ), expected as (
          select
            s.id,
            l.loan_number,
            b.full_name as borrower_name,
            s.due_date,
            s.scheduled_amount::numeric(14,2) as scheduled_amount,
            coalesce(lp.paid,0)::numeric(14,2) as total_paid,
            s.status,
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
        select * from expected
        where status <> expected_status
        order by due_date, loan_number
        limit $1;
      `, [args.limit]),
      paymentsWithoutScheduleId: await query(client, `
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
      `, [args.limit]),
      renewalsWithOpenPreviousLoan: await query(client, `
        select
          old.id as old_loan_id,
          old.loan_number as old_loan_number,
          old.status as old_status,
          new.id as renewal_loan_id,
          new.loan_number as renewal_loan_number,
          b.full_name as borrower_name,
          new.deducted_amount::numeric(14,2) as deducted_amount
        from app_loans new
        join app_loans old on old.id = new.previous_loan_id
        left join app_borrowers b on b.id::text = new.borrower_id
        where new.deleted_at is null
          and old.deleted_at is null
          and new.is_reloan = true
          and old.status <> 'paid'
        order by borrower_name, old.loan_number
        limit $1;
      `, [args.limit]),
      scheduleTotalMismatches: await query(client, `
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
      `, [args.limit]),
      savingsOvercredits: await query(client, `
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
      `, [args.limit]),
    };

    await client.query('commit');

    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const outputPath = args.output || path.join('docs', 'reconciliation', `loan-payment-integrity-${stamp}.md`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const report = [
      '# Loan / Payment Integrity Audit',
      '',
      `Generated: ${now.toISOString()}`,
      '',
      'Mode: read-only SELECT audit. No data or schema changes were made.',
      '',
      '## Summary',
      '',
      mdTable(summary),
      '',
      '## Borrowers With Multiple Active Loans',
      '',
      mdTable(details.activeLoanDuplicates),
      '',
      '## Schedule Status Mismatches',
      '',
      mdTable(details.scheduleStatusMismatches),
      '',
      '## Payments Missing `schedule_id`',
      '',
      mdTable(details.paymentsWithoutScheduleId),
      '',
      '## Renewals Whose Previous Loan Is Not Paid',
      '',
      mdTable(details.renewalsWithOpenPreviousLoan),
      '',
      '## Loan Totals vs Schedule Totals Mismatches',
      '',
      mdTable(details.scheduleTotalMismatches),
      '',
      '## Potential Savings Overcredits',
      '',
      mdTable(details.savingsOvercredits),
      '',
      '## Interpretation',
      '',
      '- `payments.loan_id` is effectively the accounting source of truth in current app logic.',
      '- `payment_schedules.status` is derived and may drift from the stored `schedule_id` on individual payments.',
      '- Renewal chains and auto-deposit savings side effects should be reviewed before any historical repair migration.',
      '',
    ].join('\n');

    fs.writeFileSync(outputPath, report);

    console.log(`Read-only integrity report written to: ${outputPath}`);
    console.log('Top summary counts:');
    for (const row of summary) {
      console.log(`- ${row.issue}: ${row.count}`);
    }
    console.log('No database changes were made.');
  } catch (error) {
    try { await client.query('rollback'); } catch {}
    console.error('[report-loan-payment-integrity] Failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
