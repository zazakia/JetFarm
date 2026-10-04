/**
 * CicFormatterService — Phase 1 AI-authored test suite (trial).
 *
 * Characterization tests: the CIC MasterFile layout (HE/ID/CI/NE/FT rows),
 * domain-code mappings, installment math, adverse-event precedence and
 * CSV export escaping are treated as the spec.
 *
 * Patterns: static service, no DB needed (pure staging → rows), settings
 * and expo-file-system mocked per .agents/skills/testing.
 */
import { CicFormatterService } from '../CicFormatterService';
import { CicSettingsService } from '../CicSettingsService';
import type { CicStagedResult, CicStagedSubject, CicStagedContract } from '../CicExtractService';

jest.mock('../CicSettingsService', () => ({
    CicSettingsService: { getSettings: jest.fn() },
}));

jest.mock('expo-file-system', () => ({
    documentDirectory: 'file:///data/documents/',
    makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
    writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
    EncodingType: { UTF8: 'utf8' },
}));

const FileSystem = require('expo-file-system');

const getSettingsMock = CicSettingsService.getSettings as jest.Mock;

function makeSubject(overrides: Partial<CicStagedSubject> = {}): CicStagedSubject {
    return {
        provider_subject_no: 'MEM-001',
        borrower_id: 'b1',
        first_name: 'maria',
        last_name: 'dela cruz',
        middle_name: 'santos',
        name_suffix: null,
        gender: 'F',
        date_of_birth_raw: new Date(1985, 2, 15).getTime(), // 15 Mar 1985 local
        birthplace: 'manila',
        civil_status_raw: 'married',
        number_of_dependents: 2,
        spouse_first_name: 'juan',
        spouse_last_name: 'dela cruz',
        spouse_middle_name: null,
        mother_maiden_name: null,
        address: '123 rizal st',
        barangay: 'brgy 1',
        city_municipality: 'manila',
        province: 'metro manila',
        tin_number: null,
        sss_number: null,
        gsis_number: null,
        philhealth_number: null,
        deceased: null,
        date_of_death_raw: null,
        is_delinquent: false,
        delinquent_since_raw: null,
        ...overrides,
    };
}

function makeContract(overrides: Partial<CicStagedContract> = {}): CicStagedContract {
    return {
        borrower_id: 'b1',
        provider_subject_no: 'MEM-001',
        provider_contract_no: 'LN-2024-001',
        loan_id: 'l1',
        loan_type: 'regular',
        contract_type: 22,
        status: 'active',
        principal_amount: 10000,
        term: 46,
        term_unit: 'payments',
        frequency: 'daily',
        release_date_raw: new Date(2024, 2, 1).getTime(),
        maturity_date_raw: new Date(2024, 4, 15).getTime(),
        first_payment_date_raw: new Date(2024, 2, 4).getTime(),
        installment_amount: 260,
        is_reloan: false,
        bod_resolution_number: null,
        dpd: 0,
        is_delinquent: false,
        last_payment_date_raw: null,
        last_payment_amount: null,
        next_payment_date_raw: null,
        next_payment_amount: null,
        outstanding_balance: 11960,
        total_paid: 0,
        ...overrides,
    };
}

function makeStaged(
    subjects: CicStagedSubject[],
    contracts: CicStagedContract[],
    period = '2024-05',
): CicStagedResult {
    return { period, extracted_at: new Date().toISOString(), subjects, contracts, errors: [] };
}

beforeEach(() => {
    jest.clearAllMocks();
    getSettingsMock.mockResolvedValue(null); // → default provider PF022730, branch null
});

describe('CicFormatterService.formatRegular — record skeleton', () => {
    it('emits HE header row with last-day ref date, version and R flag', async () => {
        const out = await CicFormatterService.formatRegular(makeStaged([makeSubject()], [makeContract()]));
        expect(out.rows[0]).toEqual(['HE', 'PF022730', '31052024', '1.0', 'R', null]);
        expect(out.submission_type).toBe('regular');
        expect(out.period).toBe('2024-05');
    });

    it('emits FT footer whose count equals ds+ci+ne and matches file name convention', async () => {
        const out = await CicFormatterService.formatRegular(makeStaged([makeSubject()], [makeContract()]));
        const last = out.rows[out.rows.length - 1];
        expect(last).toEqual(['FT', 'PF022730', '31052024', String(out.record_count)]);
        expect(out.record_count).toBe(out.ds_count + out.ci_count + out.ne_count);
        expect(out.file_name).toBe('PF022730_052024_R.xlsx');
    });

    it('honors configured provider/branch codes in every row', async () => {
        getSettingsMock.mockResolvedValue({ provider_code: 'PF999999', branch_code: 'BR-01' });
        const out = await CicFormatterService.formatRegular(makeStaged([makeSubject()], [makeContract()]));
        expect(out.file_name).toBe('PF999999_052024_R.xlsx');
        for (const row of out.rows) expect(row[1]).toBe('PF999999');
        // ID (idx 2) and CI (idx 2) carry branch code; HE/FT do not
        const idRow = out.rows.find((r) => r[0] === 'ID');
        expect(idRow?.[2]).toBe('BR-01');
    });
});

