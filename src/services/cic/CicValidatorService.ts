import { CicStagedResult, CicStagedSubject, CicStagedContract } from './CicExtractService';
import { PLACEHOLDER_PATTERNS } from './cic-field-map.config';

export interface CicFieldError {
  field: string;
  reason: string;
}

export interface CicSubjectValidationResult {
  provider_subject_no: string;
  borrower_id: string;
  name: string;
  passed: boolean;
  errors: CicFieldError[];
  warnings: CicFieldError[];
}

export interface CicContractValidationResult {
  provider_contract_no: string;
  provider_subject_no: string;
  passed: boolean;
  errors: CicFieldError[];
}

export interface CicValidationReport {
  period: string;
  validated_at: string;
  overall_status: 'passed' | 'failed' | 'partial';
  total_subjects: number;
  failed_subjects: number;
  total_contracts: number;
  failed_contracts: number;
  subject_results: CicSubjectValidationResult[];
  contract_results: CicContractValidationResult[];
  blocking_errors: string[];   // errors that prevent ANY submission
}

function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  return PLACEHOLDER_PATTERNS.some((p) => p.test(v));
}

function requireField(
  errors: CicFieldError[],
  fieldName: string,
  value: any,
  label?: string
): void {
  const lbl = label ?? fieldName;
  if (value === null || value === undefined || String(value).trim() === '') {
    errors.push({ field: fieldName, reason: `${lbl} is required but missing` });
  } else if (isPlaceholder(String(value))) {
    errors.push({ field: fieldName, reason: `${lbl} contains a placeholder/dummy value` });
  }
}

function checkDobYear(errors: CicFieldError[], dobRaw: number | null): void {
  if (!dobRaw) return;
  const year = new Date(dobRaw).getFullYear();
  if (year <= 1900) {
    errors.push({ field: 'date_of_birth', reason: `Date of birth year ${year} is likely a placeholder` });
  }
  if (year > new Date().getFullYear() - 15) {
    errors.push({ field: 'date_of_birth', reason: `Date of birth year ${year} implies borrower is under 15` });
  }
}

