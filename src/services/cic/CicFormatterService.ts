import * as FileSystem from 'expo-file-system';
import {
  CIC_CURRENCY, CIC_COUNTRY_PH, CIC_ADDRESS_TYPE_INDIVIDUAL, CIC_ROLE_BORROWER,
  CIC_PAYMENT_METHOD_CASH, CIC_TRANSACTION_TYPE_NA, DEFAULT_PURPOSE_CODE,
  GENDER_MAP, FREQUENCY_MAP, STATUS_TO_PHASE, STATUS_TO_CONTRACT_STATUS,
  CIVIL_STATUS_TO_TITLE, CIVIL_STATUS_MAP,
  NE_CODE_DECEASED, NE_CODE_DELINQUENT, NE_STATUS_ACTIVE,
} from './cic-field-map.config';
import { CicStagedResult, CicStagedSubject, CicStagedContract } from './CicExtractService';
import { CicSettingsService } from './CicSettingsService';

function fmt(unixMs: number | null | undefined): string | null {
  if (!unixMs) return null;
  const d = new Date(unixMs);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}${mm}${yyyy}`;
}

function lastDayFmt(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m, 0);
  return `${String(d.getDate()).padStart(2,'0')}${String(m).padStart(2,'0')}${y}`;
}

function buildAddress(s: CicStagedSubject): string {
  return [s.address, s.barangay, s.city_municipality, s.province]
    .filter(Boolean)
    .join(' ')
    .trim();
}

export interface CicFormattedOutput {
  /** 'regular' or 'special' — never mixed */
  submission_type: 'regular' | 'special';
  period: string;
  file_name: string;
  record_count: number;
  ds_count: number;
  ci_count: number;
  ne_count: number;
  /** Rows ready for Excel export: each row is an array of cell values matching MasterFile column order */
  rows: (string | number | null)[][];
}

export class CicFormatterService {
  /**
   * Generate a Regular Submission formatted output.
   * Must only be called with a PASSED CicValidationReport.
   */
  static async formatRegular(staged: CicStagedResult): Promise<CicFormattedOutput> {
    return CicFormatterService.format(staged, 'regular');
  }

  /**
   * Generate a Special Submission (correction/dispute) formatted output.
   * Pass only the subjects/contracts involved in the correction.
   */
  static async formatSpecial(staged: CicStagedResult): Promise<CicFormattedOutput> {
    return CicFormatterService.format(staged, 'special');
  }

  private static async format(
    staged: CicStagedResult,
    submissionType: 'regular' | 'special',
  ): Promise<CicFormattedOutput> {
    const settings = await CicSettingsService.getSettings();
    const providerCode = settings?.provider_code ?? 'PF022730';
    const branchCode = settings?.branch_code ?? null;
    const refDate = lastDayFmt(staged.period);
    const rows: (string | number | null)[][] = [];

    // ── Header row (HE) ─────────────────────────────────────────────
    rows.push([
      'HE',
      providerCode,
      refDate,
      '1.0',          // Version
      submissionType === 'regular' ? 'R' : 'S',  // R=Regular, S=Special
      null,           // Provider Comments
    ]);

    let dsCount = 0;
    let ciCount = 0;
    let neCount = 0;

    // Build contract lookup by borrower_id
    const contractsByBorrower = new Map<string, CicStagedContract[]>();
    for (const c of staged.contracts) {
      const existing = contractsByBorrower.get(c.borrower_id) ?? [];
      existing.push(c);
      contractsByBorrower.set(c.borrower_id, existing);
    }

    // ── ID rows (Data Subject) ───────────────────────────────────────
    for (const s of staged.subjects) {
      const civilStatusRaw = (s.civil_status_raw ?? '').toLowerCase();
      const titleCode = CIVIL_STATUS_TO_TITLE[civilStatusRaw] ?? 10;
      const civilStatusCode = CIVIL_STATUS_MAP[civilStatusRaw] ?? null;
      const genderCode = GENDER_MAP[s.gender ?? ''] ?? s.gender ?? null;
      const dobFmt = fmt(s.date_of_birth_raw);

      rows.push([
        'ID',                         // Col 1: Record Type
        providerCode,                 // Col 2: Provider Code
        branchCode,                   // Col 3: Branch Code
        refDate,                      // Col 4: Subject Ref Date
        s.provider_subject_no,        // Col 5: Provider Subject No
        titleCode,                    // Col 6: Title
        s.first_name?.toUpperCase(),  // Col 7: First Name
        s.last_name?.toUpperCase(),   // Col 8: Last Name
        s.middle_name?.toUpperCase() ?? null, // Col 9: Middle Name
        s.name_suffix?.toUpperCase() ?? null, // Col 10: Suffix
        null,                         // Col 11: Nickname
        null,                         // Col 12: Previous Last Name
        genderCode,                   // Col 13: Gender
        dobFmt,                       // Col 14: Date of Birth
        s.birthplace?.toUpperCase() ?? null, // Col 15: Place of Birth
        CIC_COUNTRY_PH,               // Col 16: Country of Birth
        CIC_COUNTRY_PH,               // Col 17: Nationality
        1,                            // Col 18: Resident
        civilStatusCode,              // Col 19: Civil Status
        s.number_of_dependents ?? null, // Col 20: No. of Dependents
        null,                         // Col 21: Car/s Owned
        s.spouse_first_name?.toUpperCase() ?? null,  // Col 22: Spouse First Name
        s.spouse_last_name?.toUpperCase() ?? null,   // Col 23: Spouse Last Name
        s.spouse_middle_name?.toUpperCase() ?? null, // Col 24: Spouse Middle Name
        null,                         // Col 25: Mother Maiden First Name
        s.mother_maiden_name?.toUpperCase() ?? null, // Col 26: Mother Maiden Full Name
        null,                         // Col 27: Mother Maiden Middle Name
        null,                         // Col 28: Father First Name
        null,                         // Col 29: Father Last Name
        null,                         // Col 30: Father Middle Name
        CIC_ADDRESS_TYPE_INDIVIDUAL,  // Col 31: Address Type
        buildAddress(s).toUpperCase(), // Col 32: Full Address
      ]);
      dsCount++;

      // ── CI rows for this subject ──────────────────────────────────
      const contracts = contractsByBorrower.get(s.borrower_id) ?? [];
      for (const c of contracts) {
        const phaseCode = STATUS_TO_PHASE[(c.status ?? '').toLowerCase()] ?? 'AC';
        const statusCode = STATUS_TO_CONTRACT_STATUS[(c.status ?? '').toLowerCase()] ?? null;
        const freqCode = FREQUENCY_MAP[(c.frequency ?? '').toLowerCase()] ?? null;
        const boardFlag = c.bod_resolution_number ? 1 : 0;

        // Compute number of installments based on term/term_unit
        let installmentsNumber = c.term;
        const termUnit = (c.term_unit ?? '').toLowerCase();
        const frequency = (c.frequency ?? '').toLowerCase();
        if (termUnit === 'months' && frequency === 'weekly') {
          installmentsNumber = c.term * 4;
        } else if (termUnit === 'months' && frequency === 'bi-weekly') {
          installmentsNumber = c.term * 2;
        } else if (termUnit === 'months' && frequency === 'daily') {
          installmentsNumber = c.term * 30;
        }

        rows.push([
          'CI',                                   // Col 1
          providerCode,                           // Col 2
          branchCode,                             // Col 3
          refDate,                                // Col 4
          c.provider_subject_no,                  // Col 5
          CIC_ROLE_BORROWER,                      // Col 6
          c.provider_contract_no,                 // Col 7
          c.contract_type,                        // Col 8
          phaseCode,                              // Col 9: Contract Phase
          statusCode,                             // Col 10: Contract Status (null if normal)
          CIC_CURRENCY,                           // Col 11
          CIC_CURRENCY,                           // Col 12
          fmt(c.release_date_raw),                // Col 13: Contract Start Date
          null,                                   // Col 14: Contract Request Date
          fmt(c.maturity_date_raw),               // Col 15: Contract End Planned
          c.status === 'completed' ? fmt(c.last_payment_date_raw) : null, // Col 16: Actual end
          fmt(c.last_payment_date_raw),           // Col 17: Last Payment Date
          c.is_reloan ? 'R' : null,               // Col 18: Reorganized Credit Code
          boardFlag,                              // Col 19: Board Resolution Flag
          String(c.principal_amount),             // Col 20: Financed Amount
          String(installmentsNumber),             // Col 21: Installments Number
          CIC_TRANSACTION_TYPE_NA,                // Col 22: Transaction Type
          DEFAULT_PURPOSE_CODE,                   // Col 23: Purpose of Credit
          freqCode,                               // Col 24: Payment Periodicity
          CIC_PAYMENT_METHOD_CASH,                // Col 25: Payment Method
          String(c.installment_amount),           // Col 26: Monthly Payment Amount
          fmt(c.first_payment_date_raw),          // Col 27: First Payment Date
          c.last_payment_amount != null ? String(c.last_payment_amount) : null, // Col 28
          fmt(c.next_payment_date_raw),           // Col 29: Next Payment Date
          c.next_payment_amount != null ? String(c.next_payment_amount) : null, // Col 30
          c.dpd ?? 0,                             // Col 31: Days Past Due
          String(Math.round(c.outstanding_balance)), // Col 32: Outstanding Balance
          c.dpd && c.dpd > 0 ? String(Math.round(c.outstanding_balance)) : '0', // Col 33: DPD Amount
          c.dpd && c.dpd > 0 ? String(Math.round(c.outstanding_balance)) : '0', // Col 34: DPD Amount Value
          c.is_reloan ? 1 : 0,                   // Col 35: Restructured Flag
        ]);
        ciCount++;
      }

      // ── NE row if adverse event ───────────────────────────────────
      if (s.deceased && s.date_of_death_raw) {
        rows.push([
          'NE', providerCode, branchCode, refDate,
          s.provider_subject_no,
          NE_CODE_DECEASED, null,
          fmt(s.date_of_death_raw),
          NE_STATUS_ACTIVE, refDate,
        ]);
        neCount++;
      } else if (s.is_delinquent && s.delinquent_since_raw) {
        rows.push([
          'NE', providerCode, branchCode, refDate,
          s.provider_subject_no,
          NE_CODE_DELINQUENT, null,
          fmt(s.delinquent_since_raw),
          NE_STATUS_ACTIVE, refDate,
        ]);
        neCount++;
      }
    }

    const recordCount = dsCount + ciCount + neCount;

    // ── FT row (Footer) ──────────────────────────────────────────────
    rows.push([
      'FT',
      providerCode,
      refDate,
      String(recordCount),
    ]);

    // ── File name convention: <ProviderCode>_<MMYYYY>_<R|S>.xlsx ────
    const [y, m] = staged.period.split('-');
    const fileSuffix = submissionType === 'regular' ? 'R' : 'S';
    const fileName = `${providerCode}_${m}${y}_${fileSuffix}.xlsx`;

    return {
      submission_type: submissionType,
      period: staged.period,
      file_name: fileName,
      record_count: recordCount,
      ds_count: dsCount,
      ci_count: ciCount,
      ne_count: neCount,
      rows,
    };
  }

  /**
   * Export formatted output to Excel file in the app's document directory.
   * Returns the local file URI.
   * NOTE: Uses a simple CSV-based approach for React Native compatibility.
   * For full .xlsx support, integrate exceljs via a Supabase Edge Function
   * when the CIC Submission Manual requires it.
   */
  static async exportToFile(output: CicFormattedOutput): Promise<string> {
    // @ts-ignore - expo-file-system types might be missing in some environments
    const dir = FileSystem.documentDirectory + 'cic_reports/';
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const filePath = dir + output.file_name.replace('.xlsx', '.csv');

    // Build CSV content
    const csvContent = output.rows
      .map((row) =>
        row
          .map((cell) => {
            if (cell === null || cell === undefined) return '';
            const str = String(cell);
            // Escape commas and quotes in values
            if (str.includes(',') || str.includes('"')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      )
      .join('\n');

    await FileSystem.writeAsStringAsync(filePath, csvContent, {
      // @ts-ignore
      encoding: FileSystem.EncodingType.UTF8,
    });

    return filePath;
  }
}
