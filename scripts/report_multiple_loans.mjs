import pkg from 'pg';
const { Client } = pkg;

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:54322/postgres' });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT b.full_name, COUNT(l.id) as active_loan_count
      FROM app_borrowers b
      JOIN app_loans l ON b.id::text = l.borrower_id::text
      WHERE l.status = 'active' 
        AND b.deleted_at IS NULL 
        AND l.deleted_at IS NULL
      GROUP BY b.id, b.full_name
      HAVING COUNT(l.id) >= 2
      ORDER BY active_loan_count DESC, b.full_name ASC;
    `);

    if (res.rows.length === 0) {
      console.log('No borrowers found with 2 or more active loans.');
    } else {
      console.log('Borrowers with 2 or more active loans:');
      console.table(res.rows);
    }
  } catch (e) {
    console.error('Database connection or query error:', e.message);
    if (e.message.includes('relation "borrowers" does not exist')) {
        console.log('\nHint: The tables might not be in the "public" schema. Run scripts/list-tables.mjs to verify.');
    }
  } finally {
    await client.end();
  }
}
main();
