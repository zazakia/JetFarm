import { CicExtractService } from '../CicExtractService';

// Mock supabase
jest.mock('../../../database/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    then: jest.fn((resolve) => resolve({ data: [], error: null })),
  },
}));

// Mock CicSettingsService
jest.mock('../CicSettingsService', () => ({
  CicSettingsService: {
    getSettings: jest.fn().mockResolvedValue({
      provider_code: 'PF022730',
      default_contract_type: 22,
      loan_type_map: {},
    }),
  },
}));

describe('CicExtractService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an extraction result with the correct period', async () => {
    const { supabase } = require('../../../database/supabase');
    // Mock borrowers response
    const mockBuilder = {
      select: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      then: jest.fn((resolve) => resolve({ data: [], error: null })),
    };
    supabase.from.mockImplementation((table: string) => mockBuilder);

    const result = await CicExtractService.extract('2024-05');
    expect(result.period).toBe('2024-05');
    expect(Array.isArray(result.subjects)).toBe(true);
    expect(Array.isArray(result.contracts)).toBe(true);
  });

  it('collects extraction errors without throwing', async () => {
    const { supabase } = require('../../../database/supabase');
    const mockBuilder = {
      select: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      then: jest.fn((resolve) => resolve({ data: null, error: { message: 'DB connection failed' } })),
    };
    supabase.from.mockImplementation((table: string) => mockBuilder);

    const result = await CicExtractService.extract('2024-05');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Borrower fetch error');
  });
});
