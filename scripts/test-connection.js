const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:46421';
const supabaseKey = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('app_loans').select('count', { count: 'exact', head: true });
  if (error) {
    console.error('Connection failed:', error);
  } else {
    console.log('Connection successful. Data:', data);
  }
}

test();
