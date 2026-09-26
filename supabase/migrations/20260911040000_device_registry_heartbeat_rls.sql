-- Allow any authenticated POS terminal to self-register and heartbeat.
-- Admin-only delete remains for registry cleanup; lock/wipe stay app-gated.

DROP POLICY IF EXISTS "device_registry_write" ON public.device_registry;

CREATE POLICY "device_registry_insert" ON public.device_registry
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "device_registry_update" ON public.device_registry
    FOR UPDATE TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "device_registry_delete" ON public.device_registry
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()::text AND role = 'admin'
        )
    );
