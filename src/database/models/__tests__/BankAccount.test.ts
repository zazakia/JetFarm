import { Database , appSchema, tableSchema } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import Loki from 'lokijs';

import BankAccount from '../BankAccount';
import { EncryptionService } from '../../../services/EncryptionService';
import { closeTestDatabase } from '../../../__tests__/test-utils';

// Mock EncryptionService
jest.mock('../../../services/EncryptionService', () => ({
  EncryptionService: {
    decrypt: jest.fn(),
  },
}));

describe('BankAccount Model', () => {
  let database: Database;
  let accountsCollection: any;

  beforeAll(() => {
    const adapter = new LokiJSAdapter({
      schema: appSchema({
        version: 1,
        tables: [
          tableSchema({
            name: 'bank_accounts',
            columns: [
              { name: 'bank_name', type: 'string' },
              { name: 'account_name', type: 'string' },
              { name: 'account_number', type: 'string' },
              { name: 'starting_balance', type: 'number' },
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
      modelClasses: [BankAccount],
    });

    accountsCollection = database.get('bank_accounts');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await closeTestDatabase(database);
  });

  it('should initialize and decrypt account number', async () => {
    (EncryptionService.decrypt as jest.Mock).mockReturnValue('123456789');

    let account: BankAccount;
    await database.write(async () => {
      account = await accountsCollection.create((record: any) => {
        record.bankName = 'Test Bank';
        record.accountName = 'Test Name';
        record.accountNumber = 'encrypted_string';
        record.startingBalance = 1000;
        record.createdAt = Date.now();
        record.updatedAt = Date.now();
      });
    });

    expect(account!).toBeDefined();
    expect(account!.bankName).toBe('Test Bank');
    
    // Test the getter
    const decrypted = account!.decryptedAccountNumber;
    expect(EncryptionService.decrypt).toHaveBeenCalledWith('encrypted_string');
    expect(decrypted).toBe('123456789');
  });
});
