DO $$ 
DECLARE 
    t text;
BEGIN 
    FOR t IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP 
        -- Drop existing policies if they exist to avoid conflicts
        EXECUTE 'DROP POLICY IF EXISTS authenticated_full_access ON public.' || quote_ident(t);
        EXECUTE 'DROP POLICY IF EXISTS anon_full_access ON public.' || quote_ident(t);
        
        -- Create a universal policy for authenticated and anon roles
        EXECUTE 'CREATE POLICY authenticated_full_access ON public.' || quote_ident(t) || ' FOR ALL TO authenticated USING (true);';
        EXECUTE 'CREATE POLICY anon_full_access ON public.' || quote_ident(t) || ' FOR ALL TO anon USING (true);';
        
        -- Ensure RLS is enabled
        EXECUTE 'ALTER TABLE public.' || quote_ident(t) || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP; 
END $$;
