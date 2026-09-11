import { supabase } from '../../database/supabase';
import {
  GENDER_MAP, FREQUENCY_MAP, STATUS_TO_PHASE, STATUS_TO_CONTRACT_STATUS,
  CIVIL_STATUS_TO_TITLE, CIVIL_STATUS_MAP, DEFAULT_PURPOSE_CODE,
  CIC_CURRENCY, CIC_COUNTRY_PH, CIC_ADDRESS_TYPE_INDIVIDUAL, CIC_ROLE_BORROWER,
  CIC_PAYMENT_METHOD_CASH, CIC_TRANSACTION_TYPE_NA,
} from './cic-field-map.config';
import { CicSettingsService } from './CicSettingsService';

// Types for staged records
export interface CicStagedSubject {
  // Key
  provider_subject_no: string;     // membership_number
  borrower_id: string;
  // Demographics
  first_name: string;
  last_name: string;
  middle_name: string | null;
  name_suffix: string | null;
  gender: string | null;
  date_of_birth_raw: number | null;  // Unix ms
  birthplace: string | null;
  civil_status_raw: string | null;
  number_of_dependents: number | null;
  // Spouse
  spouse_first_name: string | null;
  spouse_last_name: string | null;
  spouse_middle_name: string | null;
  // Mother
  mother_maiden_name: string | null;
  // Address
  address: string | null;
  barangay: string | null;
  city_municipality: string | null;
  province: string | null;
  // Gov IDs
  tin_number: string | null;
  sss_number: string | null;
  gsis_number: string | null;
  philhealth_number: string | null;
  // Adverse
  deceased: boolean | null;
  date_of_death_raw: number | null;
  is_delinquent: boolean | null;
  delinquent_since_raw: number | null;
}

export interface CicStagedContract {
  borrower_id: string;
  provider_subject_no: string;
  provider_contract_no: string;     // loan_number
  loan_id: string;
  loan_type: string | null;
  contract_type: number;            // CIC domain code
  status: string;
  principal_amount: number;
  term: number;
  term_unit: string;
  frequency: string | null;
  release_date_raw: number | null;
  maturity_date_raw: number | null;
  first_payment_date_raw: number | null;
  installment_amount: number;
  is_reloan: boolean | null;
  bod_resolution_number: string | null;
  dpd: number | null;
  is_delinquent: boolean | null;
  // Computed at extraction time
  last_payment_date_raw: number | null;
  last_payment_amount: number | null;
  next_payment_date_raw: number | null;
  next_payment_amount: number | null;
  outstanding_balance: number;
  total_paid: number;
}

export interface CicStagedResult {
  period: string;                   // 'YYYY-MM'
  extracted_at: string;             // ISO timestamp
  subjects: CicStagedSubject[];
  contracts: CicStagedContract[];
  errors: string[];
}

function formatDate(unixMs: number | null | undefined): string | null {
  if (!unixMs) return null;
  const d = new Date(unixMs);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}${mm}${yyyy}`;
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0); // day 0 = last day of previous month
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}${mm}${yyyy}`;
}

