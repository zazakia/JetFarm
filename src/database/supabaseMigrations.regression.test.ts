import fs from 'fs';
import path from 'path';

const migration = (fileName: string) => fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', fileName),
    'utf8'
);

describe('Supabase migration regression guards', () => {
    it('keeps the legacy auth token constraint migration safe for local resets on newer Supabase images', () => {
        const sql = migration('20260404130000_constrain_auth_null_tokens.sql');

        expect(sql).toContain('pg_has_role');
        expect(sql).toContain("'auth.users'::regclass");
        expect(sql).toContain('Skipping auth.users token constraints');
    });

    it('keeps app_payments.borrower_id in the production schema migration', () => {
        const sql = migration('20260511033613_add_app_payments_borrower_id.sql');

        expect(sql).toMatch(/ALTER TABLE\s+public\.app_payments\s+ADD COLUMN IF NOT EXISTS\s+borrower_id\s+TEXT/i);
        expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS\s+idx_app_payments_borrower_id/i);
    });

    it('keeps sync RLS hardening applied to payments and schedules with a PostgREST schema reload', () => {
        const sql = migration('20260511121243_harden_remaining_sync_rls.sql');

        expect(sql).toContain("'app_payments'");
        expect(sql).toContain("'app_payment_schedules'");
        expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE');
        expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
    });

    it('removes broad production policies that caused public payment/profile access', () => {
        const sql = migration('20260511155432_drop_overbroad_production_rls_policies.sql');

        expect(sql).toContain('DROP POLICY IF EXISTS "Enable read access for all users" ON public.app_payments');
        expect(sql).toContain('DROP POLICY IF EXISTS auth_all_user_profiles ON public.user_profiles');
        expect(sql).toContain('ALTER POLICY %I ON public.%I TO authenticated');
    });

    it('removes final public-role RLS policies without deleting data', () => {
        const sql = migration('20260511155857_harden_remaining_public_role_policies.sql');

        expect(sql).toContain('DROP POLICY IF EXISTS "Enable delete for all users" ON public.app_loan_penalties');
        expect(sql).toContain('ALTER POLICY %I ON public.%I TO authenticated');
        expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
        expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    });

    it('preserves global staff schedule sync after RLS hardening', () => {
        const sql = migration('20260511161453_grant_global_staff_schedule_sync.sql');

        expect(sql).toContain('Global staff can manage app_payment_schedules');
        expect(sql).toContain('FOR ALL TO authenticated');
        expect(sql).toContain('public.is_global_admin()');
    });

    it('allows safe borrower self-registration profile creation only', () => {
        const sql = migration('20260521182000_fix_borrower_self_registration.sql');

        expect(sql).toContain('GRANT INSERT ON public.user_profiles TO authenticated');
        expect(sql).toContain('Borrowers can create own pending profile');
        expect(sql).toContain('id = (auth.uid())::text');
        expect(sql).toContain("role = 'borrower'");
        expect(sql).toContain('is_active = false');
        expect(sql).toContain('deleted_at IS NULL');
    });

    it('hardens role-derived settings authorization against self-promotion and admin lockout', () => {
        const sql = migration('20260521165000_harden_settings_role_security.sql');

        expect(sql).toContain('AND is_active = true');
        expect(sql).toContain('DROP POLICY IF EXISTS "Users can update own profile"');
        expect(sql).toContain('prevent_user_profile_self_escalation');
        expect(sql).toContain('NEW.role IS DISTINCT FROM OLD.role');
        expect(sql).toContain('NEW.is_active IS DISTINCT FROM OLD.is_active');
        expect(sql).toContain('NEW.deleted_at IS DISTINCT FROM OLD.deleted_at');
        expect(sql).toContain('prevent_admin_route_lockout');
        expect(sql).toContain("NEW.permission_key = 'route.(admin)'");
    });

    it('repairs all Water Station sync tables with RLS, grants, and schema reload', () => {
        const sql = migration('20260714101545_repair_sync_schema_contract.sql');

        for (const table of ['ws_customers', 'ws_deliveries', 'ws_containers', 'ws_payments', 'ws_expenses']) {
            expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
            expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
        }
        expect(sql).toContain('WITH CHECK');
        expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE');
        expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
        expect(sql).not.toMatch(/\bDROP\s+TABLE\b/i);
        expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    });
});
