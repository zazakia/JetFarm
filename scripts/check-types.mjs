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
