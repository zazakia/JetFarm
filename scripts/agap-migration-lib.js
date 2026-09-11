const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const DEFAULT_SUMMARY_PATH = path.join('docs', 'SUMMARY.xlsx');
const DOWNLOAD_COLLECTION_PATH = 'E:/Users/HI/Downloads/Spreadsheets/COLLECTION SHEET.xlsx';
const REPO_COLLECTION_PATH = path.join('agap docs', 'COLLECTION SHEET.xlsx');

const STANDARD_INTEREST_RATE = 20;
const STANDARD_TERM = 20;
const SAVINGS_RATE_PER_PAYMENT = 0.01;
const LPF_PER_PAYMENT = 10;

function round2(value) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function cleanString(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeName(value) {
  return cleanString(value).toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value).replace(/[₱,\s]/g, '').replace(/^-$/, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function excelDateToJSDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const utcDays = Math.floor(value - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    const result = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    if (result.getFullYear() >= 1900 && result.getFullYear() <= 2100) return result;
    return null;
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100) {
    return parsed;
  }
  return null;
}

function toIsoDate(value) {
  const date = excelDateToJSDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function splitName(fullName) {
  const clean = cleanString(fullName);
  if (!clean) return { firstName: '', lastName: '', fullName: '' };
  if (clean.includes(',')) {
    const [lastName, ...firstParts] = clean.split(',').map((part) => cleanString(part));
    const firstName = firstParts.join(' ');
    return { firstName, lastName, fullName: cleanString(`${firstName} ${lastName}`) };
  }
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '', fullName: parts[0] };
  const lastName = parts.pop();
  return { firstName: parts.join(' '), lastName, fullName: clean };
}

function stableKey(...parts) {
  return crypto.createHash('sha1').update(parts.map((part) => cleanString(part)).join('|')).digest('hex').slice(0, 16);
}

function standardDeductions(principal, previousBalance = 0) {
  const arf = round2(principal * 0.02);
  const cpf = round2(principal * 0.04);
  const mem = 100;
  const lhf = 100;
  const rsf = 60;
  const docStamp = 45;
  const totalDeductions = round2(arf + cpf + mem + lhf + rsf + docStamp + previousBalance);
  return {
    arf,
    cpf,
    mem,
    lhf,
    rsf,
    docStamp,
    previousBalance: round2(previousBalance),
    totalDeductions,
    netProceeds: Math.max(0, round2(principal - totalDeductions)),
  };
}

function standardWeeklyAmortization(principal) {
  const weeklyPrincipal = round2(principal / STANDARD_TERM);
  const totalInterest = round2(principal * (STANDARD_INTEREST_RATE / 100));
  const weeklyInterest = round2(totalInterest / STANDARD_TERM);
  const weeklySavings = round2(principal * SAVINGS_RATE_PER_PAYMENT);
  const weeklyPayment = round2(weeklyPrincipal + weeklyInterest + weeklySavings + LPF_PER_PAYMENT);
  return {
    weeklyPrincipal,
    totalInterest,
    weeklyInterest,
    weeklySavings,
    lpf: LPF_PER_PAYMENT,
    weeklyPayment,
    totalReceivable: round2(weeklyPayment * STANDARD_TERM),
  };
}

function parseLoanCode(principal) {
  return principal > 0 ? `LC${String(Math.round(principal / 1000)).padStart(2, '0')}K` : null;
}

function chooseCollectionPath(candidates = [DOWNLOAD_COLLECTION_PATH, REPO_COLLECTION_PATH]) {
  return candidates.find((candidate) => fs.existsSync(candidate)) || REPO_COLLECTION_PATH;
}

function parseSummaryWorkbook(summaryPath = DEFAULT_SUMMARY_PATH) {
  const workbook = xlsx.readFile(summaryPath, { cellDates: false });
  const summary = xlsx.utils.sheet_to_json(workbook.Sheets.SUMMARY, { defval: null, raw: true });
  const sheet1 = workbook.Sheets.Sheet1
    ? xlsx.utils.sheet_to_json(workbook.Sheets.Sheet1, { header: 1, defval: null, raw: true })
    : [];
  const loanCodeByMemberId = new Map();

  for (const row of sheet1) {
    const memberId = cleanString(row[6]);
    const loanCode = cleanString(row[11]);
    if (/^AG\d+/i.test(memberId) && loanCode) loanCodeByMemberId.set(memberId.toUpperCase(), loanCode);
  }

  const borrowers = new Map();
  for (const row of summary) {
    const memberId = cleanString(row['Member ID']).toUpperCase();
    const name = cleanString(row['Full Name']);
    if (!memberId || !name) continue;

    const principal = toNumber(row['Loan Amount']);
    const names = splitName(name);
    const key = memberId || normalizeName(name);
    borrowers.set(key, {
      memberId,
      fullName: names.fullName,
      firstName: names.firstName,
      lastName: names.lastName,
      gender: cleanString(row.Gender) || null,
      dateOfBirth: toIsoDate(row.Birthdate),
      phone: cleanString(row['Contact No.']) || null,
      area: cleanString(row.Baranggay) || null,
      address: cleanString(row['Complete Address']) || null,
      sourceOfIncome: cleanString(row['Source of Income']) || null,
      dateJoined: toIsoDate(row['Date Joined']),
      membershipStatus: cleanString(row['Membership Status']) || null,
      collectorAssigned: cleanString(row['Collector Assigned']) || null,
      cycleId: toNumber(row.Cycle) || null,
      loanCode: loanCodeByMemberId.get(memberId) || parseLoanCode(principal),
      summaryPrincipal: principal,
    });
  }

  return { workbookPath: summaryPath, borrowers };
}

function extractSheetDate(sheetName, rows) {
  for (const value of [sheetName, rows?.[3]?.[0], rows?.[2]?.[0]]) {
    const text = cleanString(value);
    const match = text.match(/(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+\d{4}/i);
    if (match) {
      const date = new Date(match[0]);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  return null;
}

function extractGroupFromSheetName(sheetName, rows) {
  const withoutDate = cleanString(sheetName)
    .replace(/(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?).*/i, '')
    .replace(/\bPAST DUE\b/i, '')
    .trim();

  const title = cleanString(rows?.[2]?.find((cell) => typeof cell === 'string' && /collection sheet/i.test(cell)) || '');
  const titleGroup = title.match(/\(([^)]+)\)/)?.[1];
  const raw = titleGroup || withoutDate;
  if (/san dionisio\s*salay/i.test(raw)) return 'SALAY & SAN DIONISIO';
  if (/salay/i.test(raw) && /san dionisio/i.test(raw)) return 'SALAY & SAN DIONISIO';
  return cleanString(raw).toUpperCase() || null;
}

function findHeaderRow(rows) {
  for (let index = 0; index < Math.min(rows.length, 25); index += 1) {
    const row = rows[index] || [];
    const nameCol = row.findIndex((value) => /name of borrower|name of client/i.test(cleanString(value)));
    if (nameCol !== -1) return index;
  }
  return -1;
}

function headerIndex(headers, pattern) {
  return headers.findIndex((value) => pattern.test(cleanString(value)));
}

function parseHeaderPaymentDate(value, sheetDate) {
  const text = cleanString(value);
  if (typeof value === 'number') return excelDateToJSDate(value);
  if (!text || text === '-') return null;

  const year = sheetDate?.getFullYear() || 2026;
  const range = text.match(/([A-Za-z]+)\s+\d{1,2}\s*-\s*(?:[A-Za-z]+\s*)?(\d{1,2})/);
  if (range) {
    const month = text.match(/[A-Za-z]+/)?.[0];
    const date = new Date(`${month} ${range[2]}, ${year}`);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const exact = new Date(/\d{4}/.test(text) ? text : `${text}, ${year}`);
  return Number.isNaN(exact.getTime()) ? null : exact;
}

function parseCollectionWorkbook(collectionPath = chooseCollectionPath()) {
  const workbook = xlsx.readFile(collectionPath, { cellFormula: true, cellDates: false });
  const rowsByLoanKey = new Map();
  const sheetSummaries = [];
  const formulaSamples = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: true, blankrows: false });
    const headerRowIndex = findHeaderRow(rows);
    const sheetDate = extractSheetDate(sheetName, rows);
    const sheetGroup = extractGroupFromSheetName(sheetName, rows);

    for (const [address, cell] of Object.entries(worksheet)) {
      if (address[0] !== '!' && cell.f && formulaSamples.length < 100) {
        formulaSamples.push({ sheetName, address, formula: cell.f, value: cell.v });
      }
    }

    if (headerRowIndex === -1) {
      sheetSummaries.push({ sheetName, parsed: false, reason: 'No borrower header row found', rowCount: rows.length });
      continue;
    }

    const headers = rows[headerRowIndex] || [];
    const subHeaders = rows[headerRowIndex + 1] || [];
    const indexes = {
      name: headerIndex(headers, /name of borrower|name of client/i),
      memberId: headerIndex(headers, /id no/i),
      address: headerIndex(headers, /address/i),
      principal: headerIndex(headers, /loan amount/i),
      releaseDate: headerIndex(headers, /release date/i),
      maturityDate: headerIndex(headers, /maturity date/i),
      cycle: headerIndex(headers, /cycle/i),
      weeks: headerIndex(headers, /^no\.? of weeks$/i),
      weeksPaid: headerIndex(headers, /weeks paid/i),
      weeksUnpaid: headerIndex(headers, /weeks unpaid/i),
      schedule: headerIndex(headers, /schedule of payment/i),
      weeklyPayment: headerIndex(headers, /weekly payment/i),
      remarks: headerIndex(headers, /remarks/i),
      totalDue: headerIndex(headers, /total due/i),
    };

    const paymentColumns = [];
    for (let col = 0; col < Math.max(headers.length, subHeaders.length); col += 1) {
      if (col <= indexes.totalDue) continue;
      const date = parseHeaderPaymentDate(subHeaders[col] ?? headers[col], sheetDate);
      if (date) paymentColumns.push({ col, date, label: cleanString(subHeaders[col] ?? headers[col]) });
    }

    let parsedRows = 0;
    for (let rowIndex = headerRowIndex + 2; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] || [];
      const name = cleanString(row[indexes.name]);
      if (!name || /^total$/i.test(name) || /grand total|name of borrower|name of client/i.test(name)) continue;

      const memberId = cleanString(row[indexes.memberId]).toUpperCase();
      const principal = toNumber(row[indexes.principal]);
      const cycle = toNumber(row[indexes.cycle]) || null;
      const releaseDate = toIsoDate(row[indexes.releaseDate]);
      const loanKey = `${memberId || normalizeName(name)}|${cycle || ''}|${releaseDate || ''}|${principal || ''}`;
      const computed = standardWeeklyAmortization(principal);
      const weeklyPayment = toNumber(row[indexes.weeklyPayment]);
      const totalDue = toNumber(row[indexes.totalDue]);
      const weeksUnpaid = toNumber(row[indexes.weeksUnpaid]);
      const payments = [];

      for (const paymentColumn of paymentColumns) {
        const amount = toNumber(row[paymentColumn.col]);
        if (amount > 0) {
          payments.push({
            amount: round2(amount),
            paymentDate: paymentColumn.date.toISOString().slice(0, 10),
            sourceColumn: paymentColumn.label,
            sourceSheet: sheetName,
            sourceRow: rowIndex + 1,
          });
        }
      }

      const base = rowsByLoanKey.get(loanKey) || {
        loanKey,
        memberId,
        borrowerName: name,
        address: cleanString(row[indexes.address]) || null,
        principal,
        releaseDate,
        maturityDate: toIsoDate(row[indexes.maturityDate]),
        cycle,
        scheduleDay: cleanString(row[indexes.schedule]) || null,
        group: sheetGroup,
        observations: [],
        payments: [],
        snapshots: [],
      };

      if (sheetGroup) base.group = sheetGroup;
      base.snapshots.push({
        sheetName,
        sheetDate: sheetDate ? sheetDate.toISOString().slice(0, 10) : null,
        sourceRow: rowIndex + 1,
        weeks: toNumber(row[indexes.weeks]),
        weeksPaid: toNumber(row[indexes.weeksPaid]),
        weeksUnpaid,
        weeklyPayment,
        totalDue,
        remarks: cleanString(row[indexes.remarks]) || null,
      });
      base.payments.push(...payments);

      if (principal > 0 && weeklyPayment > 0 && Math.abs(weeklyPayment - computed.weeklyPayment) > 1) {
        base.observations.push({
          level: 'warning',
          type: 'weekly_payment_mismatch',
          sheetName,
          sourceRow: rowIndex + 1,
          expected: computed.weeklyPayment,
          actual: weeklyPayment,
          difference: round2(weeklyPayment - computed.weeklyPayment),
        });
      }
      if (weeklyPayment > 0 && weeksUnpaid > 0 && totalDue > 0 && Math.abs(totalDue - weeklyPayment * weeksUnpaid) > 1) {
        base.observations.push({
          level: 'warning',
          type: 'total_due_formula_mismatch',
          sheetName,
          sourceRow: rowIndex + 1,
          expected: round2(weeklyPayment * weeksUnpaid),
          actual: totalDue,
          difference: round2(totalDue - weeklyPayment * weeksUnpaid),
        });
      }

      rowsByLoanKey.set(loanKey, base);
      parsedRows += 1;
    }

    sheetSummaries.push({
      sheetName,
      parsed: true,
      group: sheetGroup,
      sheetDate: sheetDate ? sheetDate.toISOString().slice(0, 10) : null,
      rowCount: rows.length,
      parsedRows,
      paymentColumns: paymentColumns.length,
    });
  }

  return {
    workbookPath: collectionPath,
    sheetCount: workbook.SheetNames.length,
    sheetSummaries,
    formulaSamples,
    collectionLoans: [...rowsByLoanKey.values()],
  };
}

