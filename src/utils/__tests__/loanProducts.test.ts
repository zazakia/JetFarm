// src/utils/__tests__/loanProducts.test.ts
import {
  LOAN_PRODUCT_PRESETS,
  getLoanProductPreset,
  getLoanProductPresets,
  isInstitutionalLoanType,
  loanProductLabel,
  processingFeeFromPrincipal,
  notarialFeeFromPrincipal,
  loanProductTermRuleText,
  validateLoanProductTerm,
  validateLoanProductPrincipal,
  setRuntimeLoanProductPresets,
} from '../loanProducts';

describe('loanProducts utilities', () => {
  beforeEach(() => {
    // Reset runtime presets before each test
    setRuntimeLoanProductPresets({});
  });

  test('getLoanProductPreset returns correct preset and defaults', () => {
    expect(getLoanProductPreset('standard').label).toBe('Standard Micro Loan');
    expect(getLoanProductPreset(undefined).label).toBe('Standard Micro Loan');
    expect(getLoanProductPreset('petty_cash').label).toBe('Petty Cash Loan');
    expect(getLoanProductPreset('invalid').label).toBe('Standard Micro Loan');
  });

  test('getLoanProductPresets returns all presets', () => {
    const presets = getLoanProductPresets();
    expect(presets).toHaveProperty('standard');
    expect(presets).toHaveProperty('petty_cash');
  });

  test('isInstitutionalLoanType correctly identifies types', () => {
    expect(isInstitutionalLoanType('petty_cash')).toBe(true);
    expect(isInstitutionalLoanType('livelihood')).toBe(true);
    expect(isInstitutionalLoanType('salary')).toBe(true);
    expect(isInstitutionalLoanType('emergency')).toBe(true);
    expect(isInstitutionalLoanType('standard')).toBe(false);
    expect(isInstitutionalLoanType(undefined)).toBe(false);
  });

  test('loanProductLabel falls back to standard when unknown or undefined', () => {
    expect(loanProductLabel('salary')).toBe('Salary Loan');
    expect(loanProductLabel('unknown')).toBe('Standard Micro Loan');
    expect(loanProductLabel(undefined)).toBe('Standard Micro Loan');
  });

  test('processingFeeFromPrincipal uses flat fee when defined', () => {
    const flatPreset = {
      ...LOAN_PRODUCT_PRESETS.standard,
      defaultProcessingFeeFlat: 123,
    } as any;
    setRuntimeLoanProductPresets({ standard: flatPreset });
    expect(processingFeeFromPrincipal('standard', 1000)).toBe(123);
  });

  test('processingFeeFromPrincipal falls back to rate calculation', () => {
    // standard defaultProcessingFeeRate is 0, so fee should be 0
    expect(processingFeeFromPrincipal('standard', 1000)).toBe(0);
    // petty_cash has rate 0.02
    expect(processingFeeFromPrincipal('petty_cash', 1000)).toBeCloseTo(20);
  });

  test('notarialFeeFromPrincipal respects threshold logic', () => {
    const preset = {
      ...LOAN_PRODUCT_PRESETS.standard,
      notarialFeeThreshold: 5000,
      notarialFeeAboveThreshold: 200,
      defaultNotarialFee: '0',
    } as any;
    setRuntimeLoanProductPresets({ standard: preset });
    expect(notarialFeeFromPrincipal('standard', 6000)).toBe(200);
    expect(notarialFeeFromPrincipal('standard', 4000)).toBe(0);
  });

  test('notarialFeeFromPrincipal parses defaultNotarialFee when no threshold', () => {
    expect(notarialFeeFromPrincipal('standard', 1000)).toBe(0);
  });

  test('loanProductTermRuleText returns correct messages', () => {
    const preset = {
      ...LOAN_PRODUCT_PRESETS.standard,
      minTermMonths: 2,
      maxTermMonths: 6,
    } as any;
    setRuntimeLoanProductPresets({ standard: preset });
    expect(loanProductTermRuleText('standard')).toBe('Standard Micro Loan term must be 2-6 months.');
    // only min
    setRuntimeLoanProductPresets({
      standard: { ...preset, maxTermMonths: undefined },
    });
    expect(loanProductTermRuleText('standard')).toBe('Standard Micro Loan term must be at least 2 months.');
    // only max
    setRuntimeLoanProductPresets({
      standard: { ...preset, minTermMonths: undefined },
    });
    expect(loanProductTermRuleText('standard')).toBe('Standard Micro Loan term must be at most 6 months.');
    // no limits
    setRuntimeLoanProductPresets({ standard: LOAN_PRODUCT_PRESETS.standard });
    expect(loanProductTermRuleText('standard')).toBeNull();
  });

  test('validateLoanProductTerm validates correctly', () => {
    const preset = {
      ...LOAN_PRODUCT_PRESETS.standard,
      minTermMonths: 2,
      maxTermMonths: 6,
    } as any;
    setRuntimeLoanProductPresets({ standard: preset });
    // non‑month unit
    expect(validateLoanProductTerm('standard', 3, 'weeks')).toBe(
      'Standard Micro Loan requires a monthly term. Standard Micro Loan term must be 2-6 months.'
    );
    // below min
    expect(validateLoanProductTerm('standard', 1, 'months')).toBe(
      'Standard Micro Loan term must be 2-6 months.'
    );
    // above max
    expect(validateLoanProductTerm('standard', 12, 'months')).toBe(
      'Standard Micro Loan term must be 2-6 months.'
    );
    // valid
    expect(validateLoanProductTerm('standard', 4, 'months')).toBeNull();
    // invalid terms
    expect(validateLoanProductTerm('standard', undefined, 'months')).toBeNull();
    expect(validateLoanProductTerm('standard', 0, 'months')).toBeNull();
    expect(validateLoanProductTerm('standard', -5, 'months')).toBeNull();
    expect(validateLoanProductTerm('standard', 'not-a-number', 'months')).toBeNull();
    expect(validateLoanProductTerm('standard', NaN, 'months')).toBeNull();
  });

  test('validateLoanProductPrincipal returns error when over max', () => {
    const preset = {
      ...LOAN_PRODUCT_PRESETS.livelihood,
      maxPrincipal: 5000,
    } as any;
    setRuntimeLoanProductPresets({ livelihood: preset });
    expect(validateLoanProductPrincipal('livelihood', 6000)).toMatch(/must not exceed/);
    expect(validateLoanProductPrincipal('livelihood', 4000)).toBeNull();
    // invalid principals
    expect(validateLoanProductPrincipal('livelihood', undefined)).toBeNull();
    expect(validateLoanProductPrincipal('livelihood', 0)).toBeNull();
    expect(validateLoanProductPrincipal('livelihood', -100)).toBeNull();
    expect(validateLoanProductPrincipal('livelihood', 'not-a-number')).toBeNull();
    expect(validateLoanProductPrincipal('livelihood', NaN)).toBeNull();
    // preset with no maxPrincipal
    const noMaxPreset = {
      ...LOAN_PRODUCT_PRESETS.livelihood,
      maxPrincipal: undefined,
    } as any;
    setRuntimeLoanProductPresets({ livelihood: noMaxPreset });
    expect(validateLoanProductPrincipal('livelihood', 10000)).toBeNull();
  });

  test('default loan product presets (livelihood, salary, emergency) allow principal amounts greater than 5000', () => {
    setRuntimeLoanProductPresets({});
    expect(validateLoanProductPrincipal('livelihood', 10000)).toBeNull();
    expect(validateLoanProductPrincipal('salary', 25000)).toBeNull();
    expect(validateLoanProductPrincipal('emergency', 50000)).toBeNull();
  });

  test('notarialFeeFromPrincipal handles non-finite defaultNotarialFee', () => {
    const preset = {
      ...LOAN_PRODUCT_PRESETS.standard,
      defaultNotarialFee: 'not-a-number',
      notarialFeeThreshold: undefined,
    } as any;
    setRuntimeLoanProductPresets({ standard: preset });
    expect(notarialFeeFromPrincipal('standard', 1000)).toBe(0);
  });
});
