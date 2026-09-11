#!/usr/bin/env node

/**
 * Read-only manual-review action pack for remaining reconciliation cases.
 * No writes. Produces markdown + json with suggested next action per row.
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
  return { ...loadEnvFile('.env'), ...loadEnvFile('.env.development'), ...loadEnvFile('.env.local'), ...process.env };
}

function parseArgs(argv) {
  const args = { limit: 50, outputDir: 'docs/reconciliation' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit') args.limit = Number(argv[++i] || 50);
    else if (arg === '--output-dir') args.outputDir = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/report-manual-review-pack.js [--limit 50] [--output-dir docs/reconciliation]');
      process.exit(0);
    }
  }
  if (!Number.isFinite(args.limit) || args.limit < 1) args.limit = 50;
  return args;
}

function makeClient(env) {
  if (env.SUPABASE_DB_URL || env.DATABASE_URL) return new Client({ connectionString: env.SUPABASE_DB_URL || env.DATABASE_URL });
  return new Client({
    host: env.SUPABASE_DB_HOST || '127.0.0.1',
    port: Number(env.SUPABASE_DB_PORT || 45422),
    user: env.SUPABASE_DB_USER || 'postgres',
    password: env.EXPO_PUBLIC_SUPABASE_DB_PASSWORD || env.SUPABASE_DB_PASSWORD || env.POSTGRES_PASSWORD || 'postgres',
    database: env.SUPABASE_DB_NAME || 'postgres',
  });
}

function fmt(v) { return v === null || v === undefined ? '' : String(v).replace(/\r?\n/g, ' '); }
function mdTable(rows) {
  if (!rows || rows.length === 0) return '_No rows._\n';
  const headers = Object.keys(rows[0]);
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${headers.map((h) => fmt(row[h]).replace(/\|/g, '\\|')).join(' | ')} |`),
  ].join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const client = makeClient(env);
  await client.connect();
  await client.query('begin read only');
  try {
    const limit = args.limit;

    const queries = {
      paidBalances: `
        select
          l.id,
          l.loan_number,
          b.full_name as borrower_name,
          l.total_amount::numeric(14,2) as loan_total,
          coalesce(sum(p.amount),0)::numeric(14,2) as paid,
          (l.total_amount - coalesce(sum(p.amount),0))::numeric(14,2) as balance,
          case
            when coalesce(sum(p.amount),0) = 0 then 'manual_review_reopen_or_history_exception'
            when l.loan_number like 'LN-20260328-%' then 'likely_imported_history_manual_review'
            else 'manual_review_reopen_or_add_closing_adjustment'
          end as suggested_action,
          'Paid status remains with positive balance; accounting policy required before mutation.' as rationale
        from app_loans l
        left join app_borrowers b on b.id::text = l.borrower_id
        left join app_payments p on p.loan_id = l.id and p.deleted_at is null
        where l.deleted_at is null and l.status = 'paid'
        group by l.id, l.loan_number, b.full_name, l.total_amount
        having l.total_amount - coalesce(sum(p.amount),0) > 1
        order by balance desc
        limit $1;
      `,
      overpaid: `
        select
          l.id,
          l.loan_number,
          b.full_name as borrower_name,
          l.status,
          l.total_amount::numeric(14,2) as loan_total,
          coalesce(sum(p.amount),0)::numeric(14,2) as paid,
          (coalesce(sum(p.amount),0) - l.total_amount)::numeric(14,2) as overpaid,
          case
            when (coalesce(sum(p.amount),0) - l.total_amount) > 1000 then 'manual_review_duplicate_or_credit_or_refund'
            else 'manual_review_minor_overpayment'
          end as suggested_action,
          'Overpayments should not be auto-corrected without deciding whether to refund, credit, or remove duplicates.' as rationale
        from app_loans l
        join app_payments p on p.loan_id = l.id and p.deleted_at is null
        left join app_borrowers b on b.id::text = l.borrower_id
        where l.deleted_at is null
        group by l.id, l.loan_number, b.full_name, l.status, l.total_amount
        having coalesce(sum(p.amount),0) > l.total_amount + 1
        order by overpaid desc
        limit $1;
      `,
      duplicateActive: `
        select
          l.borrower_id,
          b.full_name as borrower_name,
          count(*)::int as active_count,
          string_agg(coalesce(nullif(l.loan_number,''), l.id), ', ' order by l.release_date nulls last) as active_loans,
          'manual_review_choose_authoritative_active_loan' as suggested_action,
          'Multiple active loans require business decision about which loan should remain active.' as rationale
        from app_loans l
        left join app_borrowers b on b.id::text = l.borrower_id
        where l.deleted_at is null and l.status = 'active'
        group by l.borrower_id, b.full_name
        having count(*) > 1
        order by active_count desc, borrower_name
        limit $1;
      `,
      scheduleTotals: `
        select
          l.id,
          l.loan_number,
          b.full_name as borrower_name,
          l.status,
          l.total_amount::numeric(14,2) as loan_total,
          coalesce(sum(s.scheduled_amount),0)::numeric(14,2) as schedule_total,
          (coalesce(sum(s.scheduled_amount),0) - l.total_amount)::numeric(14,2) as difference,
          count(s.id)::int as schedule_count,
          case
            when count(s.id) = 0 then 'manual_review_generate_or_restore_schedules'
            when abs(coalesce(sum(s.scheduled_amount),0) - l.total_amount) > l.total_amount * 0.9 then 'manual_review_duplicate_or_doubled_schedule_set'
            else 'manual_review_recompute_schedule_amounts'
          end as suggested_action,
          'Schedule totals do not match stored loan totals; automatic repair could corrupt historical repayment plans.' as rationale
        from app_loans l
        left join app_borrowers b on b.id::text = l.borrower_id
        left join app_payment_schedules s on s.loan_id = l.id and s.deleted_at is null
        where l.deleted_at is null and l.status in ('active','paid','defaulted')
        group by l.id, l.loan_number, b.full_name, l.status, l.total_amount
        having abs(coalesce(sum(s.scheduled_amount),0) - l.total_amount) > 1
        order by abs(coalesce(sum(s.scheduled_amount),0) - l.total_amount) desc
        limit $1;
      `,
      savingsOvercredits: `
        select
          l.id as loan_id,
          l.loan_number,
          b.full_name as borrower_name,
          l.deposit_amount::numeric(14,2) as loan_deposit_amount,
          sum(st.amount)::numeric(14,2) as auto_deposit_total,
          (sum(st.amount) - coalesce(l.deposit_amount,0))::numeric(14,2) as overcredit,
          'manual_review_reverse_excess_auto_deposits' as suggested_action,
          'Existing auto-deposit history predates the fix and should be reviewed before reversing savings entries.' as rationale
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
      `,
      unresolvedScheduleLinks: `
        select
          p.id as payment_id,
          p.loan_id,
          l.loan_number,
          b.full_name as borrower_name,
          p.amount::numeric(14,2) as amount,
          p.payment_date,
          p.receipt_number,
          'manual_review_spans_multiple_schedules_or_missing_schedule_context' as suggested_action,
          'These payments remained unlinked after safe FIFO backfill because they likely span multiple schedules or lack enough context.' as rationale
        from app_payments p
        left join app_loans l on l.id = p.loan_id
        left join app_borrowers b on b.id::text = l.borrower_id
        where p.deleted_at is null and (p.schedule_id is null or p.schedule_id = '')
        order by p.payment_date desc nulls last
        limit $1;
      `,
    };

    const sections = {};
    for (const [key, sql] of Object.entries(queries)) {
      const { rows } = await client.query(sql, [limit]);
      sections[key] = rows;
    }

    await client.query('commit');

    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    fs.mkdirSync(args.outputDir, { recursive: true });
    const jsonPath = path.join(args.outputDir, `manual-review-action-pack-${stamp}.json`);
    const mdPath = path.join(args.outputDir, `manual-review-action-pack-${stamp}.md`);

    fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: now.toISOString(), sections }, null, 2));

    const summary = [
      { section: 'Paid loans with balance', count: sections.paidBalances.length },
      { section: 'Overpaid loans', count: sections.overpaid.length },
      { section: 'Borrowers with multiple active loans', count: sections.duplicateActive.length },
      { section: 'Schedule total mismatches', count: sections.scheduleTotals.length },
      { section: 'Potential savings overcredits', count: sections.savingsOvercredits.length },
      { section: 'Unresolved missing schedule links (sample)', count: sections.unresolvedScheduleLinks.length },
    ];

    const md = [
      '# Manual Review Action Pack',
      '',
      `Generated: ${now.toISOString()}`,
      '',
      'Mode: read-only. No DB writes were performed.',
      '',
      '## Purpose',
      '',
      'This pack isolates the remaining reconciliation cases that were intentionally not auto-fixed or were only partially addressed by safe automation. Each row includes a suggested next action and rationale.',
      '',
      '## Summary',
      '',
      mdTable(summary),
      '',
      '## Review Order',
      '',
      '1. Overpaid loans',
      '2. Borrowers with multiple active loans',
      '3. Paid loans with remaining balance',
      '4. Schedule total mismatches',
      '5. Potential savings overcredits',
      '6. Unresolved schedule-link cases',
      '',
      '## Paid loans with remaining balance',
      '',
      mdTable(sections.paidBalances),
      '',
      '## Overpaid loans',
      '',
      mdTable(sections.overpaid),
      '',
      '## Borrowers with multiple active loans',
      '',
      mdTable(sections.duplicateActive),
      '',
      '## Schedule total mismatches',
      '',
      mdTable(sections.scheduleTotals),
      '',
      '## Potential savings overcredits',
      '',
      mdTable(sections.savingsOvercredits),
      '',
      '## Unresolved missing schedule links (sample)',
      '',
      mdTable(sections.unresolvedScheduleLinks),
      '',
      '## Recommended next operations',
      '',
      '- Build a reviewed apply script for manual-review-approved rows only.',
      '- Treat overpayments as accounting-policy decisions, not automatic mutations.',
      '- For duplicate active loans, decide the canonical active loan before any status changes.',
      '- For schedule total mismatches, inspect whether schedules are missing, duplicated, or based on wrong loan terms.',
      '- For savings overcredits, reverse only after confirming no legitimate savings-credit workflow created the entries.',
      '',
      `JSON artifact: ${jsonPath}`,
      '',
    ].join('\n');

    fs.writeFileSync(mdPath, md);
    console.log(`Manual-review action pack written to: ${mdPath}`);
    console.log(`JSON action pack written to: ${jsonPath}`);
  } catch (error) {
    try { await client.query('rollback'); } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[report-manual-review-pack] Failed:', error);
  process.exit(1);
});
