import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RegisterBorrowerPayload = {
  email?: string;
  password?: string;
  fullName?: string;
  phone?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, message: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, message: 'Registration service is not configured.' }, 500);
  }

  let payload: RegisterBorrowerPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ success: false, message: 'Invalid registration request.' }, 400);
  }

  const email = payload.email?.trim().toLowerCase();
  const password = payload.password?.trim();
  const fullName = payload.fullName?.trim();
  const phone = payload.phone?.trim();

  if (!email || !password || !fullName || !phone) {
    return json({ success: false, message: 'Please fill in all fields (including phone number).' }, 200);
  }

  if (password.length < 8) {
    return json({ success: false, message: 'Password must be at least 8 characters long.' }, 200);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone,
      role: 'borrower',
    },
    app_metadata: {
      role: 'borrower',
    },
  });

  if (authError || !authData.user) {
    console.error('[register-borrower] Auth user creation failed:', authError?.message);
    return json({
      success: false,
      message: authError?.message || 'Failed to create user account.',
    });
  }

  const now = new Date().toISOString();
  const { error: profileError } = await admin
    .from('user_profiles')
    .upsert({
      id: authData.user.id,
      full_name: fullName,
      email,
      role: 'borrower',
      is_active: false,
      created_at: now,
      updated_at: now,
    });

  if (profileError) {
    console.error('[register-borrower] Profile creation failed:', profileError.message);
    return json({
      success: true,
      message: 'Account created but profile setup had an issue. Please contact support.',
    });
  }

  return json({
    success: true,
    message: 'Registration submitted successfully. Please wait for an administrator to verify and approve your account.',
  });
});
