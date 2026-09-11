const fs = require('node:fs');
const path = require('node:path');

describe('legacy account-code normalization migration', () => {
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const migrationName = fs.readdirSync(migrationsDir)
    .find(name => name.endsWith('_normalize_legacy_account_codes.sql'));

  it('backs up affected rows and maps every legacy code to the runtime COA', () => {
    expect(migrationName).toBeDefined();
    const sql = fs.readFileSync(path.join(migrationsDir, migrationName), 'utf8');

    for (const [legacy, canonical] of Object.entries({
      '11110': '1010',
      '11200': '1020',
      '12100': '1100',
      '21100': '2010',
      '31100': '3010',
      '41100': '4010',
      '51100': '5100',
    })) {
      expect(sql).toContain(`('${legacy}', '${canonical}')`);
    }

    expect(sql).toContain('private.account_code_normalization_backup_20260805');
    expect(sql).toContain('journal_entry_lines_account_code_is_canonical');
    expect(sql).toContain('VALIDATE CONSTRAINT journal_entry_lines_account_code_is_canonical');
  });

  it('does not rewrite debit or credit amounts', () => {
    const sql = fs.readFileSync(path.join(migrationsDir, migrationName), 'utf8');
    const updateClause = sql.match(/UPDATE public\.journal_entry_lines[\s\S]*?WHERE jel\.account_code = mapping\.legacy_code;/i)?.[0];

    expect(updateClause).toBeDefined();
    expect(updateClause).not.toMatch(/SET[\s\S]*?(debit_amount|credit_amount)\s*=/i);
  });
});

