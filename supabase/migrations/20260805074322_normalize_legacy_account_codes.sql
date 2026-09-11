-- Normalize historical five-digit posting codes to the four-digit runtime chart.
-- This migration changes classifications only; debit and credit amounts are preserved.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.account_code_normalization_backup_20260805 (
    line_id UUID PRIMARY KEY,
    old_code TEXT NOT NULL,
    canonical_code TEXT NOT NULL,
    old_account_name TEXT,
    debit_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    credit_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON TABLE private.account_code_normalization_backup_20260805
    FROM PUBLIC, anon, authenticated;

WITH mapping(legacy_code, canonical_code) AS (
    VALUES
        ('11110', '1010'),
        ('11200', '1020'),
        ('12100', '1100'),
        ('21100', '2010'),
        ('31100', '3010'),
        ('41100', '4010'),
        ('51100', '5100')
)
INSERT INTO private.account_code_normalization_backup_20260805 (
    line_id,
    old_code,
    canonical_code,
    old_account_name,
    debit_amount,
    credit_amount
)
SELECT
    jel.id,
    jel.account_code,
    mapping.canonical_code,
    jel.account_name,
    jel.debit_amount,
    jel.credit_amount
FROM public.journal_entry_lines AS jel
JOIN mapping ON mapping.legacy_code = jel.account_code
ON CONFLICT (line_id) DO NOTHING;

WITH mapping(legacy_code, canonical_code) AS (
    VALUES
        ('11110', '1010'),
        ('11200', '1020'),
        ('12100', '1100'),
        ('21100', '2010'),
        ('31100', '3010'),
        ('41100', '4010'),
        ('51100', '5100')
)
UPDATE public.journal_entry_lines AS jel
SET
    account_code = mapping.canonical_code,
    account_name = COALESCE(
        (
            SELECT coa.name
            FROM public.chart_of_accounts AS coa
            WHERE coa.code = mapping.canonical_code
              AND coa.deleted_at IS NULL
            LIMIT 1
        ),
        jel.account_name
    ),
    updated_at = NOW()
FROM mapping
WHERE jel.account_code = mapping.legacy_code;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.journal_entry_lines
        WHERE account_code IN ('11110', '11200', '12100', '21100', '31100', '41100', '51100')
    ) THEN
        RAISE EXCEPTION 'Legacy account codes remain after normalization';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM private.account_code_normalization_backup_20260805 AS backup
        JOIN public.journal_entry_lines AS current_line
          ON current_line.id = backup.line_id
        WHERE current_line.debit_amount IS DISTINCT FROM backup.debit_amount
           OR current_line.credit_amount IS DISTINCT FROM backup.credit_amount
    ) THEN
        RAISE EXCEPTION 'Account-code normalization changed journal amounts';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.journal_entry_lines AS line
        LEFT JOIN public.chart_of_accounts AS coa
          ON coa.code = line.account_code
         AND coa.deleted_at IS NULL
         AND coa.is_active = TRUE
         AND coa.is_header IS NOT TRUE
        WHERE line.deleted_at IS NULL
          AND coa.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Journal lines still reference unknown or inactive posting accounts';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'journal_entry_lines_account_code_is_canonical'
          AND conrelid = 'public.journal_entry_lines'::regclass
    ) THEN
        ALTER TABLE public.journal_entry_lines
            ADD CONSTRAINT journal_entry_lines_account_code_is_canonical
            CHECK (account_code ~ '^[0-9]{4}$') NOT VALID;
    END IF;
END
$$;

ALTER TABLE public.journal_entry_lines
    VALIDATE CONSTRAINT journal_entry_lines_account_code_is_canonical;

COMMIT;

