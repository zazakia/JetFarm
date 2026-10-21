import pkg from 'pg';
const { Client } = pkg;

async function main() {
const client = process.env.LOCAL_DATABASE_URL;
if (!client) {
    console.error('LOCAL_DATABASE_URL is not set. Connection strings are never hardcoded in this repo - export it before running this script.');
    process.exit(1);
}
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
