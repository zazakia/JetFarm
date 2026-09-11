# MPCO Business Unit Developer & AI Agent Integration Guide

This guide defines the standards, conventions, and steps for adding new business units (modules) to the **POSCursor / POS Cursor Management System**.

---

## 1. Directory Structure

All business units must reside in their own subdirectory under `src/modules/[module-slug]/`.

```
src/
└── modules/
    └── [module-slug]/
        ├── manifest.ts          # Module metadata, default accounts, routes, and roles
        ├── services/            # Business-specific logic, extending BaseModelService
        ├── components/          # Shared reusable UI elements for the module
        └── __tests__/           # Jest unit tests
```

The matching Expo Router screens must reside under:
`app/(admin)/modules/[module-slug]/` (flat index.tsx dashboard, and sub-pages).

---

## 2. Setting Up a New Business Module

To bootstrap a new module in seconds, run the scaffolding script from the project root:

```bash
node scripts/scaffold-module.mjs --name "Pharmacy" --slug pharmacy --coaCode PH
```

This generates:
1. The module manifest in `src/modules/pharmacy/manifest.ts`
2. A basic service in `src/modules/pharmacy/services/PharmacyService.ts`
3. A dashboard screen in `app/(admin)/modules/pharmacy/index.tsx`
4. A Supabase migration template in `supabase/migrations/[timestamp]_add_pharmacy_module.sql`
5. Automatically registers the module in `src/modules/registry.ts`

---

## 3. Financial Posting & Journal Entries

Every transaction inside the business module that has financial value **MUST** be posted to the Double-Entry General Ledger using `ModuleAccountingBridge`.

Example from a sales service:

```typescript
import { ModuleAccountingBridge } from '../../core/ModuleAccountingBridge';
import MyModule from '../manifest';

await ModuleAccountingBridge.postModuleEntry(
    MyModule,
    {
        entryDate: new Date(),
        description: `Retail Cash Sale`,
        entryType: 'auto',
        lines: [
            {
                accountCode: '1017', // Cash on Hand for this module
                accountName: 'Cash on Hand — Pharmacy',
                debitAmount: saleAmount
            },
            {
                accountCode: '4200', // Sales Revenue for this module
                accountName: 'Pharmacy Sales Revenue',
                creditAmount: saleAmount
            }
        ],
        sourceTable: 'ph_sales',
        sourceId: saleRecord.id
    }
);
```

### Account Code Structure Rules
- Always map module-specific Cash accounts in the `1010-1019` range.
- Map module-specific Revenues in the `4100-4290` range.
- Map module-specific Operating Costs or Supplies in the `5100-5200` range.
- All posted lines will automatically carry the `business_unit_id` matching your module `id` for segment filtering.

---

## 4. Testing Requirements

- Write Jest unit tests in the module's `__tests__/` directory.
- Test double-entry balance check: ensure every service transaction matches Debit = Credit.
- Ensure soft deletes on module models correctly set `deleted_at`.
