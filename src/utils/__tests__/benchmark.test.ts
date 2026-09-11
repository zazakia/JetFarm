import { benchmarkQueries } from '../benchmark';
import { database } from '../../database';

jest.mock('../../database', () => ({
  database: {
    get: jest.fn().mockReturnThis(),
    query: jest.fn().mockReturnThis(),
    fetch: jest.fn().mockResolvedValue([]),
  },
}));

describe('benchmark utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs benchmarks and returns results', async () => {
    const results = await benchmarkQueries();
    expect(results).toHaveProperty('fetchAllBorrowers');
    expect(results).toHaveProperty('fetchAllLoans');
    expect(results).toHaveProperty('fetchAllPayments');
    expect(results).toHaveProperty('fetchActiveLoans');
  });

  it('handles errors gracefully', async () => {
    (database.get as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Test error');
    });
    // Silent the console.error for clean logs
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const results = await benchmarkQueries();
    expect(results).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    
    errorSpy.mockRestore();
  });
});