export class CicExtractService {
  /**
   * Extract all data for a reporting period.
   * @param period 'YYYY-MM' — the month being reported
   * @returns Normalized staged result; never throws (errors collected in result.errors)
   */
  static async extract(period: string): Promise<CicStagedResult> {
    const errors: string[] = [];
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const refDateStr = lastDayOfMonth(year, month);
    const periodEndMs = new Date(year, month, 0).getTime(); // last ms of period end day

    const settings = await CicSettingsService.getSettings();
    const loanTypeMap = settings?.loan_type_map ?? {};
    const defaultContractType = settings?.default_contract_type ?? 22;

    // ── 1. Fetch borrowers (read-only) ──────────────────────────────
    const { data: borrowersRaw, error: bErr } = await supabase
      .from('borrowers')
      .select(
        'id, membership_number, first_name, last_name, middle_name, name_suffix, ' +
        'gender, date_of_birth, birthplace, civil_status, number_of_dependents, ' +
        'spouse_first_name, spouse_surname, spouse_middle_name, mother_maiden_name, ' +
        'address, barangay, city_municipality, province, ' +
        'tin_number, sss_number, gsis_number, philhealth_number, ' +
        'deceased, date_of_death, is_delinquent, delinquent_since, deleted_at'
      )
      .is('deleted_at', null);

    if (bErr) {
      errors.push(`Borrower fetch error: ${bErr.message}`);
      return { period, extracted_at: new Date().toISOString(), subjects: [], contracts: [], errors };
    }

    const borrowers = (borrowersRaw as any[]) ?? [];
    const subjects: CicStagedSubject[] = borrowers.map((b: any) => ({
      provider_subject_no: b.membership_number ?? b.id,
      borrower_id: b.id,
      first_name: b.first_name ?? '',
      last_name: b.last_name ?? '',
      middle_name: b.middle_name ?? null,
      name_suffix: b.name_suffix ?? null,
      gender: b.gender ?? null,
      date_of_birth_raw: b.date_of_birth ?? null,
      birthplace: b.birthplace ?? null,
      civil_status_raw: b.civil_status ?? null,
      number_of_dependents: b.number_of_dependents ?? null,
      spouse_first_name: b.spouse_first_name ?? null,
      spouse_last_name: b.spouse_surname ?? null,
      spouse_middle_name: b.spouse_middle_name ?? null,
      mother_maiden_name: b.mother_maiden_name ?? null,
      address: b.address ?? null,
      barangay: b.barangay ?? null,
      city_municipality: b.city_municipality ?? null,
      province: b.province ?? null,
      tin_number: b.tin_number ?? null,
      sss_number: b.sss_number ?? null,
      gsis_number: b.gsis_number ?? null,
      philhealth_number: b.philhealth_number ?? null,
      deceased: b.deceased ?? null,
      date_of_death_raw: b.date_of_death ?? null,
      is_delinquent: b.is_delinquent ?? null,
      delinquent_since_raw: b.delinquent_since ?? null,
    }));

    // ── 2. Fetch loans active during the period (read-only) ─────────
    const { data: loansRaw, error: lErr } = await supabase
      .from('loans')
      .select(
        'id, borrower_id, loan_number, loan_type, principal_amount, term, term_unit, ' +
        'frequency, release_date, maturity_date, first_payment_date, installment_amount, ' +
        'status, is_reloan, bod_resolution_number, dpd, is_delinquent, total_amount, deleted_at'
      )
      .is('deleted_at', null)
      .or(`status.eq.active,status.eq.completed,status.eq.past_due,status.eq.written_off`);

    if (lErr) {
      errors.push(`Loan fetch error: ${lErr.message}`);
    }

    const loans = (loansRaw as any[]) ?? [];
    // Build borrower_id → membership_number lookup
    const borrowerMap = new Map<string, string>();
    for (const s of subjects) {
      borrowerMap.set(s.borrower_id, s.provider_subject_no);
    }

    // ── 3. Fetch payments for last-payment computation (read-only) ──
    const loanIds = (loans ?? []).map((l) => l.id);
    let paymentMap = new Map<string, { date: number; amount: number }>(); // loan_id → last payment
    let nextScheduleMap = new Map<string, { date: number; amount: number }>(); // loan_id → next due
    let totalPaidMap = new Map<string, number>(); // loan_id → total paid

    if (loanIds.length > 0) {
      const { data: paymentsRaw } = await supabase
        .from('payments')
        .select('loan_id, payment_date, amount')
        .in('loan_id', loanIds)
        .is('deleted_at', null)
        .lte('payment_date', periodEndMs);

      const payments = (paymentsRaw as any[]) ?? [];
      for (const p of payments) {
        const prev = paymentMap.get(p.loan_id);
        if (!prev || p.payment_date > prev.date) {
          paymentMap.set(p.loan_id, { date: p.payment_date, amount: p.amount });
        }
        totalPaidMap.set(p.loan_id, (totalPaidMap.get(p.loan_id) ?? 0) + p.amount);
      }

      const { data: schedulesRaw } = await supabase
        .from('payment_schedules')
        .select('loan_id, due_date, scheduled_amount')
        .in('loan_id', loanIds)
        .neq('status', 'paid')
        .is('deleted_at', null)
        .order('due_date', { ascending: true });

      const schedules = (schedulesRaw as any[]) ?? [];
      const seenLoan = new Set<string>();
      for (const s of schedules) {
        if (!seenLoan.has(s.loan_id)) {
          nextScheduleMap.set(s.loan_id, { date: s.due_date, amount: s.scheduled_amount });
          seenLoan.add(s.loan_id);
        }
      }
    }

    // ── 4. Build staged contracts ────────────────────────────────────
    const contracts: CicStagedContract[] = [];
    for (const l of loans) {
      const subjectNo = borrowerMap.get(l.borrower_id);
      if (!subjectNo) {
        errors.push(`Loan ${l.loan_number}: orphaned — no matching borrower ${l.borrower_id}`);
        continue;
      }
      const loanTypeLower = (l.loan_type ?? '').toLowerCase();
      const contractType = loanTypeMap[loanTypeLower] ?? defaultContractType;
      const lastPmt = paymentMap.get(l.id);
      const nextSched = nextScheduleMap.get(l.id);
      const totalPaid = totalPaidMap.get(l.id) ?? 0;
      const outstanding = Math.max(0, (l.total_amount ?? l.principal_amount) - totalPaid);

      contracts.push({
        borrower_id: l.borrower_id,
        provider_subject_no: subjectNo,
        provider_contract_no: l.loan_number,
        loan_id: l.id,
        loan_type: l.loan_type ?? null,
        contract_type: contractType,
        status: l.status,
        principal_amount: l.principal_amount,
        term: l.term,
        term_unit: l.term_unit,
        frequency: l.frequency ?? null,
        release_date_raw: l.release_date ?? null,
        maturity_date_raw: l.maturity_date ?? null,
        first_payment_date_raw: l.first_payment_date ?? null,
        installment_amount: l.installment_amount,
        is_reloan: l.is_reloan ?? null,
        bod_resolution_number: l.bod_resolution_number ?? null,
        dpd: l.dpd ?? null,
        is_delinquent: l.is_delinquent ?? null,
        last_payment_date_raw: lastPmt?.date ?? null,
        last_payment_amount: lastPmt?.amount ?? null,
        next_payment_date_raw: nextSched?.date ?? null,
        next_payment_amount: nextSched?.amount ?? null,
        outstanding_balance: outstanding,
        total_paid: totalPaid,
      });
    }

    return {
      period,
      extracted_at: new Date().toISOString(),
      subjects,
      contracts,
      errors,
    };
  }
}
