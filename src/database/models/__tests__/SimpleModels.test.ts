import { Database, Model , appSchema, tableSchema } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import Loki from 'lokijs';


import CashTransaction from '../CashTransaction';
import BankTransaction from '../BankTransaction';
import CollectionLog from '../CollectionLog';
import Loan from '../Loan';
import FinancialSnapshot from '../FinancialSnapshot';
import Payment from '../Payment';
import UserProfile from '../UserProfile';
import PaymentSchedule from '../PaymentSchedule';
import Expense from '../Expense';
import { closeTestDatabase } from '../../../__tests__/test-utils';

describe('Simple Database Models', () => {
  let database: Database;

  beforeAll(() => {
    const adapter = new LokiJSAdapter({
      schema: appSchema({
        version: 1,
        tables: [
          tableSchema({ name: 'cash_transactions', columns: [{ name: 'amount', type: 'number' }] }),
          tableSchema({ name: 'bank_transactions', columns: [{ name: 'amount', type: 'number' }] }),
          tableSchema({ name: 'collection_logs', columns: [{ name: 'amount_collected', type: 'number' }] }),
          tableSchema({ name: 'loans', columns: [{ name: 'principal_amount', type: 'number' }] }),
          tableSchema({ name: 'financial_snapshots', columns: [{ name: 'total_cash', type: 'number' }] }),
          tableSchema({ name: 'payments', columns: [{ name: 'amount', type: 'number' }] }),
          tableSchema({ name: 'user_profiles', columns: [{ name: 'full_name', type: 'string' }] }),
          tableSchema({ name: 'payment_schedules', columns: [{ name: 'amount_due', type: 'number' }] }),
          tableSchema({ name: 'expenses', columns: [{ name: 'amount', type: 'number' }] }),
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
      modelClasses: [
        CashTransaction,
        BankTransaction,
        CollectionLog,
        Loan,
        FinancialSnapshot,
        Payment,
        UserProfile,
        PaymentSchedule,
        Expense
      ],
    });
  });

  afterAll(async () => {
    await closeTestDatabase(database);
  });

  const testModelInit = async (ModelClass: typeof Model, collectionName: string, fieldName: string, value: any) => {
    const collection = database.get(collectionName);
    let record: any;
    
    await database.write(async () => {
      record = await collection.create((r: any) => {
        r[fieldName] = value;
      });
    });
    
    expect(record).toBeDefined();
    expect(record[fieldName]).toBe(value);
  };

  it('initializes CashTransaction model', () => testModelInit(CashTransaction, 'cash_transactions', 'amount', 100));
  it('initializes BankTransaction model', () => testModelInit(BankTransaction, 'bank_transactions', 'amount', 200));
  it('initializes CollectionLog model', () => testModelInit(CollectionLog, 'collection_logs', 'amount_collected', 300));
  it('initializes Loan model', () => testModelInit(Loan, 'loans', 'principalAmount', 400));
  it('initializes FinancialSnapshot model', () => testModelInit(FinancialSnapshot, 'financial_snapshots', 'totalCash', 500));
  it('initializes Payment model', () => testModelInit(Payment, 'payments', 'amount', 600));
  it('initializes UserProfile model', () => testModelInit(UserProfile, 'user_profiles', 'fullName', 'Test User'));
  it('initializes PaymentSchedule model', () => testModelInit(PaymentSchedule, 'payment_schedules', 'amountDue', 800));
  it('initializes Expense model', () => testModelInit(Expense, 'expenses', 'amount', 900));
});
