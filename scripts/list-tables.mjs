import pkg from 'pg';
const { Client } = pkg;

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:54322/postgres' });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log(res.rows.map(r => r.table_name));
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
main();
