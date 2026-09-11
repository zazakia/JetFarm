import pkg from 'dotenv';
const { config } = pkg;
config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function fetchSchema() {
    console.log('Fetching PostgREST schema...');
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: { 'apikey': supabaseKey }
        });
        const schema = await response.json();
        if (schema.message) {
            console.error('Supabase API Error:', schema.message, schema.hint);
            return;
        }
        console.log('Schema structure keys:', Object.keys(schema));
        if (schema.definitions) {
            console.log('Tables in definitions:', Object.keys(schema.definitions));
            const table = schema.definitions.app_payment_schedules;
            if (table) {
                console.log('Columns in app_payment_schedules:', Object.keys(table.properties));
            } else {
                console.log('app_payment_schedules not found in definitions.');
            }
        } else if (schema.paths) {
            console.log('Paths:', Object.keys(schema.paths));
        }
        const required = ['principal_amount', 'interest_amount', 'fees_amount'];
        const missing = required.filter(col => !table.properties[col]);
        if (missing.length === 0) {
            console.log('SUCCESS: All breakdown columns are present in PostgREST cache!');
        } else {
            console.log('MISSING COLUMNS in PostgREST cache:', missing);
        }
    } catch (err) {
        console.error('Error fetching schema:', err);
    }
}

fetchSchema();