describe('CicFormatterService.formatSpecial', () => {
    it('marks the header S and names the file _S.xlsx', async () => {
        const out = await CicFormatterService.formatSpecial(makeStaged([makeSubject()], []));
        expect(out.rows[0][4]).toBe('S');
        expect(out.file_name).toBe('PF022730_052024_S.xlsx');
        expect(out.submission_type).toBe('special');
    });
});

describe('CicFormatterService — ID rows', () => {
    it('maps married female to title 13 / civil 2 with uppercase and DDMMYYYY DOB', async () => {
        const out = await CicFormatterService.formatRegular(
            makeStaged([makeSubject()], []),
        );
        const id = out.rows.find((r) => r[0] === 'ID')!;
        expect(id[5]).toBe(13);                       // Title (married w/ spouse)
        expect(id[6]).toBe('MARIA');
        expect(id[7]).toBe('DELA CRUZ');
        expect(id[8]).toBe('SANTOS');
        expect(id[12]).toBe('F');                    // Gender
        expect(id[13]).toBe('15031985');             // DOB
        expect(id[15]).toBe('PH');                   // Country of birth
        expect(id[16]).toBe('PH');                   // Nationality
        expect(id[18]).toBe(2);                      // Civil status
        expect(id[21]).toBe('JUAN');                 // Spouse first
        expect(id[30]).toBe('MI');                   // Address type
        expect(id[31]).toBe('123 RIZAL ST BRGY 1 MANILA METRO MANILA');
        expect(out.ds_count).toBe(1);
    });

    it('falls back to title 10 / civil null for unknown civil status', async () => {
        const out = await CicFormatterService.formatRegular(
            makeStaged([makeSubject({ civil_status_raw: 'common-law' })], []),
        );
        const id = out.rows.find((r) => r[0] === 'ID')!;
        expect(id[5]).toBe(10);
        expect(id[18]).toBeNull();
    });

    it('joins only the address parts that exist', async () => {
        const out = await CicFormatterService.formatRegular(
            makeStaged([makeSubject({ address: null, barangay: 'brgy 1', city_municipality: null, province: null })], []),
        );
        const id = out.rows.find((r) => r[0] === 'ID')!;
        expect(id[31]).toBe('BRGY 1');
    });
});

describe('CicFormatterService — CI rows', () => {
    const ciOf = (out: { rows: (string | number | null)[][] }) => out.rows.find((r) => r[0] === 'CI')!;

    it('maps active daily loan to AC/null with PHP currency and string amounts', async () => {
        const out = await CicFormatterService.formatRegular(
            makeStaged([makeSubject()], [makeContract()]),
        );
        const ci = ciOf(out);
        expect(ci[5]).toBe('B');                     // Role borrower
        expect(ci[8]).toBe('AC');                    // Phase
        expect(ci[9]).toBeNull();                    // No adverse status
        expect(ci[10]).toBe('PHP ');
        expect(ci[17]).toBeNull();                   // Not reorganized
        expect(ci[18]).toBe(0);                      // Board flag off
        expect(ci[19]).toBe('10000');                // Financed amount as string
        expect(ci[20]).toBe('46');                   // term_unit 'payments' → term verbatim
        expect(ci[23]).toBe('D');                    // Daily periodicity
        expect(ci[25]).toBe('260');
        expect(ci[31]).toBe('11960');                // Outstanding rounded string
        expect(ci[32]).toBe('0');                    // DPD amount zero when dpd = 0
        expect(out.ci_count).toBe(1);
    });

    it('completed loan closes phase CL and reports actual end date', async () => {
        const out = await CicFormatterService.formatRegular(
            makeStaged([makeSubject()], [makeContract({
                status: 'completed',
                last_payment_date_raw: new Date(2024, 4, 15).getTime(),
            })]),
        );
        const ci = ciOf(out);
        expect(ci[8]).toBe('CL');
        expect(ci[15]).toBe('15052024');             // Actual end (col 16)
        expect(ci[16]).toBe('15052024');             // Last payment date (col 17)
    });

    it.each([
        ['weekly', '8'],
        ['bi-weekly', '4'],
        ['daily', '60'],
    ])('converts a 2-month term to %s installment count %s', async (freq, expected) => {
        const out = await CicFormatterService.formatRegular(
            makeStaged([makeSubject()], [makeContract({ term: 2, term_unit: 'months', frequency: freq })]),
        );
        expect(ciOf(out)[20]).toBe(expected);
    });

    it('flags reloan with R and restructured flag 1', async () => {
        const out = await CicFormatterService.formatRegular(
            makeStaged([makeSubject()], [makeContract({ is_reloan: true })]),
        );
        const ci = ciOf(out);
        expect(ci[17]).toBe('R');
        expect(ci[34]).toBe(1);
    });

    it('sets board resolution flag and DPD amounts when past due', async () => {
        const out = await CicFormatterService.formatRegular(
            makeStaged([makeSubject()], [makeContract({
                status: 'past_due', bod_resolution_number: 'BOD-77', dpd: 45, outstanding_balance: 9000.4,
            })]),
        );
        const ci = ciOf(out);
        expect(ci[8]).toBe('PD');
        expect(ci[9]).toBe('PD');
        expect(ci[18]).toBe(1);
        expect(ci[30]).toBe(45);
        expect(ci[31]).toBe('9000');                 // Math.round(9000.4)
        expect(ci[32]).toBe('9000');
        expect(ci[33]).toBe('9000');
    });

    it('groups multiple contracts under their own subject row order', async () => {
        const s1 = makeSubject({ borrower_id: 'b1', provider_subject_no: 'MEM-001' });
        const s2 = makeSubject({ borrower_id: 'b2', provider_subject_no: 'MEM-002' });
        const c1 = makeContract({ borrower_id: 'b1', loan_id: 'l1' });
        const c2 = makeContract({ borrower_id: 'b1', loan_id: 'l2', provider_contract_no: 'LN-2024-002' });
        const c3 = makeContract({ borrower_id: 'b2', loan_id: 'l3', provider_contract_no: 'LN-2024-003' });
        const out = await CicFormatterService.formatRegular(makeStaged([s1, s2], [c1, c2, c3]));
        const types = out.rows.slice(1, -1).map((r) => r[0]);
        expect(types).toEqual(['ID', 'CI', 'CI', 'ID', 'CI']);
        expect(out.ds_count).toBe(2);
        expect(out.ci_count).toBe(3);
    });
});

