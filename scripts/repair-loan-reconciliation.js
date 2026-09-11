#!/usr/bin/env node

/**
 * Guarded loan/payment reconciliation repair tool.
 *
 * Default is dry-run. Apply mode requires:
 *   --apply --confirm-report <existing reconciliation report path>
 *
 * Safe apply modes:
 *   renewals        Close previous loans referenced by active renewals.
 *   schedules       Recompute active/defaulted schedule statuses from cumulative payments.
 *   schedule-links  Backfill payment.schedule_id only when a payment fits within one FIFO schedule bucket.
 *   all-safe        Run all safe modes above.
 *
 * Report-only modes:
 *   overpayments, paid-balances, schedule-totals
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const SAFE_MODES = new Set(['renewals', 'schedules', 'schedule-links']);
const REPORT_ONLY_MODES = new Set(['overpayments', 'paid-balances', 'schedule-totals']);

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
  const args = {
    mode: 'all-safe',
    apply: false,
    confirmReport: null,
    outputDir: 'docs/reconciliation',
    limit: 50,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mode') args.mode = argv[++i];
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--dry-run') args.apply = false;
    else if (arg === '--confirm-report') args.confirmReport = argv[++i];
    else if (arg === '--output-dir') args.outputDir = argv[++i];
    else if (arg === '--limit') args.limit = Number(argv[++i] || args.limit);
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/repair-loan-reconciliation.js [--mode all-safe|renewals|schedules|schedule-links|overpayments|paid-balances|schedule-totals] [--apply --confirm-report <report.md>] [--output-dir docs/reconciliation]\n\nDefault is dry-run. Report-only modes cannot be applied.`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.mode === 'all-safe') args.modes = Array.from(SAFE_MODES);
  else args.modes = args.mode.split(',').map((m) => m.trim()).filter(Boolean);

  const unknown = args.modes.filter((m) => !SAFE_MODES.has(m) && !REPORT_ONLY_MODES.has(m));
  if (unknown.length > 0) throw new Error(`Unknown mode(s): ${unknown.join(', ')}`);

  const reportOnlyApplied = args.apply && args.modes.some((m) => REPORT_ONLY_MODES.has(m));
  if (reportOnlyApplied) throw new Error('Report-only modes cannot be used with --apply.');

  if (args.apply) {
    if (!args.confirmReport) throw new Error('--apply requires --confirm-report <existing report path>.');
    if (!fs.existsSync(args.confirmReport)) throw new Error(`Confirm report not found: ${args.confirmReport}`);
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

function asNum(v) { return Number(v || 0); }
function fmt(v) { return v === null || v === undefined ? '' : String(v).replace(/\r?\n/g, ' '); }

function markdownTable(rows) {
  if (!rows || rows.length === 0) return '_No rows._\n';
  const headers = Object.keys(rows[0]);
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${headers.map((h) => fmt(row[h]).replace(/\|/g, '\\|')).join(' | ')} |`),
  ].join('\n') + '\n';
}

async function fetchRenewalProposals(client) {
  const { rows } = await client.query(`
    select
      old.id as old_loan_id,
      old.loan_number as old_loan_number,
      old.status as old_status,
      old.collector_id as old_collector_id,
      new.id as renewal_loan_id,
      new.loan_number as renewal_loan_number,
      new.deducted_amount,
      b.full_name as borrower_name,
      coalesce((select count(*) from app_payment_schedules s where s.loan_id = old.id and s.deleted_at is null and s.status <> 'paid'),0)::int as schedules_to_mark_paid
    from app_loans new
    join app_loans old on old.id = new.previous_loan_id
    left join app_borrowers b on b.id::text = new.borrower_id
    where new.deleted_at is null
      and old.deleted_at is null
      and new.is_reloan = true
      and old.status <> 'paid'
    order by borrower_name, old.loan_number;
  `);
  return rows.map((row) => ({
    mode: 'renewals',
    action: 'close_previous_loan',
    ...row,
  }));
}

async function fetchScheduleStatusProposals(client) {
  const { rows } = await client.query(`
    with loan_paid as (
      select l.id, coalesce(sum(p.amount),0) as paid
      from app_loans l
      left join app_payments p on p.loan_id = l.id and p.deleted_at is null
      where l.deleted_at is null
      group by l.id
    ), expected as (
      select
        s.id as schedule_id,
        s.loan_id,
        l.loan_number,
        b.full_name as borrower_name,
        s.status as current_status,
        case
          when coalesce(lp.paid,0) >= sum(s.scheduled_amount) over (partition by s.loan_id order by s.due_date, s.id rows unbounded preceding) - 1 then 'paid'
          when coalesce(lp.paid,0) > coalesce(sum(s.scheduled_amount) over (partition by s.loan_id order by s.due_date, s.id rows between unbounded preceding and 1 preceding),0) + 1 then 'partial'
          when s.due_date < now() and s.status <> 'paid' then 'late'
          else 'pending'
        end as expected_status,
        s.due_date,
        s.scheduled_amount,
        coalesce(lp.paid,0) as loan_paid
      from app_payment_schedules s
      join app_loans l on l.id = s.loan_id and l.deleted_at is null
      left join app_borrowers b on b.id::text = l.borrower_id
      left join loan_paid lp on lp.id = s.loan_id
      where s.deleted_at is null and l.status in ('active','defaulted')
    )
    select * from expected where current_status <> expected_status order by due_date, loan_number, schedule_id;
  `);
  return rows.map((row) => ({ mode: 'schedules', action: 'update_schedule_status', ...row }));
}

async function fetchScheduleLinkProposals(client) {
  const { rows: loans } = await client.query(`
    select distinct l.id, l.loan_number, b.full_name as borrower_name
    from app_loans l
    join app_payments p on p.loan_id = l.id and p.deleted_at is null and (p.schedule_id is null or p.schedule_id = '')
    left join app_borrowers b on b.id::text = l.borrower_id
    where l.deleted_at is null
    order by l.loan_number nulls last, l.id;
  `);

  const proposals = [];
  const skipped = [];

  for (const loan of loans) {
    const { rows: schedules } = await client.query(`
      select id, scheduled_amount
      from app_payment_schedules
      where deleted_at is null and loan_id = $1
      order by due_date, id;
    `, [loan.id]);
    const { rows: payments } = await client.query(`
      select id, amount, payment_date, receipt_number
      from app_payments
      where deleted_at is null and loan_id = $1 and (schedule_id is null or schedule_id = '')
      order by payment_date nulls last, id;
    `, [loan.id]);

    if (schedules.length === 0) {
      for (const payment of payments) skipped.push({ mode: 'schedule-links', action: 'skip_no_schedules', loan_id: loan.id, loan_number: loan.loan_number, payment_id: payment.id, amount: payment.amount });
      continue;
    }

    let scheduleIndex = 0;
    let remainingInSchedule = asNum(schedules[0].scheduled_amount);

    for (const payment of payments) {
      const amount = asNum(payment.amount);
      while (scheduleIndex < schedules.length && remainingInSchedule <= 1) {
        scheduleIndex += 1;
        remainingInSchedule = scheduleIndex < schedules.length ? asNum(schedules[scheduleIndex].scheduled_amount) : 0;
      }

      if (scheduleIndex >= schedules.length) {
        skipped.push({ mode: 'schedule-links', action: 'skip_no_remaining_schedule', loan_id: loan.id, loan_number: loan.loan_number, payment_id: payment.id, amount });
        continue;
      }

      if (amount <= remainingInSchedule + 1) {
        proposals.push({
          mode: 'schedule-links',
          action: 'backfill_payment_schedule_id',
          loan_id: loan.id,
          loan_number: loan.loan_number,
          borrower_name: loan.borrower_name,
          payment_id: payment.id,
          payment_amount: amount,
          schedule_id: schedules[scheduleIndex].id,
          schedule_remaining_before: remainingInSchedule,
        });
        remainingInSchedule -= amount;
      } else {
        skipped.push({
          mode: 'schedule-links',
          action: 'skip_payment_spans_multiple_schedules',
          loan_id: loan.id,
          loan_number: loan.loan_number,
          payment_id: payment.id,
          amount,
          schedule_id: schedules[scheduleIndex].id,
          schedule_remaining_before: remainingInSchedule,
        });
        // Advance the FIFO cursor as if the payment was applied, but do not link a multi-schedule payment.
        let remainingPayment = amount;
        while (remainingPayment > 1 && scheduleIndex < schedules.length) {
          if (remainingPayment >= remainingInSchedule) {
            remainingPayment -= remainingInSchedule;
            scheduleIndex += 1;
            remainingInSchedule = scheduleIndex < schedules.length ? asNum(schedules[scheduleIndex].scheduled_amount) : 0;
          } else {
            remainingInSchedule -= remainingPayment;
            remainingPayment = 0;
          }
        }
      }
    }
  }

  return { proposals, skipped };
}

async function fetchReportOnly(client, mode, limit) {
  if (mode === 'overpayments') {
    const { rows } = await client.query(`
      select l.id, l.loan_number, b.full_name as borrower_name, l.status, l.total_amount::numeric(14,2) as loan_total,
             coalesce(sum(p.amount),0)::numeric(14,2) as paid,
             (coalesce(sum(p.amount),0) - l.total_amount)::numeric(14,2) as overpaid
      from app_loans l
      join app_payments p on p.loan_id = l.id and p.deleted_at is null
      left join app_borrowers b on b.id::text = l.borrower_id
      where l.deleted_at is null
      group by l.id, l.loan_number, b.full_name, l.status, l.total_amount
      having coalesce(sum(p.amount),0) > l.total_amount + 1
      order by overpaid desc limit $1;
    `, [limit]);
    return rows.map((row) => ({ mode, action: 'manual_review_overpayment', ...row }));
  }

  if (mode === 'paid-balances') {
    const { rows } = await client.query(`
      select l.id, l.loan_number, b.full_name as borrower_name, l.total_amount::numeric(14,2) as loan_total,
             coalesce(sum(p.amount),0)::numeric(14,2) as paid,
             (l.total_amount - coalesce(sum(p.amount),0))::numeric(14,2) as balance
      from app_loans l
      left join app_borrowers b on b.id::text = l.borrower_id
      left join app_payments p on p.loan_id = l.id and p.deleted_at is null
      where l.deleted_at is null and l.status = 'paid'
      group by l.id, l.loan_number, b.full_name, l.total_amount
      having l.total_amount - coalesce(sum(p.amount),0) > 1
      order by balance desc limit $1;
    `, [limit]);
    return rows.map((row) => ({ mode, action: 'manual_review_paid_with_balance', ...row }));
  }

  if (mode === 'schedule-totals') {
    const { rows } = await client.query(`
      select l.id, l.loan_number, b.full_name as borrower_name, l.status, l.total_amount::numeric(14,2) as loan_total,
             coalesce(sum(s.scheduled_amount),0)::numeric(14,2) as schedule_total,
             (coalesce(sum(s.scheduled_amount),0) - l.total_amount)::numeric(14,2) as difference,
             count(s.id)::int as schedule_count
      from app_loans l
      left join app_borrowers b on b.id::text = l.borrower_id
      left join app_payment_schedules s on s.loan_id = l.id and s.deleted_at is null
      where l.deleted_at is null and l.status in ('active','paid','defaulted')
      group by l.id, l.loan_number, b.full_name, l.status, l.total_amount
      having abs(coalesce(sum(s.scheduled_amount),0) - l.total_amount) > 1
      order by abs(coalesce(sum(s.scheduled_amount),0) - l.total_amount) desc limit $1;
    `, [limit]);
    return rows.map((row) => ({ mode, action: 'manual_review_schedule_total_mismatch', ...row }));
  }

  return [];
}

async function applyRenewals(client, proposals) {
  let loanUpdates = 0;
  let scheduleUpdates = 0;
  for (const item of proposals) {
    const r1 = await client.query(`update app_loans set status = 'paid', updated_at = now() where id = $1 and status <> 'paid'`, [item.old_loan_id]);
    loanUpdates += r1.rowCount;
    const r2 = await client.query(`update app_payment_schedules set status = 'paid', updated_at = now() where loan_id = $1 and deleted_at is null and status <> 'paid'`, [item.old_loan_id]);
    scheduleUpdates += r2.rowCount;
  }
  return { loanUpdates, scheduleUpdates };
}

async function applySchedules(client, proposals) {
  let scheduleUpdates = 0;
  for (const item of proposals) {
    const result = await client.query(`
      update app_payment_schedules
      set status = $2, updated_at = now()
      where id = $1 and deleted_at is null and status <> $2
    `, [item.schedule_id, item.expected_status]);
    scheduleUpdates += result.rowCount;
  }
  return { scheduleUpdates };
}

async function applyScheduleLinks(client, proposals) {
  let paymentUpdates = 0;
  for (const item of proposals) {
    const result = await client.query(`
      update app_payments
      set schedule_id = $2, updated_at = now()
      where id = $1 and deleted_at is null and (schedule_id is null or schedule_id = '')
    `, [item.payment_id, item.schedule_id]);
    paymentUpdates += result.rowCount;
  }
  return { paymentUpdates };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const client = makeClient(env);
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  fs.mkdirSync(args.outputDir, { recursive: true });

  await client.connect();
  const txMode = args.apply ? 'read write' : 'read only';
  await client.query(`begin ${txMode}`);

  try {
    const proposalsByMode = {};
    const skippedByMode = {};
    const applyResults = {};

    for (const mode of args.modes) {
      if (mode === 'renewals') proposalsByMode[mode] = await fetchRenewalProposals(client);
      else if (mode === 'schedules') proposalsByMode[mode] = await fetchScheduleStatusProposals(client);
      else if (mode === 'schedule-links') {
        const result = await fetchScheduleLinkProposals(client);
        proposalsByMode[mode] = result.proposals;
        skippedByMode[mode] = result.skipped;
      } else proposalsByMode[mode] = await fetchReportOnly(client, mode, args.limit);
    }

    const backupPath = path.join(args.outputDir, `loan-payment-repair-backup-${stamp}.json`);
    const proposalPath = path.join(args.outputDir, `loan-payment-repair-${args.apply ? 'applied' : 'dry-run'}-${stamp}.json`);
    const reportPath = path.join(args.outputDir, `loan-payment-repair-${args.apply ? 'applied' : 'dry-run'}-${stamp}.md`);

    fs.writeFileSync(backupPath, JSON.stringify({ generatedAt: now.toISOString(), apply: args.apply, modes: args.modes, proposalsByMode, skippedByMode }, null, 2));

    if (args.apply) {
      // Apply recomputation/link backfills first, then renewal closure last so
      // renewed old-loan schedules finish as paid even if they were active at
      // proposal time.
      if (proposalsByMode.schedules) applyResults.schedules = await applySchedules(client, proposalsByMode.schedules);
      if (proposalsByMode['schedule-links']) applyResults['schedule-links'] = await applyScheduleLinks(client, proposalsByMode['schedule-links']);
      if (proposalsByMode.renewals) applyResults.renewals = await applyRenewals(client, proposalsByMode.renewals);
      await client.query('commit');
    } else {
      await client.query('rollback');
    }

    const payload = { generatedAt: now.toISOString(), apply: args.apply, modes: args.modes, confirmReport: args.confirmReport, backupPath, proposalsByMode, skippedByMode, applyResults };
    fs.writeFileSync(proposalPath, JSON.stringify(payload, null, 2));

    const lines = [
      `# Loan Payment Reconciliation ${args.apply ? 'Apply' : 'Dry-Run'} Report`,
      '',
      `Generated: ${now.toISOString()}`,
      `Mode: ${args.apply ? 'APPLY' : 'DRY-RUN'}`,
      `Modes: ${args.modes.join(', ')}`,
      `Backup/proposal snapshot: ${backupPath}`,
      args.confirmReport ? `Confirmed source report: ${args.confirmReport}` : '',
      '',
      '## Summary',
      '',
      '| Mode | Proposed | Skipped | Applied |',
      '| --- | ---: | ---: | --- |',
      ...args.modes.map((mode) => {
        const proposed = (proposalsByMode[mode] || []).length;
        const skipped = (skippedByMode[mode] || []).length;
        const applied = applyResults[mode] ? JSON.stringify(applyResults[mode]) : '';
        return `| ${mode} | ${proposed} | ${skipped} | ${applied} |`;
      }),
      '',
    ];

    for (const mode of args.modes) {
      lines.push(`## ${mode} proposals`);
      lines.push('');
      lines.push(markdownTable((proposalsByMode[mode] || []).slice(0, args.limit)));
      const skipped = skippedByMode[mode] || [];
      if (skipped.length > 0) {
        lines.push(`## ${mode} skipped samples`);
        lines.push('');
        lines.push(markdownTable(skipped.slice(0, args.limit)));
      }
    }

    lines.push('## Safety Notes');
    lines.push('');
    lines.push('- Overpayments, paid loans with balances, and schedule total mismatches are report-only unless explicitly run as report modes.');
    lines.push('- Dry-run mode uses a read-only transaction and rolls back.');
    lines.push('- Apply mode requires `--confirm-report` and writes only safe mode changes.');
    lines.push('');

    fs.writeFileSync(reportPath, lines.filter(Boolean).join('\n'));

    console.log(`${args.apply ? 'Applied' : 'Dry-run'} repair report written to: ${reportPath}`);
    console.log(`JSON proposal/apply artifact written to: ${proposalPath}`);
    console.log(`Backup/proposal snapshot written to: ${backupPath}`);
  } catch (error) {
    try { await client.query('rollback'); } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[repair-loan-reconciliation] Failed:', error);
  process.exit(1);
});
