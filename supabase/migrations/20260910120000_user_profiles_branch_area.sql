-- Add branch/area scope columns used by AuthService.getUserBranchAndArea
-- and CrispyKing branch partitioning. Safe for environments that already have them.

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS branch_id TEXT,
    ADD COLUMN IF NOT EXISTS area_id TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_branch_id
    ON public.user_profiles (branch_id)
    WHERE branch_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_area_id
    ON public.user_profiles (area_id)
    WHERE area_id IS NOT NULL AND deleted_at IS NULL;