describe('CicFormatterService — NE (negative event) rows', () => {
    const neRows = (out: { rows: (string | number | null)[][] }) => out.rows.filter((r) => r[0] === 'NE');

    it('emits deceased NE row U with date of death', async () => {
        const out = await CicFormatterService.formatRegular(
            makeStaged([makeSubject({ deceased: true, date_of_death_raw: new Date(2024, 3, 2).getTime() })], []),
        );
        const ne = neRows(out);
        expect(ne).toHaveLength(1);
        expect(ne[0][5]).toBe('U');
        expect(ne[0][7]).toBe('02042024');
        expect(ne[0][8]).toBe('AC');
        expect(out.ne_count).toBe(1);
    });

    it('emits delinquent NE row M with delinquent-since date', async () => {
        const out = await CicFormatterService.formatRegular(
            makeStaged([makeSubject({ is_delinquent: true, delinquent_since_raw: new Date(2024, 0, 15).getTime() })], []),
        );
        const ne = neRows(out);
        expect(ne).toHaveLength(1);
        expect(ne[0][5]).toBe('M');
        expect(ne[0][7]).toBe('15012024');
    });

    it('deceased takes precedence over delinquent, and delinquent without a date emits nothing', async () => {
        const both = await CicFormatterService.formatRegular(
            makeStaged([makeSubject({
                deceased: true, date_of_death_raw: new Date(2024, 3, 2).getTime(),
                is_delinquent: true, delinquent_since_raw: new Date(2024, 0, 15).getTime(),
            })], []),
        );
        expect(neRows(both)).toHaveLength(1);
        expect(neRows(both)[0][5]).toBe('U');

        const noDate = await CicFormatterService.formatRegular(
            makeStaged([makeSubject({ is_delinquent: true, delinquent_since_raw: null })], []),
        );
        expect(neRows(noDate)).toHaveLength(0);
        expect(noDate.ne_count).toBe(0);
    });
});

describe('CicFormatterService.exportToFile', () => {
    it('writes CSV (not xlsx) with quoted escaping into cic_reports/', async () => {
        const out = await CicFormatterService.formatRegular(
            makeStaged([makeSubject({ first_name: 'ann, jr', last_name: 'o"brien' })], []),
        );
        const path = await CicFormatterService.exportToFile(out);
        expect(path).toBe('file:///data/documents/cic_reports/PF022730_052024_R.csv');
        expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith('file:///data/documents/cic_reports/', { intermediates: true });
        const written = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0];
        expect(written[0]).toBe(path);
        const firstDataLine = written[1].split('\n')[1];
        expect(firstDataLine).toContain('"ANN, JR"');   // uppercased, comma-quoted
        expect(firstDataLine).toContain('"O""BRIEN"');  // quotes doubled per CSV rules
    });

    it('renders null cells as empty strings', async () => {
        const out = await CicFormatterService.formatRegular(makeStaged([makeSubject({ middle_name: null })], []));
        await CicFormatterService.exportToFile(out);
        const written = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0][1];
        const header = written.split('\n')[0];
        expect(header).toBe('HE,PF022730,31052024,1.0,R,'); // trailing null → empty
    });
});
