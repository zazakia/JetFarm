# POS Cursor Cooperative (SCSCC)
## Member Manual & Business Rules

This manual documents the updated business rules, policies, computations, and member benefits implemented in the POS Cursor Management System.

---

## 1. Capital Build-Up (CBU) & Share Capital
Each member contributes to the cooperative's equity pool via Share Capital (Capital Build-Up).

### 1.1 Computations & Values
*   **Share Value**: ₱100.00 per share.
*   **Minimum Shares for Petty Cash Loan**: 10 shares (₱1,000.00 paid-up amount).
*   **Minimum Maintaining Balance for Dividends**: Only active regular members with recorded paid-up share capital are included in the annual distribution.

---

## 2. Net Income & Member Benefits Allocation
At the end of each fiscal year, the cooperative's Net Income is split into statutory reserve funds and member distributions as mandated by R.A. 9520 (Philippine Cooperative Code).

### 2.1 Statutory Reserves Allocation
*   **General Reserve Fund**: **10%** of Net Income. Used for buffer against operational losses.
*   **Cooperative Education and Training Fund (CETF)**: **10%** of Net Income.
*   **Community Development Fund (CDF)**: **3%** of Net Income.
*   **Optional Fund**: **7%** of Net Income.
*   **Net Surplus for Member Distribution**: **70%** of Net Income.

### 2.2 Member Benefits Pool (Split of the 70% Net Surplus)
*   **Interest on Share Capital (ISC)**: **70%** of the Net Surplus distribution pool. Distributed proportionally to members based on their paid-up share capital.
    $$\text{Member ISC} = \text{Member Paid-up Share Capital} \times \left( \frac{\text{Total ISC Pool}}{\text{Total Cooperative Paid-up Share Capital}} \right)$$
*   **Patronage Refund (PR)**: **30%** of the Net Surplus distribution pool. Distributed as a benefit. By default, it is allocated using a simple equal-share method or proportional to interest paid.

### 2.3 General Assembly (GA) Attendance Penalty
*   **Absentee Rule**: Regular members are expected to attend the Annual General Assembly (Annual GA).
*   **Penalty**: If a member is **absent** from the Annual GA without a valid written reason approved by the Board of Directors (BOD), their **entire Patronage Refund (PR) for that year is plowed back (converted) to their CBU / Share Capital** instead of being paid out in cash.

---

## 3. Cooperative Savings Program
Members can deposit and withdraw savings through the cooperative's savings program.

### 3.1 Savings Policies
*   **Annual Interest Rate**: **4.0% per annum** (compounded/calculated quarterly).
*   **Minimum Maintaining Balance to Earn Interest**: **₱100.00**.
*   **Calculation Method**:
    1.  **Average Daily Balance (ADB)** is calculated for each month:
        $$\text{ADB} = \frac{\sum \text{Daily Balances in the Month}}{\text{Days in the Month}}$$
    2.  **Average Quarterly Balance** is the average ADB of the 3 months in that quarter:
        $$\text{Quarterly AMB} = \frac{\text{ADB}_{\text{Month 1}} + \text{ADB}_{\text{Month 2}} + \text{ADB}_{\text{Month 3}}}{3}$$
    3.  If Quarterly AMB $\ge$ ₱100.00, the interest is calculated as:
        $$\text{Quarterly Interest} = \text{Quarterly AMB} \times \left( \frac{4.0\%}{4} \right)$$

---

## 4. Lending Policies & Loan Calculator
The cooperative provides financial assistance under strict risk-management parameters.

### 4.1 General Constraints
*   **One Member, One Loan Policy**: A member is strictly limited to **one (1) active loan** at a time. A new loan application (reloan/renewal) automatically requires settling and closing the previous outstanding balance.
*   **Delinquency Restriction**: Members with delinquent accounts have all lending privileges frozen.

### 4.2 Loan Categories & Limits
*   **Petty Cash Loans**:
    *   **Limit**: Maximum of **75%** of the member's paid-up share capital (CBU).
    *   **Requirement**: Minimum of 10 shares (₱1,000.00).
*   **Standard Coop Loans (Livelihood / Salary / Emergency)**:
    *   **Limit**: Fixed maximum of **₱5,000.00**.
    *   Subject to full Credit Investigation (CI) and BOD approval.

### 4.3 Deductions & Charges (Standard Breakdown)
For every loan release, standard administrative and risk deductions are automatically applied to the principal:
*   **Association Reserve Fund (ARF)**: **2%** of principal.
*   **Cooperative Project Fund / CBU (CPF)**: **4%** of principal.
*   **Membership Fee (MEM)**: **₱100.00** (for new registrants).
*   **Loan Handling Fee / Mutual Fund (LHF)**: **₱100.00**.
*   **Risk Share Fund (RSF)**: **₱60.00**.
*   **Documentary Stamp Tax (DST)**:
    *   Flat **₱45.00** for standard loans.
    *   Calculated at **0.75%** of principal for institutional calculations.
*   **Processing Fee**: Defaults to **3%** of principal.
*   **Notarial Fee**: Defaults to **₱300.00**.

### 4.4 Repayment & Skip-Sunday Rule
*   First payment is scheduled for the day immediately following the release date.
*   The system automatically skips **Sundays** when generating daily or weekly repayment schedules.

---

## 5. Standard Double-Entry Account Coding (CDA Aligned)
All transaction postings are automatically routed to the cooperative's General Ledger:
*   `1010` - Cash on Hand
*   `1020` - Cash in Bank
*   `1100` - Loans Receivable
*   `2010` - Savings Deposits Payable
*   `3010` - Share Capital
*   `4010` - Interest on Loans (Income)
*   `4020` - Service Charges
*   `4030` - Membership Fees
*   `4040` - Penalties & Fines
*   `4060` - Other Income
*   `5xxx` - Operating Expenses (Salaries, Office Expenses, Travel, etc.)
