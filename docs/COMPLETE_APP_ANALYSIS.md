# POSCursor Application - Complete Architecture & Design Analysis

**Last Updated:** March 20, 2026  
**Application Version:** 1.0.0  
**Target Platforms:** iOS, Android, Web

---

## 📋 TABLE OF CONTENTS

1. [Project Overview](#project-overview)
2. [Architecture Principles](#architecture-principles)
3. [Technology Stack](#technology-stack)
4. [Data Model & Database](#data-model--database)
5. [Application Structure](#application-structure)
6. [Core Services & Business Logic](#core-services--business-logic)
7. [Data Flow & Synchronization](#data-flow--synchronization)
8. [Security & Encryption](#security--encryption)
9. [User Roles & Access Control](#user-roles--access-control)
10. [UI/UX Architecture](#uiux-architecture)
11. [State Management](#state-management)
12. [Testing Strategy](#testing-strategy)
13. [Deployment & Configuration](#deployment--configuration)

---

## 1. PROJECT OVERVIEW

### What is POSCursor?

POSCursor is a **mobile-first microfinance management application** designed for loan officers, collectors, and administrators in microfinance institutions (MFIs). The app enables field teams to:

- **Manage Loan Portfolios**: Create, track, and monitor loans
- **Collect Payments**: Record payments even in offline mode
- **Track Borrower Information**: Maintain secure borrower profiles
- **Generate Financial Reports**: Calculate KPIs and performance metrics
- **Manage Cash Flow**: Track remittances (cash handover from collectors to office)
- **Operate Offline**: Full functionality without internet connectivity

### Key Features

| Feature | Purpose |
|---------|---------|
| **Offline-First** | Collectors work in areas without reliable internet |
| **Role-Based Access** | Different UIs for Admin, Collectors, Encoders |
| **Encryption** | PII data protected at rest on device |
| **Bidirectional Sync** | Local changes sync with cloud database |
| **Financial KPIs** | Automated calculation of Portfolio At Risk, OSS, etc. |
| **Audit Trail** | Remittance tracking from collection to deposit |
| **PDF Reports** | Generate and share financial statements |

---

## 2. ARCHITECTURE PRINCIPLES

### 2.1 Domain-Driven Design (DDD)

The application organizes code around **business domains** rather than technical layers:

```
┌─────────────────────────────────────┐
│   User Interface Layer (React)      │
├─────────────────────────────────────┤
│   Application Services Layer        │ (Orchestration)
│   - SyncService                     │
│   - AuthService                     │
│   - ErrorService                    │
├─────────────────────────────────────┤
│   Domain Services Layer             │ (Business Logic)
│   - MfiKpiService                   │
│   - EncryptionService               │
│   - CashService                     │
│   - LoanCalculatorService           │
├─────────────────────────────────────┤
│   Domain Models (WatermelonDB)      │ (Core Business Entities)
│   - Loan, Borrower, Payment         │
│   - Remittance, PaymentSchedule     │
├─────────────────────────────────────┤
│   Data Access Layer (WatermelonDB)  │ (Persistence)
│   - SQLite (Local)                  │
│   - Supabase (Cloud)                │
└─────────────────────────────────────┘
```

**Benefit**: Business logic is isolated and testable; schema changes don't affect service logic.

### 2.2 SOLID Principles Applied

| Principle | Implementation |
|-----------|-----------------|
| **S - Single Responsibility** | Each service has one job: `SyncService` only syncs, `EncryptionService` only encrypts |
| **O - Open/Closed** | New role types can be added without modifying existing role logic |
| **L - Liskov Substitution** | All database models follow WatermelonDB Model interface |
| **I - Interface Segregation** | Services expose minimal, focused APIs |
| **D - Dependency Inversion** | Database and Supabase client injected via unified exports |

### 2.3 Offline-First Architecture

```
User Action (offline)
    ↓
[Local SQLite DB] ← Immediate Write
    ↓
[App Works Normally]
    ↓
[Internet Available?]
    ├─ YES → SyncService triggers bidirectional sync
    │         - Pull: Server changes merge locally
    │         - Push: Local changes sent to server
    │
    └─ NO → User notified (OfflineBanner component)
             App continues working with local data
```

**Why Offline-First?**
- Field collectors in rural areas often lose connectivity
- Data is never lost—it queues locally and syncs when online
- No need to force users to restart or reload

---

## 3. TECHNOLOGY STACK

### Frontend Framework
- **Expo SDK 55** - Cross-platform React Native framework
- **React Native 0.83** - Core UI framework
- **Expo Router 55** - File-based routing (similar to Next.js)
- **NativeWind 4** - Tailwind CSS for React Native

### Database
- **WatermelonDB 0.25** - Offline-first SQLite ORM
- **SQLite** - Local database (via Expo SQLite adapter)
- **LokiJS** - In-memory DB for web platform

### Backend
- **Supabase** - PostgreSQL + Auth + Real-time APIs
- **Supabase Auth** - Email/password authentication
- **Supabase REST API** - For data synchronization

### State Management
- **Zustand 5.0** - Lightweight store management
  - `authStore` - User session state
  - `syncStore` - Sync progress and logs

### Form Handling & Validation
- **React Hook Form 7.71** - Performant form management
- **Zod 4.3** - Schema validation

### UI Components
- **React Native Paper** - Material Design components
- **Expo Vector Icons** - Icon library
- **React Native Chart Kit** - Financial charts
- **React Native Toast** - Notifications

### Security & Utilities
- **expo-crypto** - SHA-256 hashing
- **bcryptjs** - Password hashing (backend)
- **date-fns** - Date manipulation
- **react-native-uuid** - UUID generation

### Development & Testing
- **Jest** - Unit testing framework
- **@testing-library/react-native** - Component testing
- **TypeScript** - Type safety
- **ESLint & Prettier** - Code quality

---

## 4. DATA MODEL & DATABASE

### 4.1 Database Schema

The database consists of **12 core tables** with soft-delete support:

#### User & Access
```
┌─────────────────────┐
│  user_profiles      │
├─────────────────────┤
│ id (auth_id)        │
│ full_name           │
│ email               │
│ role                │ ← admin, collector, loan_encoder, etc.
│ is_active           │
│ created_at          │
│ updated_at          │
│ deleted_at          │ ← Soft delete
└─────────────────────┘
```

#### Borrower Management
```
┌─────────────────────────────────────┐
│  borrowers                          │
├─────────────────────────────────────┤
│ id                                  │
│ full_name                           │
│ address (ENCRYPTED)                 │ ← PII
│ phone (ENCRYPTED)                   │ ← PII
│ area                                │ ← For route filtering
│ route_index                         │ ← Route sorting
│ date_of_birth                       │
│ gender                              │
│ latitude, longitude                 │ ← GPS coordinates
│ collector_id (FK)                   │ ← Assigned to collector
│ created_by                          │
│ created_at, updated_at, deleted_at  │
└─────────────────────────────────────┘
     ├─ Has many: Loans
     └─ Has many: CashTransactions
```

#### Loan Management
```
┌──────────────────────────────────────┐
│  loans                               │
├──────────────────────────────────────┤
│ id                                   │
│ borrower_id (FK)                     │
│ loan_number                          │ ← Unique identifier
│ principal_amount                     │ ← Principal lent
│ interest_rate                        │ ← %
│ interest_type                        │ ← flat, declining
│ term                                 │ ← Duration
│ term_unit                            │ ← months, weeks
│ frequency                            │ ← weekly, biweekly
│ total_amount                         │ ← Principal + Interest
│ installment_amount                   │ ← Per payment
│ deposit_amount (optional)            │ ← Security deposit
│ insurance_amount (optional)          │ ← Insurance fee
│ release_date                         │
│ first_payment_date                   │
│ maturity_date                        │
│ status                               │ ← pending, active, closed, defaulted
│ is_reloan                            │ ← Follow-up loan flag
│ previous_loan_id (optional FK)       │ ← Link to prior loan
│ encoder_id                           │ ← Created by
│ collector_id (FK)                    │
│ created_at, updated_at, deleted_at   │
└──────────────────────────────────────┘
     ├─ Has many: Payments
     └─ Has many: PaymentSchedules
```

#### Payment Tracking
```
┌────────────────────────────────┐    ┌─────────────────────────┐
│  payment_schedules             │    │  payments               │
├────────────────────────────────┤    ├─────────────────────────┤
│ id                             │    │ id                      │
│ loan_id (FK, indexed)          │    │ loan_id (FK, indexed)   │
│ due_date                       │    │ schedule_id (optional)  │
│ scheduled_amount               │    │ amount                  │
│ status                         │    │ payment_date            │
│ ├─ pending                     │    │ receipt_number          │
│ ├─ partial                     │    │ collector_id            │
│ ├─ paid                        │    │ notes                   │
│ └─ late                        │    │ encoded_at              │
│ created_at, updated_at         │    │ created_at, updated_at  │
└────────────────────────────────┘    └─────────────────────────┘
```

#### Cash & Financial Tracking
```
┌────────────────────────────────┐    ┌──────────────────────────┐
│  remittances                   │    │  cash_transactions       │
├────────────────────────────────┤    ├──────────────────────────┤
│ id                             │    │ id                       │
│ collector_id (FK)              │    │ transaction_date         │
│ amount                         │    │ particulars              │
│ remittance_date                │    │ type: INCOME/EXPENSE     │
│ status                         │    │ amount                   │
│ ├─ pending                     │    │ remarks                  │
│ ├─ approved (finalized)        │    │ recorded_by              │
│ └─ rejected                    │    │ created_at, updated_at   │
│ approved_by                    │    └──────────────────────────┘
│ notes                          │
│ created_at, updated_at         │    ┌──────────────────────────┐
└────────────────────────────────┘    │  expenses                │
                                      ├──────────────────────────┤
                                      │ id                       │
                                      │ category (e.g., "Admin") │
                                      │ description              │
                                      │ amount                   │
                                      │ expense_date             │
                                      │ encoded_by               │
                                      │ created_at, updated_at   │
                                      └──────────────────────────┘
```

#### Banking & Financial Snapshots
```
┌──────────────────────────────┐    ┌──────────────────────────┐
│  bank_accounts               │    │  bank_transactions       │
├──────────────────────────────┤    ├──────────────────────────┤
│ id                           │    │ id                       │
│ bank_name                    │    │ bank_account_id (FK)     │
│ account_name                 │    │ transaction_date         │
│ account_number               │    │ type: DEBIT/CREDIT       │
│ starting_balance             │    │ amount                   │
│ created_at, updated_at       │    │ particulars              │
└──────────────────────────────┘    │ created_at, updated_at   │
                                     └──────────────────────────┘

┌────────────────────────────────────┐
│  financial_snapshots               │
├────────────────────────────────────┤
│ id                                 │
│ snapshot_date                      │ ← Point-in-time KPIs
│ total_assets                       │
│ total_equity                       │
│ total_revenue                      │
│ par (Portfolio At Risk)            │
│ oss (Operating Self-Sufficiency)   │
│ created_at, updated_at             │
└────────────────────────────────────┘
```

#### Operations
```
┌────────────────────────────────┐
│  collection_logs               │
├────────────────────────────────┤
│ id                             │
│ collector_id (FK, indexed)     │
│ log_date                       │
│ total_collected (sum)          │
│ cash_on_hand_start             │
│ cash_on_hand_end               │
│ notes                          │
│ created_at, updated_at         │
└────────────────────────────────┘
```

### 4.2 Entity Relationships

```
┌─────────────────┐
│  UserProfile    │ (Admin/Encoder/Collector)
└────────┬────────┘
         │ manages
         │
    ┌────▼─────────────────┐
    │   Borrower           │
    │   • Full Name        │
    │   • Address (enc)    │
    │   • Phone (enc)      │
    └────┬─────────────────┘
         │ applies for
         │
    ┌────▼──────────────────┐
    │   Loan                │ (Principal + Interest)
    │   • Status: pending   │ → active → closed
    │   • Principal Amount  │
    │   • Interest Rate     │
    │   • Maturity Date     │
    └────┬──────────────────┘
         │ requires
         │
    ┌────▼──────────────────────────┐
    │   PaymentSchedule              │ (One schedule per loan)
    │   • Due Dates (multiple)       │
    │   • Scheduled Amount           │
    │   • Status: pending|paid|late  │
    └────┬──────────────────────────┘
         │ fulfilled by
         │
    └────▼──────────────────┐
         │   Payment         │ (Actual payment received)
         │   • Amount Paid   │
         │   • Date Paid     │
         │   • Collector ID  │
         └───────────────────┘

┌─────────────────────┐
│   Remittance        │ (Cash Handover)
│   • Collector ID    │
│   • Amount          │
│   • Status: pending │ → approved
│   • Approved By     │
└─────────────────────┘
```

### 4.3 Key Constraints & Rules

| Rule | Enforcement |
|------|-------------|
| **Soft Deletes** | All records have `deleted_at` column; filtering excludes null checks |
| **Immutability** | Once a payment is recorded, it cannot be modified (only deleted) |
| **Encryption** | `Borrower.address` and `Borrower.phone` automatically encrypted/decrypted |
| **Indexing** | Foreign keys like `loan_id`, `collector_id`, `bank_account_id` indexed for fast queries |
| **Sync Tracking** | WatermelonDB tracks `_status` field: `created`, `updated`, `deleted` |

---

## 5. APPLICATION STRUCTURE

### 5.1 Folder Organization

```
jetfarm-local/
├── app/                          # Expo Router screens (file-based routing)
│   ├── _layout.tsx              # Root layout with AuthProvider
│   ├── loading.tsx              # Startup/sync screen
│   ├── login.tsx                # Authentication
│   ├── index.tsx                # Home redirect
│   ├── sync-center.tsx          # Sync management modal
│   │
│   ├── (admin)/                 # Admin role screens
│   │   ├── _layout.tsx
│   │   ├── index.tsx            # Dashboard
│   │   ├── borrowers/           # Borrower management
│   │   ├── loans/               # Loan management
│   │   ├── payments/            # Payment tracking
│   │   ├── expenses/            # Expense management
│   │   ├── bank-accounts/       # Bank account tracking
│   │   └── reports/             # Financial reports
│   │
│   ├── (collector)/             # Collector role screens
│   │   ├── _layout.tsx
│   │   ├── index.tsx            # Collector dashboard
│   │   ├── collection-sheet.tsx # Daily collection form
│   │   ├── borrowers/           # Borrower list & details
│   │   ├── remittances.tsx      # Remittance management
│   │   └── help.tsx             # Field guide
│   │
│   ├── (loan-encoder)/          # Loan encoder screens
│   │   └── ...
│   │
│   ├── (payment-encoder)/       # Payment encoder screens
│   │   └── ...
│   │
│   ├── (expenses-encoder)/      # Expense encoder screens
│   │   └── ...
│   │
│   └── __tests__/               # Integration tests
│
├── src/
│   ├── components/              # Reusable UI components
│   │   ├── AppToast.tsx         # Toast notifications
│   │   ├── ErrorBoundary.tsx    # Error handling wrapper
│   │   ├── StatCard.tsx         # KPI stat card
│   │   ├── MetricBreakdownDialog.tsx
│   │   ├── OfflineBanner.tsx    # Offline indicator
│   │   ├── SyncStatusIndicator.tsx
│   │   ├── PhpCurrencyText.tsx  # Currency formatting
│   │   ├── BorrowerSelector.tsx # Dropdown component
│   │   ├── SearchBar.tsx        # Search input
│   │   └── __tests__/
│   │
│   ├── constants/               # Global constants
│   │   ├── roles.ts             # ROLES: admin, collector, etc.
│   │   └── colors.ts            # Theme colors
│   │
│   ├── database/                # WatermelonDB setup
│   │   ├── index.ts             # Database initialization
│   │   ├── schema.ts            # Table definitions
│   │   ├── supabase.ts          # Supabase client
│   │   ├── sync.ts              # Low-level sync utilities
│   │   ├── models/              # Domain entities
│   │   │   ├── Borrower.ts
│   │   │   ├── Loan.ts
│   │   │   ├── Payment.ts
│   │   │   ├── PaymentSchedule.ts
│   │   │   ├── Remittance.ts
│   │   │   ├── Expense.ts
│   │   │   ├── CashTransaction.ts
│   │   │   ├── BankAccount.ts
│   │   │   ├── BankTransaction.ts
│   │   │   ├── CollectionLog.ts
│   │   │   ├── FinancialSnapshot.ts
│   │   │   ├── UserProfile.ts
│   │   │   └── __tests__/
│   │   └── __tests__/           # DB integration tests
│   │
│   ├── services/                # Business logic layer
│   │   ├── AuthService.ts       # Authentication
│   │   ├── SyncService.ts       # Data synchronization (★ 300+ lines)
│   │   ├── EncryptionService.ts # PII encryption/decryption
│   │   ├── ErrorService.ts      # Centralized error handling
│   │   ├── MfiKpiService.ts     # Financial calculations (PAR, OSS, etc.)
│   │   ├── LoanCalculatorService.ts  # Loan math operations
│   │   ├── CashService.ts       # Cash/remittance logic
│   │   ├── PdfGenerator.ts      # PDF report generation
│   │   ├── ReminderService.ts   # Notifications & reminders
│   │   └── __tests__/           # Service unit tests
│   │
│   ├── stores/                  # Zustand state management
│   │   ├── authStore.ts         # Auth state
│   │   ├── syncStore.ts         # Sync progress & logs
│   │   └── __tests__/
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useNetworkStatus.ts  # Detect online/offline
│   │   ├── useTheme.ts          # Theme switching
│   │   └── ... (other hooks)
│   │
│   ├── utils/                   # Utility functions
│   │   ├── currencyFormatter.ts
│   │   ├── dateFormatter.ts
│   │   ├── validators.ts        # Form validation
│   │   ├── errorFormatter.ts
│   │   └── __tests__/
│   │
│   └── store/                   # Context API (for AuthContext)
│       └── AuthContext.tsx      # Auth provider
│
├── package.json                 # Dependencies
├── app.json                     # Expo config
├── eas.json                     # EAS Build config
├── babel.config.js              # Babel configuration
├── metro.config.js              # Metro bundler config
├── jest.config.js               # Jest configuration
├── tsconfig.json                # TypeScript config
├── tailwind.config.js           # Tailwind configuration
├── global.css                   # Global styles
│
├── ARCHITECTURE.md              # Architecture overview
├── DOCUMENTATION.md             # Developer guide
├── DEPLOYMENT.md                # Deployment instructions
└── README.md                    # Project README
```

### 5.2 File Size & Complexity

```
Core Services:
├── SyncService.ts           ~400 lines   (★★★ Most Complex)
├── MfiKpiService.ts         ~150 lines   (★★ Financial Logic)
├── EncryptionService.ts    ~80 lines    (★ Single Responsibility)

Models:
├── Loan.ts                 ~40 lines
├── Borrower.ts             ~45 lines (with decryption getters)
├── Payment.ts              ~30 lines

Key Screens:
├── (admin)/index.tsx       ~200 lines   (Dashboard)
├── (collector)/collection-sheet.tsx  ~300 lines   (Main form)
└── (collector)/remittances.tsx       ~150 lines
```

---

## 6. CORE SERVICES & BUSINESS LOGIC

### 6.1 AuthService - Authentication & Authorization

**Responsibility**: Manage user login/logout and role determination

```typescript
// Location: src/services/AuthService.ts

Key Methods:
├── signIn(email, password)           // Supabase email/password auth
├── signOut()                         // Clear session & reset local DB
├── getCurrentUserRole(uid)           // Get user's role
│   ├─ Checks hardcoded test users
│   ├─ Falls back to user_profiles table
│   └─ Returns: 'admin' | 'collector' | 'loan_encoder' | etc.
└── verifyUserExists()                // Confirm user in user_profiles

Valid Roles:
├── admin              - Full system access
├── collector          - Collect payments, manage remittances
├── loan_encoder       - Create & update loans
├── payment_encoder    - Record payments
└── expenses_encoder   - Record expenses
```

**Flow**:
```
User enters email/password (login.tsx)
    ↓
AuthService.signIn() → Supabase Auth
    ↓
✓ Success → Fetch user role
    ↓
Store user + role in authStore (Zustand)
    ↓
AuthProvider routes to role-specific screen
    ✗ Failure → Show error toast
```

### 6.2 SyncService - Data Synchronization (★★★ CRITICAL)

**Responsibility**: Keep local offline data in sync with Supabase

**Architecture**: Uses WatermelonDB's `synchronize()` helper with pull/push phases

#### Pull Phase (Server → Local)
```
For each table: borrowers, loans, payments, expenses, ...
1. Query Supabase: "What changed since last_pulled_at?"
2. Supabase returns: { created: [...], updated: [...], deleted: [...] }
3. WatermelonDB merges into local SQLite
4. Soft deletes: Records with deleted_at timestamp marked as deleted
5. Track: last_pulled_at timestamp updates
```

#### Push Phase (Local → Server)
```
For each table:
1. Find all records where _status = 'created' | 'updated' | 'deleted'
2. Batch records (e.g., 50 per request for performance)
3. Call Supabase upsert endpoint
4. Deleted records: Send with deleted_at = NOW()
5. Mark records as synced (clear _status)
```

**Key Features**:
- **Incremental**: Only pulls changes since last sync (via `updated_at` timestamp)
- **Batching**: Prevents hitting API rate limits
- **Error Recovery**: If sync fails mid-table, resumes from that table
- **Progress Tracking**: UI shows which table is currently syncing

**Progress UI State** (stored in `syncStore`):
```typescript
{
  status: 'idle' | 'syncing' | 'error',
  progress: 0-100,
  currentModel: 'Borrowers', 'Loans', etc.,
  pendingChanges: number,
  errorMessage: string | null,
  logs: [{timestamp, type, message}, ...]
}
```

### 6.3 EncryptionService - Data Protection

**Responsibility**: Encrypt sensitive PII before storage, decrypt on access

```typescript
// Location: src/services/EncryptionService.ts

Encrypted Fields:
├── Borrower.address
├── Borrower.phone
└── (Extensible for other sensitive fields)

Encryption Method:
├── Algorithm: XOR + Base64 encoding (fast for mobile)
├── Key: APP_SECRET = 'POSCursor_Sec_2024_Ph' (hardcoded demo)
├── Storage: Prefixed with 'enc:' to distinguish from plaintext
└── Note: Production should use expo-secure-store for key management

Methods:
├── encrypt(text)                        // Returns 'enc:base64_encoded'
├── decrypt(encryptedText)               // Returns plaintext
└── hash(text) → Promise<sha256>         // For consistency checks
```

**Automatic Usage in Models**:
```typescript
// When accessing from Borrower model:
const borrower = await borrowersCollection.find(id);
borrower.phone           // Returns: 'enc:ABCD1234...'
borrower.decryptedPhone  // Returns: '+639191234567' (auto-decrypted)
```

### 6.4 MfiKpiService - Financial Calculations

**Responsibility**: Calculate microfinance industry-standard KPIs

#### Key Metrics

```typescript
// Portfolio At Risk (PAR)
// = Outstanding principal of loans with payments > 30 days overdue
// Industry baseline: 1-3% is healthy
PAR = (Overdue Principal / Total Portfolio) * 100

Example:
├─ Total Active Loans: ₱100,000
├─ Overdue > 30 days: ₱5,000
└─ PAR = 5% ← Red flag if > 10%

// Gross Loan Portfolio (GLP)
GLP = Sum of all active loan principal amounts
Purpose: Measure portfolio size and growth

// Collection Efficiency
Efficiency = (Total Collected / Total Due) * 100
Example: if due ₱50,000 but only ₱45,000 collected = 90%

// Operating Self-Sufficiency (OSS)
OSS = Operating Revenue / (Operating Expenses + Financial Costs + Provisions) * 100
├─ > 100% = Sustainable (generating more than costs)
├─ 80-100% = Near-sustainable
└─ < 80% = Subsidy-dependent

// Financial Self-Sufficiency (FSS)
// Similar to OSS but adjusts for inflation & subsidies

// Return on Assets (ROA)
ROA = (Net Income / Total Assets) * 100
Purpose: How efficiently assets generate profit

// Return on Equity (ROE)
ROE = (Net Income / Total Equity) * 100
Purpose: How well equity generates returns
```

**Usage**:
```typescript
const kpis = {
  par: MfiKpiService.computePAR(loans, schedules, payments, 30),
  glp: MfiKpiService.computeGLP(loans),
  efficiency: MfiKpiService.computeCollectionEfficiency(collected, due),
  oss: MfiKpiService.computeOSS(revenue, expenses, costs, provisions)
};
```

### 6.5 ErrorService - Centralized Error Handling

**Responsibility**: Catch, categorize, and log errors consistently

```typescript
// Location: src/services/ErrorService.ts

ErrorTypes:
├── AUTH           - Authentication/authorization failures
├── NETWORK        - Connectivity issues
├── VALIDATION     - Form/input validation errors
├── DATABASE       - WatermelonDB errors
├── SYNC           - Synchronization failures
├── UNKNOWN        - Unclassified errors

Methods:
├── handleError(error, context, type)  // Returns structured error
├── log(message, context, level)       // Track in app logs
└── report(error)                      // Send to analytics (optional)

Usage:
try {
  await borrower.update({ fullName: 'John' });
} catch (error) {
  throw ErrorService.handleError(error, 'BorrowerUpdate', ErrorType.DATABASE);
}
```

### 6.6 LoanCalculatorService - Loan Mathematics

**Responsibility**: Calculate installment amounts, schedules, and interest

```typescript
// Key Calculations:
├── calculateInstallment(principal, rate, term, frequency)
│   └─ E.g., ₱10,000 at 10% for 6 months weekly = ₱416.67/week
│
├── generatePaymentSchedule(loan)
│   └─ Creates PaymentSchedule records with due dates
│
├── calculateBalanceOutstanding(loan, paymentsToDate)
│   └─ Returns remaining principal to pay
│
└── determineInterestMethod(type)
    ├─ 'flat'     - Same interest every period
    └─ 'declining' - Interest decreases as principal paid
```

### 6.7 CashService - Remittance & Cash Management

**Responsibility**: Handle collector cash handovers and remittance tracking

```typescript
// Key Methods:
├── createRemittance(collectorId, amount, date)
│   └─ Creates remittance with status = 'pending'
│
├── approveRemittance(remittanceId, approvedBy)
│   └─ Admin approves → status = 'approved'
│
├── rejectRemittance(remittanceId, reason)
│   └─ Admin rejects → status = 'rejected'
│
└── getCollectorCashBalance(collectorId)
    └─ Returns uncommitted cash
```

**Audit Trail** (why remittances matter):
```
Collector collects ₱5,000
    ↓
Records as local payment → stored in device
    ↓
Submits remittance form "Hand over ₱5,000"
    ↓
Admin sees pending remittance → approves
    ↓
Record updated: remittance.status = 'approved'
    ↓
✓ Complete audit trail from field to office
```

### 6.8 PdfGenerator - Report Generation

**Responsibility**: Generate shareable PDF reports

```typescript
// Supported Reports:
├── loanPortfolioReport()         // Summary of all loans
├── collectorPerformanceReport()  // Per-collector stats
├── financialSnapshot()           // KPIs at a point in time
└── borrowerStatement()           // Individual borrower history

Usage:
const pdf = await PdfGenerator.generateLoanPortfolioReport(loans, payments);
await Sharing.shareAsync(pdf.uri);  // Share via email/messaging
```

---

## 7. DATA FLOW & SYNCHRONIZATION

### 7.1 Complete User Journey - Payment Collection

```
SCENARIO: Collector in field (no internet) collects ₱500 payment

┌─────────────────────────────────────────────────────────────┐
│ OFFLINE PHASE (Collector has no internet)                  │
└─────────────────────────────────────────────────────────────┘

1. Collector opens app (already synced before leaving office)
   └─ Local SQLite has: borrowers, loans, payment schedules

2. Collector searches borrower "Juan dela Cruz"
   └─ Search queries local SQLite (instant, no network needed)

3. Collector selects payment from due schedule
   └─ App shows: Due ₱500, Overdue 45 days

4. Collector records: "Paid ₱500 on 2024-03-20"
   └─ App creates Payment record locally
   └─ Sets _status = 'created' (pending sync)
   └─ Payment Schedule updated: status = 'paid'
   └─ UI shows: "Payment recorded (pending sync)"
   └─ OfflineBanner displays (yellow indicator)

5. Collector completes collections for the day
   └─ App updates CollectionLog: total_collected = ₱12,500

6. Collector returns to office with phone still offline
   └─ All changes queued in local database
   └─ No data lost

┌─────────────────────────────────────────────────────────────┐
│ SYNC PHASE (Collector connects to WiFi)                     │
└─────────────────────────────────────────────────────────────┘

7. SyncService detects network → Automatically triggers sync
   └─ syncStore.setSyncProgress({ status: 'syncing' })

8. PULL PHASE
   └─ Query Supabase: "What changed since 2024-03-20 08:00?"
   └─ Supabase returns: 
       {
         borrowers: { created: [],  updated: [], deleted: [] },
         loans: { ... },
         payments: { created: [Payment{id:456, admin-entered}], ... }
       }
   └─ Merge into local SQLite
   └─ Update last_pulled_at timestamp

9. PUSH PHASE
   └─ Query local: Find all records where _status = 'created'
   └─ Results:
       {
         payments: [Payment{id:local_uuid, amount:500, ...}],
         payment_schedules: [updated_schedule]
         collection_logs: [updated_log]
       }
   └─ Send batch to Supabase upsert endpoint
   └─ Response: All records now have server IDs
   └─ Mark as synced: _status = undefined

10. Sync Complete
    └─ OfflineBanner disappears (green indicator)
    └─ Toast: "Sync complete: 1 payment synced"
    └─ syncStore.setSyncProgress({ status: 'idle' })

┌─────────────────────────────────────────────────────────────┐
│ VERIFICATION ON SERVER                                      │
└─────────────────────────────────────────────────────────────┘

11. Admin opens dashboard in office
    └─ Sees new payment recorded by collector
    └─ Portfolio data updated automatically
    └─ Collection efficiency recalculated
```

### 7.2 Sync Error Scenarios & Recovery

```
SCENARIO 1: Network drops during sync
├─ SyncService detects error
├─ Marks progress: { status: 'error', errorMessage: '...' }
├─ Logs error for debugging
└─ User can retry manually (Sync button in sync-center modal)

SCENARIO 2: Conflicting changes (collector edits loan same time as admin)
├─ Merge strategy: Last-write-wins (via updated_at timestamp)
├─ Server version takes precedence
├─ Collector's local data overwritten on next sync
├─ Solution: Show warning if conflict high-risk field

SCENARIO 3: Offline for days
├─ User continues working offline
├─ Queue can grow to hundreds of changes
├─ On reconnect: Large batch sync may take 30-60 seconds
├─ Solution: Show progress bar, allow cancel & retry

SCENARIO 4: User signs out, different user signs in
├─ AuthService.signOut() calls database.unsafeResetDatabase()
├─ All local data wiped (prevents data leakage)
├─ New user starts fresh sync on login
```

---

## 8. SECURITY & ENCRYPTION

### 8.1 Authentication Flow

```
User enters: admin@poscursor.com / password123
     ↓
AuthService.signIn(email, password)
     ↓
Supabase Auth API (HTTPS)
     ├─ Validates credentials against auth.users table
     ├─ Returns session token (JWT) if valid
     └─ Returns error if invalid
     ↓
✓ Success: Store session in Supabase client
     ↓
AuthService.getCurrentUserRole(uid)
     ├─ Check hardcoded test roles
     ├─ Query user_profiles table for role
     └─ Return role (e.g., 'collector')
     ↓
authStore.setUser(user) + authStore.setRole(role)
     ↓
<AuthProvider> routes to role-specific screens
     └─ /app/(collector)/* if role='collector'
     └─ /app/(admin)/* if role='admin'
```

### 8.2 Data Encryption Details

**What's Encrypted:**
- `Borrower.address` - Physical address
- `Borrower.phone` - Contact number

**What's NOT Encrypted:**
- `Borrower.area` - Route information (needed for quick filtering)
- `Borrower.route_index` - For sorting
- `Borrower.full_name` - For search
- All loan & payment data (business logic needs it plaintext)

**Why Selective Encryption?**
- Performance: Filtering by `area` on encrypted field would be slow
- PII Definition: Not all data is PII; area is operational
- Balance: Security vs. usability for field workers

**Encryption Implementation:**
```typescript
// Storage:
address: "enc:WDExFTAsQw0sIjszLCc="  (base64-encoded XOR result)
phone: "enc:DApWEkZKMhc3BCc="

// Retrieval (automatic via Borrower model):
borrower.address            // Returns encrypted value
borrower.decryptedAddress   // Returns plaintext (computed getter)

// Under the hood:
1. XOR plaintext with APP_SECRET key
2. Base64 encode the result
3. Prefix with 'enc:' marker
```

### 8.3 Row-Level Security (RLS)

**On Supabase** (Backend Protection):
```sql
-- All tables have RLS enabled
-- Policy example:
CREATE POLICY "auth_read" ON borrowers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "auth_write" ON borrowers
  FOR ALL USING (auth.role() = 'authenticated');
```

**Purpose**:
- Prevents direct database access
- Forces all queries through Supabase client
- Ensures only authenticated users can read/write

### 8.4 API Request Flow (Secure)

```
Client (React Native)
    ↓
Supabase Client SDK (supabase-js)
    ├─ Attaches JWT token to all requests
    ├─ Uses HTTPS encryption for transport
    └─ Handles session refresh automatically
    ↓
Supabase REST API (Gateway)
    ├─ Verifies JWT signature
    ├─ Checks RLS policies
    └─ If valid: Execute query → PostgreSQL
    ↓
Response
    ├─ Data (if allowed by RLS)
    └─ Error (if RLS denies)
```

### 8.5 Local Database Security

```
SQLite Database (on device)
├─ Location: /data/data/com.app/files/SQLite/
├─ File Permissions: App-only access (OS enforces)
├─ Encryption at File Level:
│  └─ iOS: Handled by iOS Keychain (auto)
│  └─ Android: Can enable with encryption key (in production)
└─ On Logout: database.unsafeResetDatabase() wipes all data
```

---

## 9. USER ROLES & ACCESS CONTROL

### 9.1 Role Hierarchy

```
┌──────────────────┐
│   ADMIN          │ ← Highest privilege
├──────────────────┤
│ Dashboard        │ View all KPIs, reports
│ Borrower Mgmt    │ CRUD borrowers
│ Loan Mgmt        │ CRUD loans, create/update
│ Payment Review   │ View & verify payments
│ Expense Mgmt     │ Manage expenses
│ Bank Accounts    │ CRUD bank accounts
│ Remittance Appr. │ Approve/reject remittances
│ Reports          │ Export financial reports
│ User Mgmt        │ Create staff accounts
└──────────────────┘

┌──────────────────┐
│  LOAN ENCODER    │
├──────────────────┤
│ Create Loan      │ Fill in borrower & loan details
│ View Borrowers   │ Read-only search
│ Loan History     │ Track loans created
│ (No sync control)│
└──────────────────┘

┌──────────────────┐
│ PAYMENT ENCODER  │
├──────────────────┤
│ Record Payment   │ Enter payment received
│ Loan Details     │ View borrower/loan info
│ Payment History  │ Track payments entered
└──────────────────┘

┌──────────────────┐
│ EXPENSES ENCODER │
├──────────────────┤
│ Record Expense   │ Create expense entry
│ Expense History  │ View past expenses
└──────────────────┘

┌──────────────────┐
│  COLLECTOR       │ ← Field operator
├──────────────────┤
│ Collection Sheet │ Daily collection form
│ Borrower List    │ Find borrowers by area
│ Payment Record   │ Record payment received
│ Remittance Mgmt  │ Submit cash handover
│ Help Guide       │ Field documentation
└──────────────────┘
```

### 9.2 Screen Routing by Role

```
Login as admin@poscursor.com
    ↓
Role detected: 'admin'
    ↓
Routed to: app/(admin)/_layout
    ├─ app/(admin)/index          (Dashboard)
    ├─ app/(admin)/borrowers      (Management)
    ├─ app/(admin)/loans
    ├─ app/(admin)/payments
    │ ... etc
    └─ Other roles' screens: NOT ACCESSIBLE

Login as collector@poscursor.com
    ↓
Role detected: 'collector'
    ↓
Routed to: app/(collector)/_layout
    ├─ app/(collector)/index             (Dashboard)
    ├─ app/(collector)/collection-sheet  (Main form)
    ├─ app/(collector)/borrowers         (Search)
    ├─ app/(collector)/remittances       (Handover)
    └─ Other roles' screens: NOT ACCESSIBLE
```

### 9.3 Feature Matrix

| Feature | Admin | Collector | Encoder | Notes |
|---------|-------|-----------|---------|-------|
| View Dashboard | ✓ | ✓ | ✗ | Different dashboards per role |
| Manage Borrowers | ✓ | View only | View only | Collectors can't add borrowers |
| Create Loans | ✓ | ✗ | ✓ | Loan Encoder's responsibility |
| Record Payments | ✓ | ✓ | ✓ | Multiple roles can enter payments |
| Approve Remittance | ✓ | ✗ | ✗ | Admin-only to prevent self-approval |
| Manage Expenses | ✓ | ✗ | ✓ | Expenses Encoder handles |
| Sync Control | ✓ | ✓ | ✗ | Encoders work in office (always online) |
| View Reports | ✓ | ✓ | ✗ | Financial visibility for management |

---

## 10. UI/UX ARCHITECTURE

### 10.1 Component Hierarchy

```
RootLayout (_layout.tsx)
├─ ErrorBoundary (catches all crashes)
├─ AuthProvider (session management)
├─ AppShell
│  ├─ Stack Router (Expo Router)
│  │  ├─ Loading Screen (initial sync)
│  │  ├─ Login Screen
│  │  └─ Role-specific groups:
│  │     ├─ (admin)
│  │     ├─ (collector)
│  │     ├─ (loan-encoder)
│  │     ├─ (payment-encoder)
│  │     └─ (expenses-encoder)
│  ├─ OfflineBanner (network status)
│  └─ Toast Notifications (feedback)

Screen Structure (Example: Collector Collection Sheet)
┌─────────────────────────────────────┐
│ Header with SyncStatusIndicator     │ (green/yellow/red dot)
├─────────────────────────────────────┤
│ Form:                               │
│ ├─ BorrowerSelector (dropdown)      │ (Reusable component)
│ ├─ LoanSelector (read-only list)    │
│ ├─ PaymentAmountInput               │
│ ├─ CollectionDatePicker             │
│ └─ SubmitButton                     │
│                                     │
│ + List of today's collections       │
│   (scrollable, editable)            │
├─────────────────────────────────────┤
│ Footer: Sync button, Help button    │
└─────────────────────────────────────┘
```

### 10.2 Key Components

| Component | Purpose | Usage |
|-----------|---------|-------|
| `StatCard` | Display KPI metrics | Admin: Show PAR, OSS, GLP |
| `MetricBreakdownDialog` | Detail popup for stats | Click stat → Dialog |
| `BorrowerSelector` | Searchable dropdown | Find borrower by name |
| `SyncStatusIndicator` | Network/sync status | Show sync progress |
| `OfflineBanner` | Alert when offline | "Collecting when offline" |
| `ErrorBoundary` | Catch React errors | Prevent white screen crashes |
| `AppToast` | Notifications | "Payment saved!", "Sync error" |
| `PhpCurrencyText` | Format ₱ amounts | Display prices nicely |

### 10.3 Styling System (NativeWind/Tailwind)

```typescript
// Tailwind classes for React Native (via NativeWind)

Example Button:
<Pressable className="bg-blue-600 px-4 py-2 rounded-lg">
  <Text className="text-white text-lg font-semibold">Submit Payment</Text>
</Pressable>

// Maps to platform-specific styles
// Android: Material Design
// iOS: iOS Human Interface Guidelines

Theme Colors (src/constants/colors.ts):
├─ primary:    #006DB3 (POSCursor blue)
├─ success:    #28A745 (green)
├─ warning:    #FFC107 (yellow/offline)
├─ danger:     #DC3545 (red/error)
└─ neutral:    #F5F5F5 (light gray)
```

---

## 11. STATE MANAGEMENT

### 11.1 Zustand Stores

#### `authStore` - User & Session
```typescript
// Location: src/stores/authStore.ts

State:
├─ user: User | null          // Supabase auth user object
├─ role: string | null        // 'admin' | 'collector' | etc.
├─ loading: boolean           // Initial load state

Actions:
├─ setUser(user)              // Update after login
├─ setRole(role)              // Update after role fetched
├─ setLoading(bool)           // Toggle loading
└─ reset()                    // Clear on logout

Usage:
const { user, role, loading } = useAuthStore();
if (loading) return <LoadingScreen />;
if (!user) return <LoginScreen />;
return <AppScreen />;
```

#### `syncStore` - Synchronization Progress
```typescript
// Location: src/stores/syncStore.ts

State:
├─ status: 'idle' | 'syncing' | 'error'
├─ progress: 0-100           // Overall progress %
├─ currentModel: string      // "Loans", "Payments", etc.
├─ pendingChanges: number    // Count of unsync'd records
├─ errorMessage: string      // Sync error (if any)
└─ logs: [{timestamp, type, message}, ...]

Actions:
├─ setSyncProgress(partial)  // Update progress
├─ addLog(logEntry)          // Append to logs
├─ clearLogs()               // Reset log history
└─ reset()                   // Reset to idle

Usage:
const { status, progress, currentModel } = useSyncStore();
{status === 'syncing' && (
  <ProgressBar value={progress} />
  <Text>Syncing {currentModel}...</Text>
)}
```

### 11.2 Data Flow with Stores

```
User Action (e.g., submit payment)
    ↓
Component calls: await PaymentService.recordPayment(data)
    ↓
PaymentService:
├─ Validates data
├─ Creates local Payment record
├─ WatermelonDB sets _status = 'created'
└─ Returns success
    ↓
Component shows: Toast "Payment recorded"
    ↓
App detects network → triggers SyncService
    ↓
SyncService:
├─ Updates syncStore: { status: 'syncing' }
├─ Pulls changes from Supabase
├─ Pushes local changes
└─ Updates syncStore: { status: 'idle' }
    ↓
UI re-renders (Zustand subscribers react)
└─ Toast "Sync complete"
```

---

## 12. TESTING STRATEGY

### 12.1 Test Structure

```
src/
├── components/__tests__/        # Component tests
│   ├── StatCard.test.tsx
│   ├── OfflineBanner.test.tsx
│   └── ...
├── services/__tests__/          # Service unit tests
│   ├── SyncService.test.ts
│   ├── EncryptionService.test.ts
│   ├── MfiKpiService.test.ts
│   └── ...
├── database/models/__tests__/   # Model tests
├── stores/__tests__/            # Store tests
└── utils/__tests__/             # Utility tests

app/__tests__/                  # Integration tests
├── authFlow.test.tsx
├── collectionFlow.test.tsx
└── syncFlow.test.tsx
```

### 12.2 Testing Approach

```
Unit Tests (Isolated):
├─ Service methods with mock inputs
├─ Utility functions
├─ Store state changes
└─ Run: jest src/services/MfiKpiService.test.ts

Component Tests:
├─ Render components with test data
├─ Verify UI output
├─ Simulate user interaction
└─ Use @testing-library/react-native

Integration Tests:
├─ Full user workflows
├─ Mock WatermelonDB & Supabase
├─ Verify data persistence & sync
└─ Run: jest app/__tests__/
```

### 12.3 Mocking Strategy

```typescript
// Mock WatermelonDB for testing
jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn(),
    and: jest.fn(),
  },
  synchronize: jest.fn(),
}));

// Mock Supabase
jest.mock('src/database/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(),
}));
```

### 12.4 Running Tests

```bash
# Run all tests
npm test

# Run specific file
npm test src/services/MfiKpiService.test.ts

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

---

## 13. DEPLOYMENT & CONFIGURATION

### 13.1 Environment Setup

**`.env` File** (Must create before running):
```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_SUPABASE_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# These are DEVELOPMENT values only
# Production keys provided via EAS secrets
```

### 13.2 Supabase Backend Setup

**Required Tables** (Create in Supabase SQL Editor):

```sql
-- All tables require:
-- ✓ id (primary key, uuid)
-- ✓ created_at (timestamp)
-- ✓ updated_at (timestamp)
-- ✓ deleted_at (timestamp, nullable) for soft deletes

-- Example:
CREATE TABLE borrowers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    area TEXT,
    route_index INTEGER,
    collector_id UUID,
    auth_id UUID,
    date_of_birth TIMESTAMPTZ,
    gender TEXT,
    notes TEXT,
    created_by UUID,
    latitude NUMERIC,
    longitude NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Enable Row-Level Security
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;

-- Example RLS policy
CREATE POLICY "Allow authenticated read" ON borrowers
    FOR SELECT USING (auth.role() = 'authenticated');
```

### 13.3 Building for Production

#### Android (APK/AAB)
```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build APK
eas build --platform android --local

# Build App Bundle (for Google Play)
eas build --platform android --local

# Output: Downloaded to project root
```

#### iOS (IPA)
```bash
# Build for iOS
eas build --platform ios --local

# Requires Apple Developer account & certificates
# EAS handles signing & provisioning
```

#### Web
```bash
# Local preview
npm run web

# Build for deployment
expo export --platform web
# Output: dist/ folder
# Deploy to: Vercel, Netlify, AWS, etc.
```

### 13.4 EAS Configuration

**`eas.json`**:
```json
{
  "cli": {
    "version": ">=5.0.0"
  },
  "build": {
    "preview": {
      "android": { "buildType": "apk" },
      "ios": { "buildType": "simulator" }
    },
    "production": {
      "android": {
        "buildType": "app-bundle",
        "releaseChannel": "production"
      },
      "ios": {
        "buildType": "archive",
        "releaseChannel": "production"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccount": "path/to/service-account.json",
        "track": "production"
      }
    }
  }
}
```

### 13.5 Metro Bundler Configuration

**`metro.config.js`** (Handles module resolution):
```javascript
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
};
```

### 13.6 Babel Configuration

**`babel.config.js`** (JavaScript transformation):
```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'inline-dotenv', // Load .env variables
      ['@babel/plugin-proposal-decorators', { legacy: true }],
    ],
  };
};
```

### 13.7 Deployment Checklist

```
Before Production Release:
☐ Test on real devices (Android & iOS)
☐ Verify all roles work (Admin, Collector, Encoder)
☐ Test offline sync flows
☐ Encrypt sensitive data (use expo-secure-store)
☐ Set up Supabase backups
☐ Configure RLS policies on all tables
☐ Create test user accounts
☐ Update environment variables
☐ Run full test suite
☐ Performance profiling (no memory leaks)
☐ Generate release notes
☐ Prepare support documentation
```

---

## 14. COMMON WORKFLOWS & USE CASES

### Use Case 1: Admin Creates New Loan

```
1. Admin logs in → sees Admin dashboard
2. Clicks "New Loan"
3. Selects Borrower (searchable dropdown)
4. Fills form:
   - Principal: ₱10,000
   - Interest Rate: 10%
   - Term: 6 months
   - Frequency: Weekly
5. System calculates:
   - Total Amount: ₱10,500
   - Installment: ₱416.67/week
   - Creates PaymentSchedule records (26 rows)
6. Clicks Save
   - Loan record created locally (_status = 'created')
   - Toast: "Loan created"
7. Sync triggered (if online)
   - Loan & PaymentSchedules pushed to Supabase
   - _status cleared
8. Collector app receives update on next sync
   - Can now collect payments on this loan
```

### Use Case 2: Collector Submits Remittance

```
1. Collector worked all week, collected ₱25,500
2. Clicks "Remittance" tab
3. Form shows:
   - Collector ID: (auto-filled)
   - Available cash on hand: ₱25,500
   - Remittance amount: (input) ₱25,500
4. Clicks Submit
   - Remittance record created (status = 'pending')
   - Admin sees pending remittance in dashboard
5. Admin reviews (next day)
   - Verifies against counter-receipt
   - Clicks "Approve" → status = 'approved'
   - System updates: CashTransaction created
6. Collector sees remittance approved in app
   - Cash commitment cleared
   - Ready for fresh collections
```

### Use Case 3: Admin Views Financial Dashboard

```
1. Admin logs in → Dashboard
2. System displays KPIs:
   - PAR: 4.2% (healthy)
   - GLP: ₱250,000 (portfolio size)
   - Collection Efficiency: 92.5%
   - Active Loans: 85
   - Total Outstanding: ₱45,600
3. Admin taps "Portfolio at Risk" card
   - MetricBreakdownDialog opens
   - Shows:
     * Loans overdue > 30 days: 3
     * Outstanding on those loans: ₱10,700
     * % of total: 4.2%
4. Admin clicks "View Details"
   - Taken to loans screen filtered by "defaulted"
   - Shows all 3 loans with collector info
   - Can click each to take action
```

---

## 15. KNOWN ISSUES & TROUBLESHOOTING

### Issue: "Sync Hanging"
**Cause**: Network interruption, Supabase down, auth token expired
**Solution**:
```
1. Check status.supabase.com
2. Verify .env variables correct
3. Log out & log back in (refresh token)
4. Manual retry via Sync Center modal
```

### Issue: "Payment Data Not Syncing"
**Cause**: WatermelonDB _status not set, or sync filter bug
**Solution**:
```
1. Check local database directly
2. Verify payment has _status = 'created'
3. Check ErrorService logs
4. Manually retry sync
```

### Issue: "Decrypted Data Returns Null"
**Cause**: EncryptionService.APP_SECRET mismatch, or data encrypted with different key
**Solution**:
```
1. Verify APP_SECRET constant matches
2. If migrating data, re-encrypt all PII
3. Check encryption prefix ('enc:')
```

### Issue: "Role-Based Screen Not Loading"
**Cause**: Role not correctly detected, or role-to-screen mapping broken
**Solution**:
```
1. Verify user role in user_profiles table
2. Check hardcoded test roles in AuthService
3. Log out & log back in
4. Check authStore state in console
```

### Issue: "Offline Mode Doesn't Work"
**Cause**: App tries network call before checking offline status
**Solution**:
```
1. Use useNetworkStatus() hook in component
2. Wrap network calls in: if (isOnline) { ... }
3. Verify all data fetches use local WatermelonDB first
```

---

## 16. NEXT STEPS FOR STUDY

### Phase 1: Understand the Basics (1-2 Days)
1. ✓ Read this document (you are here)
2. Read [ARCHITECTURE.md](ARCHITECTURE.md)
3. Read [DOCUMENTATION.md](DOCUMENTATION.md)
4. Explore folder structure in VS Code

### Phase 2: Dive into Core Logic (2-3 Days)
1. Study `SyncService.ts` line-by-line (understand pull/push)
2. Study `MfiKpiService.ts` (financial calculations)
3. Create a simple new KPI method and test it

### Phase 3: Hands-On Development (3-5 Days)
1. Create a new borrower in UI
2. Record a payment
3. Observe sync in action
4. Monitor WatermelonDB with React DevTools

### Phase 4: Advanced Topics (1-2 Weeks)
1. Modify EncryptionService (add new encrypted fields)
2. Add a new Role type to the system
3. Create a new Report generator
4. Extend SyncService for new table

---

## 17. KEY TAKEAWAYS

| Concept | Key Point |
|---------|-----------|
| **Offline-First** | App works in field without internet; syncs when connected |
| **Domain-Driven Design** | Business logic in Services & Models, UI is dumb |
| **Bidirectional Sync** | Pull (server→local) then Push (local→server) |
| **Encryption** | PII encrypted at rest; decrypted on access via model getters |
| **Role-Based Access** | Different UI/logic for Admin / Collector / Encoders |
| **KPIs** | Automatic calculation of financial health metrics (PAR, OSS, etc.) |
| **Remittance Tracking** | Audit trail from field collection to office deposit |
| **Error Handling** | Centralized ErrorService for consistent error management |
| **Testing** | Mocked services allow tests to run without native modules |
| **Deployment** | EAS for mobile; Web version for office access |

---

## 📚 References & Further Reading

- [Expo Documentation](https://docs.expo.dev/)
- [WatermelonDB Official Guide](https://nozbe.github.io/WatermelonDB/)
- [Supabase Documentation](https://supabase.com/docs)
- [React Native Official](https://reactnative.dev/)
- [Zustand State Management](https://github.com/pmndrs/zustand)
- [React Hook Form](https://react-hook-form.com/)
- [Microfinance KPI Definitions](https://www.cgap.org/)

---

**Document Version**: 1.0  
**Last Updated**: March 20, 2026  
**Author**: AI Assistant (GitHub Copilot)  
**Status**: Complete & Ready for Study
