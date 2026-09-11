# POSCursor Comprehensive Documentation

Welcome to the **POSCursor** development guide. This document provides an in-depth look into the architecture, technology stack, and core logic of the POSCursor React Native application, specifically tailored for assistant programmers.

---

## 🏗 Architecture Overview

### 1. Domain-Driven Design (DDD)
POSCursor follows a DDD-lite approach where business logic is centered around **Models** and **Services**.
- **Models** (`src/database/models/`): Define the properties and behaviors of domain entities (e.g., `Loan`, `Borrower`).
- **Services** (`src/services/`): Orchestrate complex operations across multiple models or external APIs (e.g., `SyncService`, `AuthService`).

### 2. Offline-First Principles
The app is designed to work seamlessly in areas with poor connectivity.
- **Local Persistence**: All data is first written to a local SQLite database using **WatermelonDB**.
- **Bidirectional Sync**: The `SyncService` synchronizes local changes with **Supabase** and pulls updates from the server.

### 3. SOLID Principles
- **S**: Each service has a single responsibility (e.g., `PdfGenerator` only handles PDF creation).
- **O**: Logic is extendable (e.g., adding new KPI calculations to `MfiKpiService` doesn't break existing ones).
- **L/I/D**: Use of dependency injection for the database and Supabase client via centralized exports.

---

## 📂 Detailed Folder Structure

```text
app/               # Expo Router (file-based routing)
├── (admin)/       # Screens for Admin role
├── (collector)/   # Screens for Collector role
├── (loan-encoder)/# Screens for Loan Encoder role
├── ...            # Other role-based groups
├── login.tsx      # Main login screen
└── loading.tsx    # App initialization & initial sync

src/
├── components/    # Reusable UI components (StatCard, MetricBreakdown, etc.)
├── constants/     # Global constants (Roles, Colors, Themes)
├── database/      # WatermelonDB setup
│   ├── models/    # Domain entity models
│   ├── schema.ts  # Database schema definition
│   └── sync.ts    # Low-level sync bridge
├── services/      # Business logic Layer
│   ├── SyncService.ts         # Multi-table synchronization (including Remittances)
│   ├── EncryptionService.ts   # PII data protection
│   └── MfiKpiService.ts       # Financial calculations (Summary & Profit/Loss)
├── stores/        # Zustand global state management
└── utils/         # Helper functions (Currency, Date, Validation)
```

---

## 🛠 Tech Stack Deep Dive

- **Framework**: [Expo SDK 51](https://docs.expo.dev/) for cross-platform React Native development.
- **Database**: [WatermelonDB](https://nozbe.github.io/WatermelonDB/) for high-performance offline storage.
- **Backend**: [Supabase](https://supabase.com/) for Authentication and PostgreSQL database.
- **Styling**: NativeWind (Tailwind CSS for React Native) for consistent and fast UI development.
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) for lightweight global state.

---

## 🔄 Synchronization Logic (`SyncService`)

The `SyncService` uses WatermelonDB's `synchronize` helper to manage data consistency between the device and Supabase.

1.  **Pull Phase**:
    - Fetches changes from Supabase tables (`created`, `updated`, `deleted`).
    - Uses `updated_at` (or `created_at` for immutable tables) to fetch only incremental changes.
    - Handles soft-deletes via the `deleted_at` column.
2.  **Push Phase**:
    - Identifies "dirty" local records.
    - Sends them to Supabase in batches using the `upsert` operation for efficiency.
    - Records marked for deletion locally are updated with a `deleted_at` timestamp on the server.

---

## 🔐 Security & Encryption (`EncryptionService`)

PII (Personally Identifiable Information) like addresses and phone numbers are encrypted at rest.

- **Storage**: Data is stored in SQLite as base64-encoded XORed strings prefixed with `enc:`.
- **Logic**: The `Borrower` model automatically decrypts these fields via computed getters during access.
- **Hashing**: `expo-crypto` is used for SHA-256 hashing where consistency checks are needed without revealing original data.
- **Geographic Routing**: The `Borrower` model includes `area` and `route_index` fields (unencrypted) to facilitate route-based filtering and sorting in the Collection Sheet.

---

## 📈 Financial Logic (`MfiKpiService`) 
This service calculates critical Microfinance KPIs:
- **PAR (Portfolio At Risk)**: % of outstanding principal on loans with overdue payments > 30 days.
- **OSS (Operating Self-Sufficiency)**: Operating Revenue / (Operating Expenses + Financial Costs + Provisions).
- **GLP (Gross Loan Portfolio)**: Total outstanding principal of all active loans.

---

## 🧪 Testing Strategy

- **Unit Tests**: Located in `__tests__` directories next to the source files.
- **Mocks**: We use extensive mocking for native modules (e.g., `expo-crypto`) and WatermelonDB to allow tests to run in typical Node environments.
- **Run Tests**: Use `npm test` to execute the full suite.

---

## 💡 Troubleshooting for Developers

- **Sync Hanging**: Check `status.supabase.com` or ensure your local internet isn't blocking Supabase API calls.
- **Data Not Decrypting**: Ensure the `EncryptionService.APP_SECRET` matches between the encryption and decryption attempts.
- **Missing Models**: If you add a table to `schema.ts`, you **must** also add it to `SyncService.ts` and the `database` initializer.
- **Remittance Flow**: Remember that Remittances involve a state change from `pending` to `approved`/`rejected`. Only `approved` remittances should be considered finalized in balance sheets.
