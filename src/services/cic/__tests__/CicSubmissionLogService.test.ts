import { CicSubmissionLogService } from '../CicSubmissionLogService';

// Build the mock inline since jest.mock() factory can't reference outer variables
// unless prefixed with 'mock' AND defined before the mock call.
const mockSupabaseChain: any = {};

function rebuildChain() {
  mockSupabaseChain.insert = jest.fn(() => mockSupabaseChain);
  mockSupabaseChain.select = jest.fn(() => mockSupabaseChain);
  mockSupabaseChain.eq = jest.fn(() => mockSupabaseChain);
  mockSupabaseChain.order = jest.fn(() => mockSupabaseChain);
  mockSupabaseChain.limit = jest.fn(() => mockSupabaseChain);
  mockSupabaseChain.single = jest.fn();
  mockSupabaseChain.then = undefined;
}

rebuildChain();

jest.mock('../../../database/supabase', () => ({
  supabase: {
    from: jest.fn(() => mockSupabaseChain),
  },
}));

const mockValidationReport: any = {
  overall_status: 'passed',
  total_subjects: 10,
  failed_subjects: 0,
  total_contracts: 15,
  failed_contracts: 0,
  blocking_errors: [],
  subject_results: [],
  contract_results: [],
  validated_at: new Date().toISOString(),
};

describe('CicSubmissionLogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rebuildChain();
  });

  describe('createDraft', () => {
    it('returns id on success', async () => {
      mockSupabaseChain.single.mockResolvedValueOnce({ data: { id: 'log-123' }, error: null });
      const result = await CicSubmissionLogService.createDraft('2026-06', 'regular', 'user1');
      expect(result).toBe('log-123');
    });

    it('returns null on error', async () => {
      mockSupabaseChain.single.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
      const result = await CicSubmissionLogService.createDraft('2026-06', 'regular', 'user1');
      expect(result).toBeNull();
    });
  });

  describe('logValidation', () => {
    it('returns true on success', async () => {
      mockSupabaseChain.single
        .mockResolvedValueOnce({ data: { id: 'log-1', period: '2026-06', submission_type: 'regular', submitted_by: 'user1' }, error: null })
        .mockResolvedValueOnce({ error: null });

      const result = await CicSubmissionLogService.logValidation('log-1', mockValidationReport);
      expect(result).toBe(true);
    });

    it('returns false when existing log not found', async () => {
      mockSupabaseChain.single.mockResolvedValueOnce({ data: null, error: null });
      const result = await CicSubmissionLogService.logValidation('log-1', mockValidationReport);
      expect(result).toBe(false);
    });
  });

  describe('logFileGenerated', () => {
    it('returns id on success', async () => {
      mockSupabaseChain.single.mockResolvedValueOnce({ data: { id: 'file-1' }, error: null });
      const result = await CicSubmissionLogService.logFileGenerated({
        period: '2026-06',
        submission_type: 'regular',
        file_name: 'CIC_202606.csv',
        file_hash: 'abc123',
        record_count: 10,
        ds_count: 10,
        ci_count: 15,
        ne_count: 0,
        submitted_by: 'user1',
      });
      expect(result).toBe('file-1');
    });
  });

  describe('logSubmitted', () => {
    beforeEach(() => { mockSupabaseChain.then = undefined; });

    it('returns true on success', async () => {
      mockSupabaseChain.insert.mockReturnValueOnce({ error: null });
      const result = await CicSubmissionLogService.logSubmitted({
        period: '2026-06',
        submission_type: 'regular',
        file_name: 'CIC_202606.csv',
        submitted_by: 'user1',
      });
      expect(result).toBe(true);
    });
  });

  describe('logSpecialSubmission', () => {
    it('returns true on success', async () => {
      mockSupabaseChain.insert.mockReturnValueOnce({ error: null });
      const result = await CicSubmissionLogService.logSpecialSubmission({
        period: '2026-06',
        dispute_ref: 'DSP-001',
        file_name: 'SPECIAL_DSP-001.csv',
        submitted_by: 'user1',
      });
      expect(result).toBe(true);
    });
  });

  describe('getHistory', () => {
    it('returns submission list', async () => {
      mockSupabaseChain.limit.mockResolvedValueOnce({ data: [{ id: '1', period: '2026-06' }], error: null });
      const result = await CicSubmissionLogService.getHistory();
      expect(result).toEqual([{ id: '1', period: '2026-06' }]);
    });

    it('returns empty array on error', async () => {
      mockSupabaseChain.limit.mockResolvedValueOnce({ data: null, error: { message: 'Fail' } });
      const result = await CicSubmissionLogService.getHistory();
      expect(result).toEqual([]);
    });
  });

  describe('getLatestForPeriod', () => {
    it('returns latest submission', async () => {
      mockSupabaseChain.single.mockResolvedValueOnce({ data: { id: '1', period: '2026-06' }, error: null });
      const result = await CicSubmissionLogService.getLatestForPeriod('2026-06', 'regular');
      expect(result).toEqual({ id: '1', period: '2026-06' });
    });
  });
});
