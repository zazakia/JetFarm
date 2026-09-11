# Master Prompt: Implement Payroll System for POSCursor

**Goal:** Build a Payroll Management System for POSCursor, an offline-first loan management app built with React Native (Expo), WatermelonDB, and Supabase.

## System Context
- **Tech Stack:** Expo SDK 55, React Native 0.83, WatermelonDB (SQLite/LokiJS), Supabase, NativeWind v4, Zustand.
- **Architecture:** Offline-first. All writes must go to WatermelonDB first. SyncService handles background synchronization with Supabase.
- **App Structure:** Role-based file routing in `app/(role)/`.

## Feature Requirements

### 1. Database Schema (`src/database/schema.ts`)
Create the following tables in the WatermelonDB schema, bumping the schema version appropriately:

- `app_employees`
  - `name` (string)
  - `role` (string)
  - `base_salary` (number)
  - `is_active` (boolean)
  - `deleted_at` (number, optional)
  - Standard timestamps (`created_at`, `updated_at`)

- `app_payrolls`
  - `employee_id` (string, indexed)
  - `period_start` (number)
  - `period_end` (number)
  - `base_salary` (number)
  - `deductions` (number)
  - `allowances` (number)
  - `net_pay` (number)
  - `status` (string: 'draft', 'finalized', 'paid')
  - `deleted_at` (number, optional)
  - Standard timestamps (`created_at`, `updated_at`)

### 2. Database Models (`src/database/models/`)
Create WatermelonDB Model classes for the new tables:
- `Employee.ts` (table name: `app_employees`)
- `Payroll.ts` (table name: `app_payrolls`)
- *Important:* Ensure to use WatermelonDB decorators (`@text`, `@field`, `@date`, `@relation`, `@readonly`).

### 3. Business Logic (`src/services/PayrollService.ts`)
Create a new service class `PayrollService` (you can base it on similar services like `ExpenseService`) to handle:
- Creating and updating employees.
- Generating draft payrolls for active employees for a given period.
- Finalizing and marking payrolls as paid.
- **Expense Integration:** When a payroll is marked as 'paid', automatically insert a record into the `app_expenses` table with the category "Payroll" to track it as an operational expense.

### 4. Supabase Migrations (`supabase/migrations/`)
Create a new SQL migration file (e.g., `YYYYMMDDHHMMSS_create_payroll_tables.sql`) to reflect the new tables in Supabase.
- Table names must match exactly (`app_employees`, `app_payrolls`).
- Add standard columns (`id uuid primary key`, `created_at`, `updated_at`, `deleted_at`, `last_modified_at`).
- Enable RLS and add basic policies (Admin full access).
- Add `last_modified_at` triggers for sync functionality (using existing trigger function).

### 5. Synchronization (`src/services/SyncService.ts` & `src/database/index.ts`)
- Update `SyncService.ts` to include `app_employees` and `app_payrolls` in the synchronization engine mapping. 
- Ensure local table names are mapped to the correct Supabase table names.

### 6. User Interface (`app/(admin)/payroll/`)
Create the following screens using NativeWind and existing UI components (`Card`, `Button`, `Input`, etc.):
- **Employee Management:** A screen to list, add, and edit employees and their base salaries.
- **Payroll Dashboard:** A screen to view payroll periods, generate new payrolls, adjust deductions/allowances, and mark them as paid.
- Link this new module to the admin sidebar or dashboard navigation.

### Coding Constraints & Anti-Patterns
- **Offline First:** Never bypass WatermelonDB. All reads and writes must go through local DB instances. Do not query Supabase directly from the UI.
- **Mutations:** Do not mutate WatermelonDB records directly; wrap changes in `database.write(async () => { ... })` and use `prepareCreate` or `prepareUpdate` appropriately.
- **Styling:** Never use inline styles. Use NativeWind `className` attributes exclusively.
- **IDs:** WatermelonDB uses string UUIDs. Ensure Supabase migrations use `uuid` with `default gen_random_uuid()`.

---
**Agent Instruction:** Please execute this implementation step-by-step. Start by creating an implementation plan, verifying the existing schema version, and wait for my approval before modifying the codebase.
