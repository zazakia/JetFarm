-- Migration: 20260911000000_enterprise_multi_branch_hierarchy.sql
-- Description: Multi-Branch Hierarchy (39 branches + HQ), Warehouses, and User Branch Roles for Enterprise MIS

-- 1. Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    is_hq BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. Warehouses / Locations Table
CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'store', -- 'store', 'transit', 'commissary', 'quarantine'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 3. User Branch Roles (Multi-Role / Multi-Branch Affiliation)
CREATE TABLE IF NOT EXISTS public.user_branch_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(user_id, branch_id, role)
);

-- 4. Link business_units to branches
ALTER TABLE public.business_units 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branch_roles ENABLE ROW LEVEL SECURITY;

-- 6. Standard RLS Policies (Authenticated Users have sync read/write access)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'authenticated_branches_access'
    ) THEN
        CREATE POLICY authenticated_branches_access ON public.branches
            FOR ALL TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'warehouses' AND policyname = 'authenticated_warehouses_access'
    ) THEN
        CREATE POLICY authenticated_warehouses_access ON public.warehouses
            FOR ALL TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'user_branch_roles' AND policyname = 'authenticated_user_branch_roles_access'
    ) THEN
        CREATE POLICY authenticated_user_branch_roles_access ON public.user_branch_roles
            FOR ALL TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- 7. Seed Initial Main Office and System Warehouses if table is empty
DO $$
DECLARE
    hq_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.branches LIMIT 1) THEN
        INSERT INTO public.branches (name, code, is_hq, is_active)
        VALUES ('Main Office (HQ)', 'HQ-001', true, true)
        RETURNING id INTO hq_id;

        INSERT INTO public.warehouses (branch_id, name, type, is_active)
        VALUES 
            (hq_id, 'Central Commissary', 'commissary', true),
            (hq_id, 'Central Transit Hub', 'transit', true),
            (hq_id, 'Main Office Storefront', 'store', true);
    END IF;
END $$;
