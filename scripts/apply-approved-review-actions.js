#!/usr/bin/env node

/**
 * Apply only explicitly approved manual-review actions.
 *
 * Usage:
 *   node scripts/apply-approved-review-actions.js --input docs/reconciliation/approved-review-actions.json --dry-run
 *   node scripts/apply-approved-review-actions.js --input docs/reconciliation/approved-review-actions.json --apply
 *
 * Supported approved actions:
 * - reopen_loan_to_active
 * - mark_loan_paid
 * - close_duplicate_active_loan
 * - set_schedule_status
 * - link_payment_schedule
 * - reverse_savings_overcredit
 * - add_manual_note_only (no-op, documented in report)
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const SUPPORTED_ACTIONS = new Set([
  'reopen_loan_to_active',
  'mark_loan_paid',
  'close_duplicate_active_loan',
  'set_schedule_status',
  'link_payment_schedule',
  'reverse_savings_overcredit',
  'add_manual_note_only',
]);

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
  const args = { input: null, apply: false, outputDir: 'docs/reconciliation' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') args.input = argv[++i];
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--dry-run') args.apply = false;
    else if (arg === '--output-dir') args.outputDir = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/apply-approved-review-actions.js --input <approved-review-actions.json> [--dry-run|--apply]');
      process.exit(0);
    }
  }
  if (!args.input) throw new Error('--input is required');
  if (!fs.existsSync(args.input)) throw new Error(`Input file not found: ${args.input}`);
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

function validateInput(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Input must be a JSON object');
  if (!Array.isArray(payload.actions)) throw new Error('Input JSON must contain an actions array');
  for (const [index, action] of payload.actions.entries()) {
    if (!action || typeof action !== 'object') throw new Error(`Action at index ${index} must be an object`);
    if (!action.id) throw new Error(`Action at index ${index} is missing id`);
    if (!action.action) throw new Error(`Action at index ${index} is missing action`);
    if (!SUPPORTED_ACTIONS.has(action.action)) throw new Error(`Unsupported action: ${action.action}`);
  }
}

async function applyAction(client, item, applyMode) {
  switch (item.action) {
    case 'reopen_loan_to_active': {
      if (!applyMode) return { rowCount: 1, target: item.loan_id, simulated: true };
      const result = await client.query(
        `update app_loans set status = 'active', updated_at = now() where id = $1 and deleted_at is null and status <> 'active'`,
        [item.loan_id]
      );
      return { rowCount: result.rowCount, target: item.loan_id };
    }
    case 'mark_loan_paid': {
      if (!applyMode) return { rowCount: 1, target: item.loan_id, simulated: true };
      const result = await client.query(
        `update app_loans set status = 'paid', updated_at = now() where id = $1 and deleted_at is null and status <> 'paid'`,
        [item.loan_id]
      );
      return { rowCount: result.rowCount, target: item.loan_id };
    }
    case 'close_duplicate_active_loan': {
      if (!applyMode) return { rowCount: 1, target: item.loan_id, simulated: true };
      const result = await client.query(
        `update app_loans set status = 'paid', updated_at = now() where id = $1 and deleted_at is null and status = 'active'`,
        [item.loan_id]
      );
      return { rowCount: result.rowCount, target: item.loan_id };
    }
    case 'set_schedule_status': {
      if (!applyMode) return { rowCount: 1, target: item.schedule_id, status: item.status, simulated: true };
      const result = await client.query(
        `update app_payment_schedules set status = $2, updated_at = now() where id = $1 and deleted_at is null and status <> $2`,
        [item.schedule_id, item.status]
      );
      return { rowCount: result.rowCount, target: item.schedule_id, status: item.status };
    }
    case 'link_payment_schedule': {
      if (!applyMode) return { rowCount: 1, target: item.payment_id, schedule_id: item.schedule_id, simulated: true };
      const result = await client.query(
        `update app_payments set schedule_id = $2, updated_at = now() where id = $1 and deleted_at is null and (schedule_id is null or schedule_id = '')`,
        [item.payment_id, item.schedule_id]
      );
      return { rowCount: result.rowCount, target: item.payment_id, schedule_id: item.schedule_id };
    }
    case 'reverse_savings_overcredit': {
      const amount = Number(item.amount || 0);
      if (!(amount > 0)) throw new Error(`reverse_savings_overcredit requires positive amount for action ${item.id}`);
      if (!applyMode) return { rowCount: 1, target: item.borrower_id, amount, simulated: true };
      const result = await client.query(
        `insert into app_savings_transactions (id, borrower_id, type, amount, reference_id, date, notes, created_at, updated_at)
         values ($1, $2, 'withdraw_cash', $3, $4, now(), $5, now(), now())`,
        [item.new_id || `${item.id}-reversal`, item.borrower_id, amount, item.reference_id || item.loan_id || item.id, item.notes || 'Manual approved reversal of savings overcredit']
      );
      return { rowCount: result.rowCount, target: item.borrower_id, amount };
    }
    case 'add_manual_note_only':
      return { rowCount: 0, target: item.id, note: 'No-op documented action' };
    default:
      throw new Error(`Unhandled action ${item.action}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  validateInput(payload);

  const env = loadEnv();
  const client = makeClient(env);
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  fs.mkdirSync(args.outputDir, { recursive: true });
  const reportPath = path.join(args.outputDir, `approved-review-actions-${args.apply ? 'applied' : 'dry-run'}-${stamp}.md`);
  const jsonPath = path.join(args.outputDir, `approved-review-actions-${args.apply ? 'applied' : 'dry-run'}-${stamp}.json`);

  await client.connect();
  await client.query(`begin ${args.apply ? 'read write' : 'read only'}`);

  try {
    const results = [];
    for (const item of payload.actions) {
      const result = await applyAction(client, item, args.apply);
      results.push({ id: item.id, action: item.action, approved_by: item.approved_by || '', result });
    }

    if (args.apply) await client.query('commit');
    else await client.query('rollback');

    fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: now.toISOString(), mode: args.apply ? 'apply' : 'dry-run', input: args.input, results }, null, 2));

    const lines = [
      `# Approved Review Actions ${args.apply ? 'Apply' : 'Dry Run'} Report`,
      '',
      `Generated: ${now.toISOString()}`,
      `Mode: ${args.apply ? 'APPLY' : 'DRY-RUN'}`,
      `Input: ${args.input}`,
      '',
      '| id | action | approved_by | rowCount | target |',
      '| --- | --- | --- | ---: | --- |',
      ...results.map((r) => `| ${r.id} | ${r.action} | ${r.approved_by} | ${r.result.rowCount} | ${r.result.target || ''} |`),
      '',
      `JSON artifact: ${jsonPath}`,
      '',
    ];

    fs.writeFileSync(reportPath, lines.join('\n'));
    console.log(`${args.apply ? 'Applied' : 'Dry-run'} approved actions report written to: ${reportPath}`);
    console.log(`JSON result written to: ${jsonPath}`);
  } catch (error) {
    try { await client.query('rollback'); } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[apply-approved-review-actions] Failed:', error);
  process.exit(1);
});
