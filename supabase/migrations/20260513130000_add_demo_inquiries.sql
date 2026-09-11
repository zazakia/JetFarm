-- Store public landing-page demo inquiries and let global staff review them.
-- Supabase CLI is not available in this environment, so this migration was
-- created manually using the repository timestamp naming convention.

CREATE TABLE IF NOT EXISTS public.demo_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL CHECK (char_length(full_name) <= 160),
  business_name TEXT NOT NULL CHECK (char_length(business_name) <= 200),
  contact_number TEXT NOT NULL CHECK (char_length(contact_number) <= 80),
  email TEXT CHECK (email IS NULL OR char_length(email) <= 254),
  message TEXT CHECK (message IS NULL OR char_length(message) <= 2000),
  admin_email TEXT NOT NULL DEFAULT 'cybergada@gmail.com',
  admin_whatsapp TEXT NOT NULL DEFAULT '639811254446',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_inquiries ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON TABLE public.demo_inquiries TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.demo_inquiries TO authenticated;

DROP POLICY IF EXISTS "Anyone can submit demo inquiries" ON public.demo_inquiries;
DROP POLICY IF EXISTS "Global staff can view demo inquiries" ON public.demo_inquiries;
DROP POLICY IF EXISTS "Global staff can update demo inquiries" ON public.demo_inquiries;

CREATE POLICY "Anyone can submit demo inquiries" ON public.demo_inquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Global staff can view demo inquiries" ON public.demo_inquiries
  FOR SELECT
  TO authenticated
  USING (public.is_global_admin());

CREATE POLICY "Global staff can update demo inquiries" ON public.demo_inquiries
  FOR UPDATE
  TO authenticated
  USING (public.is_global_admin())
  WITH CHECK (public.is_global_admin());
