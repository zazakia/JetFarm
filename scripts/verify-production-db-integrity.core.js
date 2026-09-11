const PAGE_SIZE_DEFAULT = 1000;

function formatPHP(amount) {
  return 'PHP ' + Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function resolveSupabaseConfig(env = process.env) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Missing Supabase URL. Set EXPO_PUBLIC_SUPABASE_URL or SUPABASE_URL.');
  }

  if (!serviceKey) {
    throw new Error('Missing Supabase service key. Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.');
  }

  return { url, serviceKey };
}

async function fetchAllPages(queryFactory, pageSize = PAGE_SIZE_DEFAULT) {
  const rows = [];
  let offset = 0;

  while (true) {
    const { data, error } = await queryFactory(offset, pageSize);
    if (error) throw error;

    const pageRows = data || [];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return rows;
}

async function collectJournalIntegrity(supabase, options = {}) {
  const pageSize = options.pageSize || PAGE_SIZE_DEFAULT;

  const journalEntries = await fetchAllPages(
    (offset, limit) => supabase
      .from('journal_entries')
      .select('id, reference_number, entry_date, is_posted, deleted_at')
      .eq('is_posted', true)
      .is('deleted_at', null)
      .order('entry_date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1),
    pageSize
  );

  const postedEntries = journalEntries.filter(entry => entry?.is_posted && !entry?.deleted_at);
  const postedEntryIds = new Set(postedEntries.map(entry => entry.id));
  const entryTotals = new Map();
  for (const entry of postedEntries) {
    entryTotals.set(entry.id, { debit: 0, credit: 0 });
  }

  const journalLines = await fetchAllPages(
    (offset, limit) => supabase
      .from('journal_entry_lines')
      .select('id, journal_entry_id, debit_amount, credit_amount, deleted_at')
      .is('deleted_at', null)
      .order('journal_entry_id', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1),
    pageSize
  );

  let totalDebits = 0;
  let totalCredits = 0;
  let postedLineCount = 0;

  for (const line of journalLines) {
    if (!line || line.deleted_at || !postedEntryIds.has(line.journal_entry_id)) {
      continue;
    }

    const debit = Number(line.debit_amount || 0);
    const credit = Number(line.credit_amount || 0);
    totalDebits += debit;
    totalCredits += credit;
    postedLineCount += 1;

    const entryTotalsRow = entryTotals.get(line.journal_entry_id);
    if (!entryTotalsRow) continue;
    entryTotalsRow.debit += debit;
    entryTotalsRow.credit += credit;
  }

  let unbalancedEntriesCount = 0;
  for (const totals of entryTotals.values()) {
    if (Math.abs(totals.debit - totals.credit) > 0.01) {
      unbalancedEntriesCount += 1;
    }
  }

  return {
    postedJournalEntries: postedEntries.length,
    postedJournalLines: postedLineCount,
    totalDebits,
    totalCredits,
    difference: Math.abs(totalDebits - totalCredits),
    unbalancedEntriesCount,
  };
}

module.exports = {
  PAGE_SIZE_DEFAULT,
  formatPHP,
  resolveSupabaseConfig,
  fetchAllPages,
  collectJournalIntegrity,
};
