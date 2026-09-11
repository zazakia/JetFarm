import { Database , appSchema, tableSchema } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import Loki from 'lokijs';

import Borrower from '../Borrower';
import { EncryptionService } from '../../../services/EncryptionService';
import { closeTestDatabase } from '../../../__tests__/test-utils';

// Mock EncryptionService
jest.mock('../../../services/EncryptionService', () => ({
  EncryptionService: {
    decrypt: jest.fn(),
  },
}));

describe('Borrower Model', () => {
  let database: Database;
  let borrowersCollection: any;

  beforeAll(() => {
    const adapter = new LokiJSAdapter({
      schema: appSchema({
        version: 1,
        tables: [
          tableSchema({
            name: 'borrowers',
            columns: [
              { name: 'full_name', type: 'string' },
              { name: 'address', type: 'string' },
              { name: 'phone', type: 'string' },
              { name: 'collector_id', type: 'string' },
              { name: 'auth_id', type: 'string' },
              { name: 'date_of_birth', type: 'number' },
              { name: 'gender', type: 'string' },
              { name: 'notes', type: 'string' },
              { name: 'created_by', type: 'string' },
              { name: 'created_at', type: 'number' },
              { name: 'updated_at', type: 'number' },
            ],
          }),
        ],
      }),
      useWebWorker: false,
      useIncrementalSQLite: false,
      useIncrementalIndexedDB: false,
      _testLokiAdapter: new Loki.LokiMemoryAdapter(),
      extraLokiOptions: { autosave: false },
    } as any);

    database = new Database({
      adapter,
      modelClasses: [Borrower],
    });

    borrowersCollection = database.get('borrowers');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await closeTestDatabase(database);
  });

  it('should initialize and decrypt phone and address', async () => {
    (EncryptionService.decrypt as jest.Mock)
      .mockImplementation((val) => val === 'enc_phone' ? '1234567890' : 'Main St');

    let borrower: Borrower;
    await database.write(async () => {
      borrower = await borrowersCollection.create((record: any) => {
        record.fullName = 'John Doe';
        record.address = 'enc_address';
        record.phone = 'enc_phone';
        record.collectorId = 'collector1';
        record.authId = 'auth1';
        record.dateOfBirth = Date.now();
        record.gender = 'male';
        record.notes = 'note';
        record.createdBy = 'admin';
      });
    });

    expect(borrower!).toBeDefined();
    expect(borrower!.fullName).toBe('John Doe');
    
    // Test the getters
    const decPhone = borrower!.decryptedPhone;
    const decAddress = borrower!.decryptedAddress;
    
    expect(EncryptionService.decrypt).toHaveBeenCalledWith('enc_phone');
    expect(EncryptionService.decrypt).toHaveBeenCalledWith('enc_address');
    expect(decPhone).toBe('1234567890');
    expect(decAddress).toBe('Main St');
  });
});
