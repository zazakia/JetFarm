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

    // --- agribusiness-only teardown (S9): the non-agribusiness retirement migration ---
    const RETIRE_FILE = '20261021000000_retire_non_agribusiness_tables.sql';

    const retiredDrops = (): string[] => {
        const sql = migration(RETIRE_FILE);
        const names = [...sql.matchAll(/^DROP TABLE IF EXISTS public\."([a-z0-9_]+)";$/gm)].map((m) => m[1]);
        expect(names.length).toBeGreaterThan(20);
        expect(new Set(names).size).toBe(names.length);
        return names;
    };

    it('retires every deleted non-agribusiness table, app_borrowers last', () => {
        const drops = retiredDrops();
        expect(drops.length).toBe(57);
        expect(drops[drops.length - 1]).toBe('app_borrowers');
        for (const required of [
            'app_loans', 'app_payments', 'app_payment_schedules', 'app_loan_products',
            'app_collectors', 'app_file_cases', 'app_share_capital_transactions',
            'ws_customers', 'marketplace_orders', 'payroll_runs', 'pos_sessions',
            'employees', 'franchise_contracts', 'royalty_calculations',
            'commissary_dispatches', 'waste_logs', 'cic_settings', 'sync_conflict_log',
        ]) {
            expect(drops).toContain(required);
        }
    });

    it('drops retired tables only after the tables that referenced them', () => {
        const drops = retiredDrops();
        const rank = (t: string) => drops.indexOf(t);
        for (const [dependent, referenced] of [
            ['app_children', 'app_borrowers'], ['app_guarantors', 'app_loans'],
            ['app_loans', 'app_loan_applications'], ['marketplace_order_items', 'marketplace_products'],
            ['marketplace_products', 'marketplace_stores'], ['payroll_lines', 'employees'],
            ['ws_payments', 'ws_deliveries'], ['sales_return_lines', 'sales_returns'],
            ['employee_leaves', 'employees'], ['app_dependents', 'app_borrowers'],
        ] as [string, string][]) {
            expect(rank(dependent)).toBeLessThan(rank(referenced));
        }
    });

    it('never drops a table the agribusiness sync contract still uses and never cascades', () => {
        const sql = migration(RETIRE_FILE);
        const contract = JSON.parse(
            fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'syncTableContract.json'), 'utf8'),
        );
        for (const remote of Object.values<string>(contract.remoteTableMap)) {
            expect(sql).not.toContain(`DROP TABLE IF EXISTS public."${remote}";`);
        }
        expect(sql).not.toMatch(/DROP TABLE[^\n]*CASCADE/i);
        expect(sql).not.toMatch(/\bTRUNCATE\b/i);
        expect(sql).not.toMatch(/\bDELETE\s+FROM\s+/i);
    });

    it('aborts when retired tables still hold rows unless the operator sets the sentinel', () => {
        const sql = migration(RETIRE_FILE);
        expect(sql).toContain("current_setting('jetfarm.allow_non_agribusiness_data_loss', true)");
        expect(sql).toContain('RAISE EXCEPTION');
        expect(sql).toContain('LOCAL/VARIANT ONLY');
        // the guard is the first executable statement - nothing destructive may precede it
        const guard = sql.indexOf('DO $$');
        expect(guard).toBeGreaterThan(-1);
        expect(sql.slice(0, guard).replace(/--[^\n]*/g, '').trim()).toBe('');
        expect(sql.indexOf('DROP TABLE')).toBeGreaterThan(sql.indexOf('$$;', guard));
        expect(sql).toContain("NOTIFY pgrst, 'reload schema';");
    });

    it('severs the one kept to retired reference before retiring pos_sessions', () => {
        const sql = migration(RETIRE_FILE);
        const constraint = sql.indexOf('DROP CONSTRAINT IF EXISTS app_cash_transactions_pos_session_id_fkey');
        const column = sql.indexOf('DROP COLUMN IF EXISTS pos_session_id');
        const drop = sql.indexOf('DROP TABLE IF EXISTS public."pos_sessions";');
        expect(constraint).toBeGreaterThan(-1);
        expect(column).toBeGreaterThan(-1);
        expect(drop).toBeGreaterThan(-1);
        expect(constraint).toBeLessThan(drop);
        expect(column).toBeLessThan(drop);
    });

    it('keeps seed.sql aligned with the retired schema', () => {
        const seed = fs.readFileSync(path.join(process.cwd(), 'supabase', 'seed.sql'), 'utf8');
        for (const retired of retiredDrops()) {
            expect(seed).not.toContain(retired);
        }

        // seed only the identities this variant ships
        const seeded = seed.slice(seed.indexOf('INSERT INTO seed_login_users'));
        const values = seeded.slice(0, seeded.indexOf(';'));
        expect(values).toContain('admin@poscursor.com');
        for (const retiredRole of [
            'collector', 'loan_encoder', 'payment_encoder', 'borrower', 'executive',
            'branch_cashier', 'branch_manager', 'area_supervisor', 'commissary_keeper',
        ]) {
            expect(values).not.toContain(`'${retiredRole}'`);
        }

        // the retired roles may only appear in the purge that removes what the
        // append-only migration history still creates on every reset
        expect(seed).toContain('seed_retired_profiles');
        expect(seed).toContain("'collector', 'loan_encoder', 'payment_encoder', 'borrower',");
        expect(seed).toContain('DELETE FROM auth.users');
        expect(seed).toContain('INSERT INTO public.user_profiles');
    });
});
