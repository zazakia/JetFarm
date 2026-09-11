import { PdfGenerator } from '../PdfGenerator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { COMPANY_NAME } from '../../constants/brand';

// Mock expo modules
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn().mockResolvedValue({ uri: 'mock-uri' }),
  printAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(true),
}));

// Mock utils
jest.mock('../../utils/dates', () => ({
  formatDate: jest.fn().mockReturnValue('2026-01-01'),
  addNextDaySkipSunday: jest.fn((date: Date) => new Date(date.getTime() + 86400000)),
  addFrequencySkipSunday: jest.fn((date: Date) => new Date(date.getTime() + 86400000)),
}));

jest.mock('../../utils/currency', () => ({
  formatPHP: jest.fn().mockImplementation((val) => `PHP ${val}`),
}));

// Mock CreditorsGroupLifeSummaryService for generateCreditorsGroupLifeSummary coverage
jest.mock('../CreditorsGroupLifeSummaryService', () => ({
  CreditorsGroupLifeSummaryService: {
    buildRows: jest.fn().mockReturnValue([
      {
        voucherNumber: 1,
        lastName: 'DOE',
        firstName: 'JOHN',
        middleInitial: '',
        sex: 'M',
        dateOfBirth: '1-Jan-1990',
        effectiveDate: '1-Jan-2026',
        civilStatus: '',
        amountOfLoan: 10000,
        typeOfLoan: 'SALARY',
        termMonths: 12,
        approvedTermMonths: '',
        annualNetPremiumPaid: 200,
        serviceFee: 20,
        annualGrossPremiumPaid: 220,
      },
    ]),
    buildHtml: jest.fn().mockReturnValue('<html>Mock CGL Summary</html>'),
  },
}));

