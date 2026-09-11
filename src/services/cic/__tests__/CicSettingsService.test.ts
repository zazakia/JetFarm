import { CicSettingsService } from '../CicSettingsService';

// Mock supabase with proper chaining
const mockSingle = jest.fn();
const mockLimit = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ limit: mockLimit, single: mockSingle }));
const mockNeq = jest.fn();
const mockUpdate = jest.fn(() => ({ neq: mockNeq }));
const mockFrom = jest.fn().mockReturnValue(({
  select: mockSelect,
  update: mockUpdate,
  neq: mockNeq,
}));

jest.mock('../../../database/supabase', () => ({
  supabase: {
    from: () => mockFrom(),
  },
}));

describe('CicSettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    it('returns settings when fetch succeeds', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: '1',
          provider_code: 'PF022730',
          branch_code: 'BR001',
          cooperative_name: 'Test Coop',
          default_currency: 'PHP',
          default_contract_type: 22,
          loan_type_map: { regular: 1, emergency: 2 },
          alert_push_enabled: true,
          alert_email_enabled: false,
          alert_email_address: null,
          extract_by_day: 3,
          validate_by_day: 5,
          submit_by_day: 8,
        },
        error: null,
      });

      const result = await CicSettingsService.getSettings();
      expect(result).not.toBeNull();
      expect(result!.provider_code).toBe('PF022730');
    });

    it('returns null when fetch fails', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

      const result = await CicSettingsService.getSettings();
      expect(result).toBeNull();
    });

    it('returns null when no settings exist', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const result = await CicSettingsService.getSettings();
      expect(result).toBeNull();
    });
  });

  describe('updateSettings', () => {
    it('returns true on successful update', async () => {
      mockNeq.mockResolvedValueOnce({ error: null });

      const result = await CicSettingsService.updateSettings({ provider_code: 'NEWCODE' });
      expect(result).toBe(true);
    });

    it('returns false on update error', async () => {
      mockNeq.mockResolvedValueOnce({ error: { message: 'Update failed' } });

      const result = await CicSettingsService.updateSettings({ provider_code: 'NEWCODE' });
      expect(result).toBe(false);
    });
  });

  describe('resolveContractType', () => {
    it('returns mapped type when loan_type_map has key', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { loan_type_map: { regular: 5 }, default_contract_type: 22 },
        error: null,
      });

      const result = await CicSettingsService.resolveContractType('Regular');
      expect(result).toBe(5);
    });

    it('returns default_contract_type when key not in map', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { loan_type_map: { regular: 5 }, default_contract_type: 22 },
        error: null,
      });

      const result = await CicSettingsService.resolveContractType('Emergency');
      expect(result).toBe(22);
    });

    it('returns 22 when no settings exist', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const result = await CicSettingsService.resolveContractType('Regular');
      expect(result).toBe(22);
    });
  });
});
