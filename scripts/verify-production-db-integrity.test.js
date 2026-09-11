const assert = require('assert');
const { resolveSupabaseConfig, collectJournalIntegrity } = require('./verify-production-db-integrity.core.js');

describe('verify-production-db-integrity helpers', () => {
  it('requires an environment secret key and does not fall back to a hardcoded secret', () => {
    assert.throws(() => {
      resolveSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      });
    }, /service key/i);
  });

  it('paginates journal data and ignores unposted or deleted rows', async () => {

    const entryPages = [
      [
        { id: 'e1', reference_number: 'JE-1', entry_date: '2026-08-01T00:00:00.000Z', is_posted: true, deleted_at: null },
        { id: 'e2', reference_number: 'JE-2', entry_date: '2026-08-02T00:00:00.000Z', is_posted: true, deleted_at: null },
      ],
      [
        { id: 'e3', reference_number: 'JE-3', entry_date: '2026-08-03T00:00:00.000Z', is_posted: false, deleted_at: null },
        { id: 'e4', reference_number: 'JE-4', entry_date: '2026-08-04T00:00:00.000Z', is_posted: true, deleted_at: '2026-08-04T00:00:00.000Z' },
      ],
      [],
    ];

    const linePages = [
      [
        { id: 'l1', journal_entry_id: 'e1', debit_amount: 100, credit_amount: 0, deleted_at: null },
        { id: 'l2', journal_entry_id: 'e1', debit_amount: 0, credit_amount: 100, deleted_at: null },
      ],
      [
        { id: 'l3', journal_entry_id: 'e2', debit_amount: 50, credit_amount: 0, deleted_at: null },
        { id: 'l4', journal_entry_id: 'e2', debit_amount: 0, credit_amount: 50, deleted_at: null },
        { id: 'l5', journal_entry_id: 'e3', debit_amount: 25, credit_amount: 0, deleted_at: null },
        { id: 'l6', journal_entry_id: 'e4', debit_amount: 0, credit_amount: 25, deleted_at: null },
        { id: 'l7', journal_entry_id: 'e2', debit_amount: 10, credit_amount: 0, deleted_at: '2026-08-04T00:00:00.000Z' },
      ],
      [],
    ];

    const journalEntriesQuery = {
      select: () => journalEntriesQuery,
      eq: () => journalEntriesQuery,
      is: () => journalEntriesQuery,
      order: () => journalEntriesQuery,
      range: (start, end) => Promise.resolve({ data: entryPages[Math.floor(start / 2)] ?? [], error: null }),
    };

    const journalLinesQuery = {
      select: () => journalLinesQuery,
      eq: () => journalLinesQuery,
      is: () => journalLinesQuery,
      order: () => journalLinesQuery,
      range: (start, end) => Promise.resolve({ data: linePages[Math.floor(start / 2)] ?? [], error: null }),
    };

    const supabase = {
      from: (table) => {
        if (table === 'journal_entries') return journalEntriesQuery;
        if (table === 'journal_entry_lines') return journalLinesQuery;
        throw new Error(`Unexpected table: ${table}`);
      },
    };

    const summary = await collectJournalIntegrity(supabase, { pageSize: 2 });

    assert.strictEqual(summary.postedJournalEntries, 2);
    assert.strictEqual(summary.postedJournalLines, 4);
    assert.strictEqual(summary.totalDebits, 150);
    assert.strictEqual(summary.totalCredits, 150);
    assert.strictEqual(summary.difference, 0);
    assert.strictEqual(summary.unbalancedEntriesCount, 0);
  });
});
