# app/

## OVERVIEW
Expo Router file-based routing screens. 89 files organized by user role using route groups. Each `(role)/` directory is a distinct navigation stack with role-specific _layout.tsx.

## STRUCTURE
```
app/
├── _layout.tsx              # Root: AuthProvider, error boundary, stack nav
├── index.tsx                # Redirects to /loading
├── loading.tsx              # Splash / loading screen
├── login.tsx                # Login page
├── register.tsx             # Registration
├── sync-center.tsx          # Manual sync trigger (modal)
├── (admin)/                 # 60+ files
│   ├── _layout.tsx          # Admin tabs + drawer nav
│   ├── index.tsx            # Dashboard (797 lines)
│   ├── borrowers/           # CRUD, passbook, savings
│   ├── loans/               # Create, view, list
│   ├── payments/            # Record, list
│   ├── reports/             # 15 report screens
│   ├── settings/            # 7 settings screens
│   ├── collectors/          # CRUD
│   ├── users/               # CRUD
│   ├── expenses/            # CRUD
│   ├── cash-on-hand/        # Cash management
│   └── bank-accounts/       # CRUD
├── (collector)/             # Collector screens
│   ├── collection-sheet.tsx
│   ├── collection-sheet-daily.tsx
│   ├── collection-sheet-weekly.tsx
│   └── remittances.tsx
├── (loan-encoder)/          # Loan creation screens
├── (payment-encoder)/       # Payment recording screens
├── (expenses-encoder)/      # Expense recording screens
└── (borrower)/              # Borrower portal
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Add an admin screen | `app/(admin)/<feature>/` |
| Add a collector screen | `app/(collector)/` |
| Add a new report | `app/(admin)/reports/` |
| Modify auth/nav flow | `app/_layout.tsx` + `app/(role)/_layout.tsx` |
| Add a route parameter | `[param].tsx` or `[param]/` directory |

## CONVENTIONS
- Route groups `(role)/` map to Supabase auth roles
- Dynamic routes use `[param].tsx` (e.g., `loans/[id].tsx`)
- Each role group has its own `_layout.tsx` for role-specific nav
- Screen-level tests co-located in `__tests__/` within each route group
- Stack navigator in root _layout.tsx; tabs/drawer in role _layout.tsx
