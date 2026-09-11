import pkg from 'pg';
const { Client } = pkg;

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:54322/postgres' });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'app_borrowers' 
      ORDER BY ordinal_position
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
main();