function latestSnapshot(loan) {
  return [...loan.snapshots].sort((a, b) => cleanString(b.sheetDate).localeCompare(cleanString(a.sheetDate)))[0] || {};
}

function buildMigrationPlan({ summary, collection }) {
  const borrowers = new Map(summary.borrowers);

  for (const loan of collection.collectionLoans) {
    const key = loan.memberId || normalizeName(loan.borrowerName);
    if (!borrowers.has(key)) {
      const names = splitName(loan.borrowerName);
      borrowers.set(key, {
        memberId: loan.memberId || null,
        fullName: names.fullName,
        firstName: names.firstName,
        lastName: names.lastName,
        address: loan.address,
        area: loan.address,
        group: loan.group,
        summaryPrincipal: 0,
      });
    }
    const borrower = borrowers.get(key);
    if (!borrower.group && loan.group) borrower.group = loan.group;
    if (!borrower.address && loan.address) borrower.address = loan.address;
    if (!borrower.area && loan.address) borrower.area = loan.address;
  }

  const loansByBorrower = new Map();
  for (const loan of collection.collectionLoans) {
    const key = loan.memberId || normalizeName(loan.borrowerName);
    if (!loansByBorrower.has(key)) loansByBorrower.set(key, []);
    loansByBorrower.get(key).push(loan);
  }

  const migrationBorrowers = [];
  const migrationLoans = [];
  const migrationPayments = [];
  const issues = [];
  let rolloverCount = 0;

  for (const [borrowerKey, borrower] of borrowers.entries()) {
    const borrowerId = `borrower-${stableKey(borrowerKey, borrower.fullName)}`;
    const borrowerLoans = (loansByBorrower.get(borrowerKey) || [])
      .sort((a, b) => cleanString(a.releaseDate).localeCompare(cleanString(b.releaseDate)) || (a.cycle || 0) - (b.cycle || 0));

    migrationBorrowers.push({
      id: borrowerId,
      member_id: borrower.memberId || null,
      full_name: borrower.fullName,
      first_name: borrower.firstName || '',
      last_name: borrower.lastName || '',
      gender: borrower.gender || null,
      date_of_birth: borrower.dateOfBirth || null,
      phone: borrower.phone || null,
      contact_no: borrower.phone || null,
      area: borrower.area || null,
      address: borrower.address || null,
      source_of_income: borrower.sourceOfIncome || null,
      date_joined: borrower.dateJoined || null,
      membership_status: borrower.membershipStatus || null,
      group: borrower.group || null,
      cycle_id: borrower.cycleId || null,
      loan_code: borrower.loanCode || parseLoanCode(borrower.summaryPrincipal),
      collector_name: borrower.collectorAssigned || null,
      loan_count: borrowerLoans.length,
    });

    let previousLoan = null;
    for (let index = 0; index < borrowerLoans.length; index += 1) {
      const sourceLoan = borrowerLoans[index];
      const calc = standardWeeklyAmortization(sourceLoan.principal);
      const snapshot = latestSnapshot(sourceLoan);
      const totalPaidFromColumns = round2(sourceLoan.payments.reduce((sum, payment) => sum + payment.amount, 0));
      const statedBalance = round2(snapshot.totalDue || 0);
      const previousBalance = previousLoan ? Math.max(0, round2(previousLoan.total_amount - previousLoan.total_paid)) : 0;
      const isReloan = Boolean(previousLoan && sourceLoan.cycle && previousLoan.cycle && sourceLoan.cycle > previousLoan.cycle);
      const deductions = standardDeductions(sourceLoan.principal, isReloan ? previousBalance : 0);
      const loanId = `loan-${stableKey(borrowerId, sourceLoan.loanKey)}`;
      const totalPaid = Math.max(0, round2(calc.totalReceivable - statedBalance));

      if (isReloan) {
        rolloverCount += 1;
        previousLoan.status = 'paid';
        if (previousBalance > 0) {
          previousLoan.total_paid = round2(previousLoan.total_paid + previousBalance);
          previousLoan.computed_balance = 0;
          migrationPayments.push({
            id: `payment-${stableKey(previousLoan.id, loanId, 'rollover-clearing')}`,
            loan_id: previousLoan.id,
            borrower_id: borrowerId,
            amount: previousBalance,
            payment_date: sourceLoan.releaseDate || previousLoan.maturity_date || new Date().toISOString().slice(0, 10),
            payment_type: 'rollover',
            notes: `Rollover clearing deducted from ${sourceLoan.releaseDate || 'new loan'} net proceeds`,
          });
        }
      }

      const migrationLoan = {
        id: loanId,
        borrower_id: borrowerId,
        loan_number: `AG-${borrower.memberId || stableKey(borrower.fullName)}-C${sourceLoan.cycle || index + 1}-${sourceLoan.releaseDate || 'NO-DATE'}`,
        loan_type: 'standard',
        principal_amount: sourceLoan.principal,
        interest_rate: STANDARD_INTEREST_RATE,
        interest_type: 'flat',
        interest_amount: calc.totalInterest,
        term: STANDARD_TERM,
        term_unit: 'weeks',
        frequency: 'weekly',
        total_amount: calc.totalReceivable,
        installment_amount: calc.weeklyPayment,
        deposit_amount: round2(calc.weeklySavings * STANDARD_TERM),
        insurance_amount: 0,
        savings_per_payment: calc.weeklySavings,
        deducted_amount: deductions.totalDeductions,
        release_date: sourceLoan.releaseDate,
        maturity_date: sourceLoan.maturityDate,
        status: statedBalance <= 1 || (isReloan && previousLoan) ? 'paid' : 'active',
        is_reloan: isReloan,
        previous_loan_id: isReloan ? previousLoan.id : null,
        cycle: sourceLoan.cycle,
        group: sourceLoan.group || borrower.group || null,
        schedule_day: sourceLoan.scheduleDay,
        total_paid: totalPaid,
        stated_latest_balance: statedBalance,
        computed_balance: Math.max(0, round2(calc.totalReceivable - totalPaid)),
        deductions,
        source_observations: sourceLoan.observations,
        source_snapshot_count: sourceLoan.snapshots.length,
      };

      if (Math.abs(migrationLoan.computed_balance - statedBalance) > calc.weeklyPayment + 1) {
        issues.push({
          level: 'review',
          type: 'balance_reconciliation_gap',
          borrower: borrower.fullName,
          loan_number: migrationLoan.loan_number,
          stated_latest_balance: statedBalance,
          computed_balance_from_payments: migrationLoan.computed_balance,
          total_paid_from_columns: totalPaidFromColumns,
          expected_total_paid_from_balance: totalPaid,
        });
      }
      issues.push(...sourceLoan.observations.map((item) => ({
        borrower: borrower.fullName,
        loan_number: migrationLoan.loan_number,
        ...item,
      })));

      migrationLoans.push(migrationLoan);

      const seenPayments = new Set();
      const uniquePayments = [];
      let realPaymentTotal = 0;
      for (const payment of sourceLoan.payments) {
        const paymentKey = `${payment.paymentDate}|${payment.amount}`;
        if (seenPayments.has(paymentKey)) continue;
        seenPayments.add(paymentKey);
        realPaymentTotal = round2(realPaymentTotal + payment.amount);
        uniquePayments.push({ payment, paymentKey });
      }

      const useDetailedPayments = realPaymentTotal <= totalPaid + 1;
      if (!useDetailedPayments && realPaymentTotal > 0) {
        issues.push({
          level: 'review',
          type: 'payment_column_total_exceeds_expected',
          borrower: borrower.fullName,
          loan_number: migrationLoan.loan_number,
          expected_total_paid_from_balance: totalPaid,
          payment_columns_total: realPaymentTotal,
          source_snapshot_count: sourceLoan.snapshots.length,
        });
      }

      if (useDetailedPayments) {
        for (const { payment, paymentKey } of uniquePayments) {
          migrationPayments.push({
            id: `payment-${stableKey(loanId, paymentKey)}`,
            loan_id: loanId,
            borrower_id: borrowerId,
            amount: payment.amount,
            payment_date: payment.paymentDate,
            payment_type: 'cash',
            notes: `Excel ${payment.sourceSheet} row ${payment.sourceRow} column ${payment.sourceColumn}`,
          });
        }
      } else {
        realPaymentTotal = 0;
      }

      const reconciliationPayment = round2(totalPaid - realPaymentTotal);
      if (reconciliationPayment > 0) {
        migrationPayments.push({
          id: `payment-${stableKey(loanId, 'excel-balance-reconciliation')}`,
          loan_id: loanId,
          borrower_id: borrowerId,
          amount: reconciliationPayment,
          payment_date: snapshot.sheetDate || sourceLoan.releaseDate || new Date().toISOString().slice(0, 10),
          payment_type: 'excel_balance_reconciliation',
          notes: `Excel balance reconciliation: total receivable ${calc.totalReceivable} less latest stated balance ${statedBalance}`,
        });
      }

      previousLoan = migrationLoan;
    }
  }

  const activeByBorrower = new Map();
  for (const loan of migrationLoans.filter((item) => item.status === 'active')) {
    const list = activeByBorrower.get(loan.borrower_id) || [];
    list.push(loan);
    activeByBorrower.set(loan.borrower_id, list);
  }
  for (const list of activeByBorrower.values()) {
    if (list.length > 1) {
      issues.push({
        level: 'review',
        type: 'multiple_active_loans_after_rollover_mapping',
        borrower_id: list[0].borrower_id,
        loan_numbers: list.map((loan) => loan.loan_number),
      });
    }
  }

  const summaryStats = {
    sourceSummaryPath: summary.workbookPath,
    sourceCollectionPath: collection.workbookPath,
    sourceCollectionSheets: collection.sheetCount,
    parsedSheets: collection.sheetSummaries.filter((sheet) => sheet.parsed).length,
    borrowers: migrationBorrowers.length,
    borrowersWithLoans: migrationBorrowers.filter((borrower) => borrower.loan_count > 0).length,
    loans: migrationLoans.length,
    payments: migrationPayments.length,
    rollovers: rolloverCount,
    totalPrincipal: round2(migrationLoans.reduce((sum, loan) => sum + loan.principal_amount, 0)),
    totalInterest: round2(migrationLoans.reduce((sum, loan) => sum + loan.interest_amount, 0)),
    totalSavings: round2(migrationLoans.reduce((sum, loan) => sum + loan.deposit_amount, 0)),
    totalReceivable: round2(migrationLoans.reduce((sum, loan) => sum + loan.total_amount, 0)),
    totalStatedBalance: round2(migrationLoans.reduce((sum, loan) => sum + loan.stated_latest_balance, 0)),
    issueCount: issues.length,
  };

  return {
    generatedAt: new Date().toISOString(),
    businessRules: {
      standardInterest: 'Principal x 20% flat',
      weeklyAmortization: 'Principal/20 + total interest/20 + principal*1% savings + PHP 10 LPF',
      totalReceivable: 'weekly amortization x 20',
      deductions: 'ARF 2% + CPF 4% + MEM 100 + LHF 100 + RSF 60 + Doc Stamp 45 + previous balance for reloans',
      netProceeds: 'Principal - deductions',
    },
    summary: summaryStats,
    sheetSummaries: collection.sheetSummaries,
    formulaSamples: collection.formulaSamples,
    borrowers: migrationBorrowers,
    loans: migrationLoans,
    payments: migrationPayments,
    issues,
  };
}

function createPlan(options = {}) {
  const summary = parseSummaryWorkbook(options.summaryPath || DEFAULT_SUMMARY_PATH);
  const collection = parseCollectionWorkbook(options.collectionPath || chooseCollectionPath());
  return buildMigrationPlan({ summary, collection });
}

module.exports = {
  DEFAULT_SUMMARY_PATH,
  DOWNLOAD_COLLECTION_PATH,
  REPO_COLLECTION_PATH,
  STANDARD_INTEREST_RATE,
  STANDARD_TERM,
  SAVINGS_RATE_PER_PAYMENT,
  LPF_PER_PAYMENT,
  buildMigrationPlan,
  chooseCollectionPath,
  cleanString,
  createPlan,
  excelDateToJSDate,
  normalizeName,
  parseCollectionWorkbook,
  parseSummaryWorkbook,
  round2,
  splitName,
  standardDeductions,
  standardWeeklyAmortization,
  toIsoDate,
  toNumber,
};
