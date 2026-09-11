import pg from 'pg';

const { Client } = pg;
const projectRef = 'YOUR_SUPABASE_PROJECT';
const password = process.env.SUPABASE_DB_PASSWORD || process.env.EXPO_PUBLIC_SUPABASE_DB_PASSWORD || 'Qweasd145698@';

const regions = ['ap-southeast-1', 'ap-southeast-2', 'us-east-1', 'us-west-1', 'eu-west-1', 'eu-central-1'];
const clusters = ['aws-0', 'aws-1', 'aws-2', 'aws-3', 'aws-4', 'aws-5'];

async function testPooler(cluster, region) {
  const host = `${cluster}-${region}.pooler.supabase.com`;
  const client = new Client({
    host,
    port: 6543,
    database: 'postgres',
    user: `postgres.${projectRef}`,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 3000,
  });

  try {
    await client.connect();
    console.log(`✅ SUCCESS on host: [ ${host} ] !!`);
    await client.end();
    return host;
  } catch (err) {
    if (!err.message.includes('not found')) {
      console.log(`  - ${host.padEnd(40)}: ${err.message}`);
    }
    return null;
  }
}

async function run() {
  console.log(`Searching pooler clusters for ${projectRef}...`);
  for (const region of regions) {
    for (const cluster of clusters) {
      const host = await testPooler(cluster, region);
      if (host) {
        console.log('FOUND MATCH:', host);
        process.exit(0);
      }
    }
  }
  console.log('Finished scanning.');
}

run();
