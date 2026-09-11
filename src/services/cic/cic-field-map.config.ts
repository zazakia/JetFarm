// src/services/cic/cic-field-map.config.ts
// Canonical field mapping: local DB → CIC Excel column layout
// Source of truth: MasterFile May 2024 CIC.xlsx
// Do NOT change column orders — must match CIC submission exactly

export const CIC_PROVIDER_CODE_DEFAULT = 'PF022730';
export const CIC_CURRENCY = 'PHP ';
export const CIC_COUNTRY_PH = 'PH';
export const CIC_ADDRESS_TYPE_INDIVIDUAL = 'MI';
export const CIC_ROLE_BORROWER = 'B';
export const CIC_PAYMENT_METHOD_CASH = 'CAS';
export const CIC_TRANSACTION_TYPE_NA = 'NA';

// Civil Status domain: borrowers.civil_status → CIC Title domain value
export const CIVIL_STATUS_TO_TITLE: Record<string, number> = {
  'single': 10,
  'married': 13,   // 13 = married with spouse listed
  'widowed': 11,
  'separated': 11,
  'annulled': 11,
};

// Civil Status domain: borrowers.civil_status → CIC CivilStatus code
export const CIVIL_STATUS_MAP: Record<string, number> = {
  'single': 1,
  'married': 2,
  'widowed': 3,
  'separated': 4,
  'annulled': 5,
};

// Gender: borrowers.gender → CIC Gender ('M'/'F')
export const GENDER_MAP: Record<string, string> = {
  'male': 'M',
  'm': 'M',
  'M': 'M',
  'female': 'F',
  'f': 'F',
  'F': 'F',
};

// Loan frequency: loans.frequency → CIC Payment Periodicity ('D'/'W'/'M')
export const FREQUENCY_MAP: Record<string, string> = {
  'daily': 'D',
  'weekly': 'W',
  'bi-weekly': 'B',
  'biweekly': 'B',
  'semi-monthly': 'S',
  'monthly': 'M',
};

// Loan status: loans.status → CIC Contract Phase
export const STATUS_TO_PHASE: Record<string, string> = {
  'active': 'AC',
  'completed': 'CL',
  'written_off': 'WO',
  'write_off': 'WO',
  'restructured': 'CR',
  'past_due': 'PD',
};

// Loan status → CIC Contract Status (delinquency marker)
// Only set when there is an adverse status; otherwise null
export const STATUS_TO_CONTRACT_STATUS: Record<string, string | null> = {
  'active': null,
  'completed': null,
  'past_due': 'PD',
  'written_off': 'WO',
  'write_off': 'WO',
  'restructured': 'CR',
};

// Purpose of Credit domain (CIC code for typical cooperative microfinance)
export const DEFAULT_PURPOSE_CODE = 23; // Personal / Salary Loan

// Loan type → CIC Purpose of Credit override (user-configurable, see CicSettingsService)
export const DEFAULT_LOAN_TYPE_TO_CONTRACT_TYPE: Record<string, number> = {
  'regular': 22,
  'emergency': 22,
  'business': 22,
  'livelihood': 22,
  'educational': 22,
};

// Negative Event codes
export const NE_CODE_DECEASED = 'U';       // Customer untraceable or deceased
export const NE_CODE_DELINQUENT = 'M';     // Mishandled Account
export const NE_STATUS_ACTIVE = 'AC';
export const NE_STATUS_CLOSED = 'CL';

// Validation: placeholder/dummy value denylist
export const PLACEHOLDER_PATTERNS = [
  /^0+$/,                    // all zeros
  /^1+$/,                    // all ones
  /^9+$/,                    // all nines
  /^01.?01.?1900$/,          // dummy DOB
  /^1900/,                   // DOB year 1900
  /^n\/a$/i,                 // N/A
  /^none$/i,
  /^null$/i,
  /^test$/i,
  /^xxx+$/i,
  /^0{9,}$/,                 // 9+ zeros (dummy TIN)
  /^1234567890$/,            // sequential
  /^(\d)\1{5,}$/,            // repeated digit 6+ times
];

// CIC ID column order (for Excel row generation)
export const ID_COLUMNS = [
  'record_type',        // Col 1
  'provider_code',      // Col 2
  'branch_code',        // Col 3
  'subject_ref_date',   // Col 4
  'provider_subject_no',// Col 5
  'title',              // Col 6
  'first_name',         // Col 7
  'last_name',          // Col 8
  'middle_name',        // Col 9
  'suffix',             // Col 10
  'nickname',           // Col 11
  'previous_last_name', // Col 12
  'gender',             // Col 13
  'date_of_birth',      // Col 14
  'place_of_birth',     // Col 15
  'country_of_birth',   // Col 16
  'nationality',        // Col 17
  'resident',           // Col 18
  'civil_status',       // Col 19
  'num_dependents',     // Col 20
  'cars_owned',         // Col 21
  'spouse_first_name',  // Col 22
  'spouse_last_name',   // Col 23
  'spouse_middle_name', // Col 24
  'mother_first_name',  // Col 25
  'mother_full_name',   // Col 26
  'mother_middle_name', // Col 27
  'father_first_name',  // Col 28
  'father_last_name',   // Col 29
  'father_middle_name', // Col 30
  'address_type',       // Col 31
  'full_address',       // Col 32
] as const;

export const CI_COLUMNS = [
  'record_type',           // Col 1
  'provider_code',         // Col 2
  'branch_code',           // Col 3
  'contract_ref_date',     // Col 4
  'provider_subject_no',   // Col 5
  'role',                  // Col 6
  'provider_contract_no',  // Col 7
  'contract_type',         // Col 8
  'contract_phase',        // Col 9
  'contract_status',       // Col 10
  'currency',              // Col 11
  'original_currency',     // Col 12
  'contract_start_date',   // Col 13
  'contract_request_date', // Col 14
  'contract_end_planned',  // Col 15
  'contract_end_actual',   // Col 16
  'last_payment_date',     // Col 17
  'reorganized_credit_code',// Col 18
  'board_resolution_flag', // Col 19
  'financed_amount',       // Col 20
  'installments_number',   // Col 21
  'transaction_type',      // Col 22
  'purpose_of_credit',     // Col 23
  'payment_periodicity',   // Col 24
  'payment_method',        // Col 25
  'monthly_payment_amount',// Col 26
  'first_payment_date',    // Col 27
  'last_payment_amount',   // Col 28
  'next_payment_date',     // Col 29
  'next_payment_amount',   // Col 30
  'days_past_due',         // Col 31
  'outstanding_balance',   // Col 32
  'dpd_amount',            // Col 33
  'dpd_amount_value',      // Col 34
  'restructured_flag',     // Col 35
] as const;

export const NE_COLUMNS = [
  'record_type',
  'provider_code',
  'branch_code',
  'ne_ref_date',
  'provider_subject_no',
  'event_code',
  'event_detail',
  'event_date',
  'event_status',
  'event_status_date',
] as const;

export const FT_COLUMNS = [
  'record_type',
  'provider_code',
  'file_ref_date',
  'record_count',
] as const;