export class CicValidatorService {
  static validate(staged: CicStagedResult): CicValidationReport {
    const subjectResults: CicSubjectValidationResult[] = [];
    const contractResults: CicContractValidationResult[] = [];
    const blockingErrors: string[] = [];

    // ── 1. Build subject lookup for referential integrity check ─────
    const subjectNos = new Set(staged.subjects.map((s) => s.provider_subject_no));
    const seenSubjectNos = new Set<string>();

    // ── 2. Validate each subject ────────────────────────────────────
    for (const s of staged.subjects) {
      const errors: CicFieldError[] = [];
      const warnings: CicFieldError[] = [];

      // Required: Provider Subject No (membership number)
      requireField(errors, 'provider_subject_no', s.provider_subject_no, 'Membership Number');

      // Required: First Name
      requireField(errors, 'first_name', s.first_name, 'First Name');

      // Required: Last Name
      requireField(errors, 'last_name', s.last_name, 'Last Name');

      // Middle name: warn only (CIC requires but we need staff to backfill)
      if (!s.middle_name) {
        warnings.push({ field: 'middle_name', reason: 'Middle name missing — required for CIC ID record Col 9' });
      }

      // Required: Gender
      requireField(errors, 'gender', s.gender, 'Gender');

      // Required: Date of Birth
      requireField(errors, 'date_of_birth', s.date_of_birth_raw, 'Date of Birth');
      checkDobYear(errors, s.date_of_birth_raw);

      // Required: Place of Birth
      if (!s.birthplace) {
        warnings.push({ field: 'birthplace', reason: 'Place of birth missing — required for CIC ID record Col 15' });
      }

      // Required: Civil Status
      requireField(errors, 'civil_status', s.civil_status_raw, 'Civil Status');

      // Required: Gov ID (at least one of TIN / SSS / GSIS)
      const hasGovId = s.tin_number || s.sss_number || s.gsis_number;
      if (!hasGovId) {
        errors.push({
          field: 'gov_id',
          reason: 'No government ID found — TIN, SSS, or GSIS number is required by CIC',
        });
      } else {
        if (isPlaceholder(s.tin_number ?? '')) {
          errors.push({ field: 'tin_number', reason: 'TIN contains a placeholder/dummy value' });
        }
        if (isPlaceholder(s.sss_number ?? '')) {
          errors.push({ field: 'sss_number', reason: 'SSS number contains a placeholder/dummy value' });
        }
      }

      // Required: Address
      const fullAddress = [s.address, s.barangay, s.city_municipality, s.province]
        .filter(Boolean)
        .join(' ');
      if (!fullAddress.trim()) {
        errors.push({ field: 'address', reason: 'Full address is required but all address fields are blank' });
      }

      // Duplicate detection
      if (seenSubjectNos.has(s.provider_subject_no)) {
        errors.push({
          field: 'provider_subject_no',
          reason: `Duplicate membership number ${s.provider_subject_no} — each borrower must appear once`,
        });
      }
      seenSubjectNos.add(s.provider_subject_no);

      subjectResults.push({
        provider_subject_no: s.provider_subject_no,
        borrower_id: s.borrower_id,
        name: `${s.first_name} ${s.last_name}`,
        passed: errors.length === 0,
        errors,
        warnings,
      });
    }

    // ── 3. Validate each contract ────────────────────────────────────
    for (const c of staged.contracts) {
      const errors: CicFieldError[] = [];

      // Referential integrity: subject must exist
      if (!subjectNos.has(c.provider_subject_no)) {
        errors.push({
          field: 'provider_subject_no',
          reason: `Contract ${c.provider_contract_no} references subject ${c.provider_subject_no} which does not exist`,
        });
        blockingErrors.push(
          `Orphaned contract ${c.provider_contract_no} — no matching subject ${c.provider_subject_no}`
        );
      }

      // Required: Contract number
      requireField(errors, 'provider_contract_no', c.provider_contract_no, 'Loan Number');

      // Required: Principal amount > 0
      if (!c.principal_amount || c.principal_amount <= 0) {
        errors.push({ field: 'principal_amount', reason: 'Financed amount must be > 0' });
      }

      // Required: Release date
      if (!c.release_date_raw) {
        errors.push({ field: 'release_date', reason: 'Contract start date (release date) is missing' });
      }

      // Required: Maturity date
      if (!c.maturity_date_raw) {
        errors.push({ field: 'maturity_date', reason: 'Contract end planned date (maturity date) is missing' });
      }

      contractResults.push({
        provider_contract_no: c.provider_contract_no,
        provider_subject_no: c.provider_subject_no,
        passed: errors.length === 0,
        errors,
      });
    }

    // ── 4. Blocking error: extraction errors ─────────────────────────
    for (const e of staged.errors) {
      blockingErrors.push(e);
    }

    const failedSubjects = subjectResults.filter((r) => !r.passed).length;
    const failedContracts = contractResults.filter((r) => !r.passed).length;
    const totalFailed = failedSubjects + failedContracts + blockingErrors.length;

    let overallStatus: 'passed' | 'failed' | 'partial';
    if (totalFailed === 0) {
      overallStatus = 'passed';
    } else if (failedSubjects === staged.subjects.length && staged.subjects.length > 0) {
      overallStatus = 'failed';
    } else if (blockingErrors.length > 0) {
      overallStatus = 'failed';
    } else {
      overallStatus = 'partial';
    }

    return {
      period: staged.period,
      validated_at: new Date().toISOString(),
      overall_status: overallStatus,
      total_subjects: staged.subjects.length,
      failed_subjects: failedSubjects,
      total_contracts: staged.contracts.length,
      failed_contracts: failedContracts,
      subject_results: subjectResults,
      contract_results: contractResults,
      blocking_errors: blockingErrors,
    };
  }

  /** Returns list of borrowers missing CIC-critical fields (for proactive dashboard report) */
  static async getMissingFieldsReport(): Promise<{
    borrower_id: string;
    name: string;
    membership_number: string;
    missing_fields: string[];
  }[]> {
    const { supabase: sb } = await import('../../database/supabase');
    const { data } = await sb
      .from('borrowers')
      .select(
        'id, first_name, last_name, membership_number, ' +
        'middle_name, date_of_birth, tin_number, sss_number, gsis_number, ' +
        'birthplace, civil_status, deleted_at'
      )
      .is('deleted_at', null);

    const rawData = data as any[];
    const report = [];
    for (const b of rawData ?? []) {
      const missing = [];
      if (!b.middle_name) missing.push('Middle Name');
      if (!b.date_of_birth) missing.push('Date of Birth');
      if (!b.birthplace) missing.push('Place of Birth');
      if (!b.civil_status) missing.push('Civil Status');
      if (!b.tin_number && !b.sss_number && !b.gsis_number) missing.push('Government ID (TIN/SSS/GSIS)');
      if (missing.length > 0) {
        report.push({
          borrower_id: b.id,
          name: `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim(),
          membership_number: b.membership_number ?? b.id,
          missing_fields: missing,
        });
      }
    }
    return report;
  }
}
