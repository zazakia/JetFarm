import { CicValidatorService } from '../CicValidatorService';
import { CicStagedResult } from '../CicExtractService';
import { CIC_FIXTURE_BORROWERS, CIC_FIXTURE_LOANS } from '../fixtures/cic-test-fixture';

// Helper to build minimal staged result from fixtures
function buildStaged(borrowerIds: string[], loanIds: string[]): CicStagedResult {
  const borrowers = CIC_FIXTURE_BORROWERS.filter((b) => borrowerIds.includes(b.id));
  const loans = CIC_FIXTURE_LOANS.filter((l) => loanIds.includes(l.id));
  return {
    period: '2024-05',
    extracted_at: new Date().toISOString(),
    subjects: borrowers.map((b) => ({
      provider_subject_no: b.membership_number,
      borrower_id: b.id,
      first_name: b.first_name,
      last_name: b.last_name,
      middle_name: (b as any).middle_name ?? null,
      name_suffix: (b as any).name_suffix ?? null,
      gender: (b as any).gender ?? null,
      date_of_birth_raw: (b as any).date_of_birth ?? null,
      birthplace: (b as any).birthplace ?? null,
      civil_status_raw: (b as any).civil_status ?? null,
      number_of_dependents: (b as any).number_of_dependents ?? null,
      spouse_first_name: (b as any).spouse_first_name ?? null,
      spouse_last_name: (b as any).spouse_surname ?? null,
      spouse_middle_name: null,
      mother_maiden_name: null,
      address: (b as any).address ?? null,
      barangay: (b as any).barangay ?? null,
      city_municipality: (b as any).city_municipality ?? null,
      province: (b as any).province ?? null,
      tin_number: (b as any).tin_number ?? null,
      sss_number: (b as any).sss_number ?? null,
      gsis_number: (b as any).gsis_number ?? null,
      philhealth_number: null,
      deceased: (b as any).deceased ?? null,
      date_of_death_raw: (b as any).date_of_death ?? null,
      is_delinquent: (b as any).is_delinquent ?? null,
      delinquent_since_raw: (b as any).delinquent_since ?? null,
    })),
    contracts: loans.map((l) => ({
      borrower_id: l.borrower_id,
      provider_subject_no: borrowers.find((b) => b.id === l.borrower_id)?.membership_number ?? l.borrower_id,
      provider_contract_no: l.loan_number,
      loan_id: l.id,
      loan_type: l.loan_type ?? null,
      contract_type: 22,
      status: l.status,
      principal_amount: l.principal_amount,
      term: l.term,
      term_unit: l.term_unit,
      frequency: l.frequency ?? null,
      release_date_raw: l.release_date,
      maturity_date_raw: l.maturity_date,
      first_payment_date_raw: l.first_payment_date,
      installment_amount: l.installment_amount,
      is_reloan: l.is_reloan ?? null,
      bod_resolution_number: null,
      dpd: (l as any).dpd ?? null,
      is_delinquent: (l as any).is_delinquent ?? null,
      last_payment_date_raw: null,
      last_payment_amount: null,
      next_payment_date_raw: null,
      next_payment_amount: null,
      outstanding_balance: l.total_amount,
      total_paid: 0,
    })),
    errors: [],
  };
}

describe('CicValidatorService', () => {
  describe('valid records (fixtures 1-20)', () => {
    it('should pass for all 20 valid fixture borrowers', () => {
      const validIds = CIC_FIXTURE_BORROWERS.slice(0, 20).map((b) => b.id);
      const validLoanIds = CIC_FIXTURE_LOANS.slice(0, 20).map((l) => l.id);
      const staged = buildStaged(validIds, validLoanIds);
      const report = CicValidatorService.validate(staged);
      // May have warnings (missing middle name for some) but errors should be 0
      const hardErrors = report.subject_results.filter((r) => r.errors.length > 0);
      expect(hardErrors).toHaveLength(0);
    });
  });

  describe('broken records (fixtures 21-25)', () => {
    it('should FAIL record 21: missing government ID', () => {
      const staged = buildStaged(['fix-b-021'], []);
      const report = CicValidatorService.validate(staged);
      const result = report.subject_results[0];
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.field === 'gov_id')).toBe(true);
    });

    it('should FAIL record 22: dummy date of birth (year 1900)', () => {
      const staged = buildStaged(['fix-b-022'], []);
      const report = CicValidatorService.validate(staged);
      const result = report.subject_results[0];
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.field === 'date_of_birth')).toBe(true);
    });

    it('should FAIL record 23: placeholder TIN (all zeros)', () => {
      const staged = buildStaged(['fix-b-023'], []);
      const report = CicValidatorService.validate(staged);
      const result = report.subject_results[0];
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.field === 'tin_number')).toBe(true);
    });

    it('should FAIL record 24: missing address', () => {
      const staged = buildStaged(['fix-b-024'], []);
      const report = CicValidatorService.validate(staged);
      const result = report.subject_results[0];
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.field === 'address')).toBe(true);
    });

    it('should FAIL record 25: duplicate membership number', () => {
      // Include MEM-001 (fix-b-001) and fix-b-025 which also has MEM-001
      const staged = buildStaged(['fix-b-001', 'fix-b-025'], ['fix-l-001']);
      const report = CicValidatorService.validate(staged);
      const dupResult = report.subject_results.find((r) => r.borrower_id === 'fix-b-025');
      expect(dupResult?.passed).toBe(false);
      expect(dupResult?.errors.some((e) => e.field === 'provider_subject_no')).toBe(true);
    });

    it('should FAIL orphaned loan (no matching borrower)', () => {
      const staged = buildStaged(['fix-b-001'], ['fix-l-001', 'fix-l-999']);
      const report = CicValidatorService.validate(staged);
      expect(report.blocking_errors.length).toBeGreaterThan(0);
      const orphanResult = report.contract_results.find(
        (r) => r.provider_contract_no === 'LN-2024-999'
      );
      expect(orphanResult?.passed).toBe(false);
    });
  });

  describe('overall_status', () => {
    it('returns "passed" when all subjects are valid', () => {
      const validIds = CIC_FIXTURE_BORROWERS.slice(0, 5).map((b) => b.id);
      const validLoanIds = CIC_FIXTURE_LOANS.slice(0, 5).map((l) => l.id);
      const staged = buildStaged(validIds, validLoanIds);
      const report = CicValidatorService.validate(staged);
      expect(report.overall_status).toBe('passed');
    });

    it('returns "partial" when some but not all subjects fail', () => {
      const mixed = ['fix-b-001', 'fix-b-021']; // 1 valid + 1 broken
      const staged = buildStaged(mixed, ['fix-l-001']);
      const report = CicValidatorService.validate(staged);
      expect(report.overall_status).toBe('partial');
    });
  });
});