describe('PdfGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates and shares a statement of account', async () => {
    // Omitting optional fields to hit the ?? '—' fallbacks
    const borrower = { fullName: 'John Doe' };
    const loan = { 
      loanNumber: 'L-1001', 
      principalAmount: 10000, 
      interestRate: 3.5, 
      interestType: 'diminishing',
      term: 3,
      termUnit: 'months',
      frequency: 'weekly',
      installmentAmount: 800,
      totalAmount: 11050,
      status: 'active'
    };
    const payments = [
      { paymentDate: 1735689600000, amount: 800, runningBalance: 10250 } // Omitted receiptNumber and notes
    ];

    await PdfGenerator.generateStatementOfAccount(borrower as any, loan as any, payments as any);

    expect(Print.printToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(COMPANY_NAME)
      })
    );
    expect(Sharing.isAvailableAsync).toHaveBeenCalled();
    expect(Sharing.shareAsync).toHaveBeenCalledWith('mock-uri', expect.objectContaining({
      mimeType: 'application/pdf',
      dialogTitle: expect.stringContaining('John Doe')
    }));
  });

  it('renders deposit and insurance rows if provided', async () => {
    const loanWithFees = { 
      loanNumber: 'L-5', totalAmount: 1100, installmentAmount: 200, status: 'active', principalAmount: 1000,
      depositAmount: 50, insuranceAmount: 20,
      releaseDate: 1735689600000, maturityDate: 1738689600000
    };
    const borrower = { fullName: 'Jane', dateOfBirth: 946684800000, address: '123 Test', phone: '123', gender: 'Female' };
    const payments = [{ paymentDate: 1735689600000, amount: 200, pSavings: 50, runningBalance: 900, notes: 'Paid', receiptNumber: 'R1' }];

    await PdfGenerator.generateStatementOfAccount(borrower as any, loanWithFees as any, payments as any);
    expect(Print.printToFileAsync).toHaveBeenCalled();
  });

  it('renders motor vehicle SOA rebate and customer signature space', async () => {
    const borrower = { fullName: 'Motor Client', phone: '09171234567' };
    const loan = {
      loanNumber: 'MV-1',
      loanType: 'motor_vehicle',
      principalAmount: 100000,
      interestRate: 2.5,
      term: 12,
      termUnit: 'months',
      frequency: 'monthly',
      installmentAmount: 10000,
      totalAmount: 120000,
      status: 'active',
      rebateAmount: 500,
    };

    await PdfGenerator.generateStatementOfAccount(borrower as any, loan as any, [] as any);

    const html = (Print.printToFileAsync as jest.Mock).mock.calls[0][0].html;
    expect(html).toContain('Rebate');
    expect(html).toContain('PHP 500');
    expect(html).toContain('Signature over printed name of customer');
    expect(html).toContain('signature-panel');
  });

  it('renders computed SOA penalties and includes them in balance', async () => {
    const borrower = { fullName: 'Penalty Client' };
    const loan = {
      loanNumber: 'L-PEN',
      principalAmount: 10000,
      interestRate: 5,
      interestType: 'flat',
      term: 1,
      termUnit: 'months',
      frequency: 'daily',
      installmentAmount: 1000,
      totalAmount: 12000,
      status: 'active',
    };
    const payments = [{ paymentDate: 1735689600000, amount: 2000, runningBalance: 10050 }];
    const penalties = [{
      dueDate: 1735603200000,
      amountDue: 1000,
      daysDelayed: 3,
      penaltyAmount: 5,
      reason: 'Penalty = amount due × 5% ÷ 30 × 3 days delayed',
    }];

    await PdfGenerator.generateStatementOfAccount(borrower as any, loan as any, payments as any, penalties as any);

    const html = (Print.printToFileAsync as jest.Mock).mock.calls[0][0].html;
    expect(html).toContain('Computed Penalty');
    expect(html).toContain('Days Delayed');
    expect(html).toContain('Penalty = amount due × 5% ÷ 30 × 3 days delayed');
    expect(html).toContain('PHP 5');
    expect(html).toContain('PHP 10005');
  });

  it('works correctly with zero payments', async () => {
    const borrower = { fullName: 'No Pay' };
    const loan = { loanNumber: 'L-0', totalAmount: 500, status: 'pending', principalAmount: 500 };
    
    await PdfGenerator.generateStatementOfAccount(borrower as any, loan as any, [] as any);
    
    expect(Print.printToFileAsync).toHaveBeenCalled();
    expect(Sharing.shareAsync).toHaveBeenCalled();
  });

  it('handles sharing unavailable gracefully', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    
    await PdfGenerator.generateStatementOfAccount({ fullName: 'Broken Share' } as any, { status: 'X', principalAmount: 0 } as any, []);
    
    expect(Print.printToFileAsync).toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('uses printAsync on web platform', async () => {
    const { Platform } = require('react-native');
    const originalOS = Platform.OS;
    Platform.OS = 'web';

    await PdfGenerator.generateStatementOfAccount({ fullName: 'Web' } as any, { status: 'X', principalAmount: 0 } as any, []);
    
    expect(Print.printAsync).toHaveBeenCalled();

    Platform.OS = originalOS;
  });

  it('generates a loan computation slip for institutional loans', async () => {
    await PdfGenerator.generateLoanComputationSlip(
      { fullName: 'Salary Borrower', address: 'Main St' } as any,
      {
        loanNumber: 'SL-1',
        loanType: 'salary_regular',
        principalAmount: 100478.5,
        interestRate: 2.5,
        interestType: 'flat',
        term: 24,
        termUnit: 'months',
        frequency: 'bi_monthly',
        installmentAmount: 3500,
        totalAmount: 168000,
        status: 'active',
        processingFee: 3014.36,
        insuranceAmount: 2508.8,
        notarialFee: 300,
      } as any,
      'Encoder'
    );

    expect(Print.printToFileAsync).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining('COMPUTATION SLIP')
    }));
  });

  it('generates promissory note and sworn certification forms', async () => {
    await PdfGenerator.generateLoanContractForms(
      { fullName: 'Pension Borrower', address: 'Barangay 1' } as any,
      {
        loanNumber: 'PL-1',
        loanType: 'pension',
        principalAmount: 10273.99,
        interestRate: 2.5,
        interestType: 'flat',
        term: 6,
        termUnit: 'months',
        frequency: 'monthly',
        installmentAmount: 2000,
        totalAmount: 12000,
        status: 'active',
      } as any
    );

    expect(Print.printToFileAsync).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining('PROMISSORY NOTE')
    }));
  });

  it('generates an excess cash receipt from overpayment details', async () => {
    await PdfGenerator.generateExcessCashReceipt({
      borrowerName: 'Over Payor',
      loanNumber: 'LN-EXCESS',
      receiptNumber: 'RCT-9',
      paymentDate: new Date('2026-05-14T00:00:00Z'),
      amountReceived: 4500,
      amountDue: 1800,
      amountRemaining: 2700,
      deductions: [{ label: 'PN-01', amount: 1300 }],
      recipientName: 'Over Payor',
      preparedBy: 'Admin',
    });

    const html = (Print.printToFileAsync as jest.Mock).mock.calls[0][0].html;
    expect(html).toContain('CASH RECEIPT');
    expect(html).toContain('Over Payor');
    expect(html).toContain('amt. remaining');
    expect(html).toContain('LN-EXCESS');
    expect(html).toContain('PHP 2700');
  });

  // ── Coverage-targeting tests ──

  it('generates creditors group life summary (covers lines 518-520)', async () => {
    await PdfGenerator.generateCreditorsGroupLifeSummary(
      { fullName: 'John Doe' } as any,
      { loanNumber: 'LN-1', principalAmount: 10000 } as any
    );

    expect(Print.printToFileAsync).toHaveBeenCalled();
    // Sharing should also be attempted (tested elsewhere)
    expect(Sharing.isAvailableAsync).toHaveBeenCalled();
  });

  it('sorts multiple payments by date in SOA (covers line 179 sort)', async () => {
    const borrower = { fullName: 'Multi Pay' };
    const loan = { loanNumber: 'L-MULTI', principalAmount: 5000, totalAmount: 6000, status: 'active' };
    // Payments deliberately out of chronological order to exercise .sort()
    const payments = [
      { paymentDate: 1735776000000, amount: 1000, runningBalance: 5000, receiptNumber: 'R3' },  // Jan 2
      { paymentDate: 1735689600000, amount: 2000, runningBalance: 4000, receiptNumber: 'R1' },  // Jan 1
      { paymentDate: 1735699600000, amount:  500, runningBalance: 5500, receiptNumber: 'R2' },  // Jan 1 (later)
    ];

    await PdfGenerator.generateStatementOfAccount(borrower as any, loan as any, payments as any);
    expect(Print.printToFileAsync).toHaveBeenCalled();
  });

  it('sorts multiple penalties by due date in SOA (covers line 192 sort)', async () => {
    const borrower = { fullName: 'Multi Penalty' };
    const loan = { loanNumber: 'L-MPEN', principalAmount: 5000, totalAmount: 6000, status: 'active' };
    const payments = [{ paymentDate: 1735689600000, amount: 1000, runningBalance: 5000 }];
    const penalties = [
      { dueDate: 1735862400000, amountDue: 1000, daysDelayed: 5, penaltyAmount: 8.33 },
      { dueDate: 1735776000000, amountDue: 1000, daysDelayed: 3, penaltyAmount: 5 },
    ];

    await PdfGenerator.generateStatementOfAccount(borrower as any, loan as any, payments as any, penalties as any);
    const html = (Print.printToFileAsync as jest.Mock).mock.calls[0][0].html;
    expect(html).toContain('Days Delayed');
    expect(Print.printToFileAsync).toHaveBeenCalled();
  });

  it('uses iframe-based print on web when document is defined (covers lines 93-126)', async () => {
    // Save original globals
    const { Platform } = require('react-native');
    const originalPlatformOS = Platform.OS;
    const originalDocument = (global as any).document;
    Platform.OS = 'web';

    // Mock browser document
    const iframeMock: any = {
      style: {},
      srcdoc: '',
      onload: null as any,
      contentWindow: null as any,
      remove: jest.fn(),
    };

    const iframeContentWindow = {
      focus: jest.fn(),
      print: jest.fn(),
      onafterprint: null as any,
    };

    const documentMock = {
      createElement: jest.fn().mockReturnValue(iframeMock),
      body: {
        appendChild: jest.fn(),
      },
    };

    // Set up document in global scope
    (global as any).document = documentMock;

    try {
      // Override createElement mock: wire up contentWindow and fire onload
      documentMock.createElement.mockImplementation((tag: string) => {
        if (tag === 'iframe') {
          iframeMock.contentWindow = iframeContentWindow;
          // Simulate onload firing after srcdoc is set
          setTimeout(() => {
            if (iframeMock.onload) {
              iframeMock.onload();
            }
          }, 0);
          return iframeMock;
        }
        return {};
      });

      await PdfGenerator.generateStatementOfAccount(
        { fullName: 'Web Iframe' } as any,
        { loanNumber: 'L-WEB', principalAmount: 1000, totalAmount: 2000, status: 'active' } as any,
        []
      );

      // The printAsync mock should NOT be called — we're in the iframe path
      expect(Print.printAsync).not.toHaveBeenCalled();
      // printToFileAsync should NOT be called on web
      expect(Print.printToFileAsync).not.toHaveBeenCalled();
      // Document.createElement should have been called for the iframe
      expect(documentMock.createElement).toHaveBeenCalledWith('iframe');
      // The iframe should have been appended to the body
      expect(documentMock.body.appendChild).toHaveBeenCalledWith(iframeMock);
      // contentWindow.focus and print should have been called
      expect(iframeContentWindow.focus).toHaveBeenCalled();
      expect(iframeContentWindow.print).toHaveBeenCalled();
    } finally {
      // Always restore globals
      (global as any).document = originalDocument;
      Platform.OS = originalPlatformOS;
    }
  });

  it('printHtmlOnWeb handles missing iframe contentWindow gracefully', async () => {
    // Save original globals
    const { Platform } = require('react-native');
    const originalPlatformOS = Platform.OS;
    const originalDocument = (global as any).document;
    Platform.OS = 'web';

    const iframeMock: any = {
      style: {},
      srcdoc: '',
      onload: null as any,
      contentWindow: null, // No contentWindow → will trigger reject
      remove: jest.fn(),
    };

    const documentMock = {
      createElement: jest.fn().mockReturnValue(iframeMock),
      body: {
        appendChild: jest.fn(),
      },
    };

    (global as any).document = documentMock;

    try {
      // Fire onload but contentWindow is null
      documentMock.createElement.mockImplementation((tag: string) => {
        if (tag === 'iframe') {
          setTimeout(() => {
            if (iframeMock.onload) {
              iframeMock.onload();
            }
          }, 0);
          return iframeMock;
        }
        return {};
      });

      // The call should reject with 'Unable to open print frame.'
      await expect(PdfGenerator.generateStatementOfAccount(
        { fullName: 'No Window' } as any,
        { loanNumber: 'L-NOWIN', principalAmount: 1000, totalAmount: 2000, status: 'active' } as any,
        []
      )).rejects.toThrow('Unable to open print frame.');

      // iframe should have been removed (contentWindow null triggers remove before reject)
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(iframeMock.remove).toHaveBeenCalled();
      expect(documentMock.body.appendChild).toHaveBeenCalled();
    } finally {
      // Always restore globals
      (global as any).document = originalDocument;
      Platform.OS = originalPlatformOS;
    }
  });

  it('excess cash receipt renders no-deductions message when deductions undefined', async () => {
    await PdfGenerator.generateExcessCashReceipt({
      borrowerName: 'No Deduct',
      paymentDate: new Date('2026-06-01T00:00:00Z'),
      amountReceived: 5000,
      amountDue: 5000,
      amountRemaining: 0,
      // deductions intentionally undefined
    });

    const html = (Print.printToFileAsync as jest.Mock).mock.calls[0][0].html;
    expect(html).toContain('CASH RECEIPT');
    expect(html).toContain('No deductions recorded');
  });

  it('generates statement of account with multiple loan statements', async () => {
    const borrower = { fullName: 'Multi Loan' };
    const loan1 = { loanNumber: 'L-1', principalAmount: 5000, totalAmount: 6000, status: 'paid' } as any;
    const loan2 = { loanNumber: 'L-2', principalAmount: 3000, totalAmount: 4000, status: 'active' } as any;
    const payments1 = [{ paymentDate: 1735689600000, amount: 6000, runningBalance: 0 }];
    const payments2 = [{ paymentDate: 1735776000000, amount: 1000, runningBalance: 3000 }];

    await PdfGenerator.generateBorrowerStatementOfAccount(borrower as any, [
      { loan: loan1, payments: payments1 },
      { loan: loan2, payments: payments2 },
    ]);

    const html = (Print.printToFileAsync as jest.Mock).mock.calls[0][0].html;
    expect(html).toContain('L-1');
    expect(html).toContain('L-2');
    expect(html).toContain('Loan 1 of 2');
    expect(html).toContain('Loan 2 of 2');
    expect(html).toContain('PAID');
  });

  it('normalizes statuses (completed→PAID, closed→PAID, defaulted→DEFAULTED)', async () => {
    const statuses = ['completed', 'closed', 'defaulted', 'random'];
    for (const status of statuses) {
      jest.clearAllMocks();
      const borrower = { fullName: 'Status Test' };
      const loan = { loanNumber: `L-${status}`, principalAmount: 1000, totalAmount: 1100, status } as any;
      await PdfGenerator.generateStatementOfAccount(borrower as any, loan as any, []);
      const html = (Print.printToFileAsync as jest.Mock).mock.calls[0][0].html;
      
      if (status === 'completed' || status === 'closed') {
        expect(html).toContain('PAID');
      } else if (status === 'defaulted') {
        expect(html).toContain('DEFAULTED');
      } else {
        expect(html).toContain('ACTIVE');
      }
    }
  });

  it('generates excess cash receipt without optional fields', async () => {
    await PdfGenerator.generateExcessCashReceipt({
      borrowerName: 'Minimal',
      paymentDate: new Date('2026-06-15T00:00:00Z'),
      amountReceived: 3000,
      amountDue: 2000,
      amountRemaining: 1000,
      // No loanNumber, receiptNumber, deductions, remarks, recipientName, preparedBy
    });

    const html = (Print.printToFileAsync as jest.Mock).mock.calls[0][0].html;
    expect(html).toContain('CASH RECEIPT');
    expect(html).toContain('Minimal');
    expect(html).toContain('N/A'); // missing loanNumber/receiptNumber
    // preparedBy defaults
    expect(html).toContain('System');
  });

  it('generates loan computation slip with default preparedBy', async () => {
    await PdfGenerator.generateLoanComputationSlip(
      { fullName: 'Default Prep' } as any,
      { loanNumber: 'SL-DEF', principalAmount: 5000, totalAmount: 6000 } as any
    );

    expect(Print.printToFileAsync).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining('COMPUTATION SLIP'),
    }));
  });

  it('displays penalty with default reason when reason is missing', async () => {
    const borrower = { fullName: 'Default Reason' };
    const loan = { loanNumber: 'L-DR', principalAmount: 1000, totalAmount: 1200, status: 'active' } as any;
    const payments = [{ paymentDate: 1735689600000, amount: 200, runningBalance: 1000 }];
    const penalties = [{
      dueDate: 1735689600000,
      amountDue: 1000,
      daysDelayed: 2,
      penaltyAmount: 3.33,
      // reason intentionally omitted
    }];

    await PdfGenerator.generateStatementOfAccount(borrower as any, loan as any, payments as any, penalties as any);
    const html = (Print.printToFileAsync as jest.Mock).mock.calls[0][0].html;
    expect(html).toContain('Amount due × 5% ÷ 30 × days delayed');
  });
});
