---
name: ui-patterns
description: NativeWind design system, component patterns, and UI conventions for POSCursor
---

# UI Patterns Skill — POSCursor

## Styling Stack

| Tech | Version | Notes |
|------|---------|-------|
| NativeWind | v4.2.2 | Tailwind CSS for React Native |
| Tailwind CSS | v3.4.19 | Configuration in `tailwind.config.js` |
| Reanimated | v4.2.1 | Animations |
| Expo Router | v55 | File-based routing |

Babel config disables `nativewind/babel` in test mode (`process.env.NODE_ENV === 'test'`).

## Color Palette

Defined in `src/constants/colors.ts`:

### Core Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#059669` (Emerald 600) | Main brand, buttons, active states |
| `primaryDark` | `#047857` (Emerald 700) | Pressed states |
| `primaryLight` | `#10B981` (Emerald 500) | Highlights |
| `secondary` | `#1E293B` (Slate 800) | Navigation, dark backgrounds |
| `secondaryDark` | `#0F172A` (Slate 900) | Screen backgrounds |
| `accent` | `#F59E0B` (Amber 500) | Warnings, attention |
| `background` | `#F8FAFC` (Slate 50) | Light background |
| `surface` | `#FFFFFF` | Cards, modals |

### Status Colors
| Token | Hex | Status |
|-------|-----|--------|
| `statusPending` | `#64748B` | Pending loans |
| `statusActive` | `#059669` | Active loans |
| `statusPaid` | `#2563EB` | Paid loans |
| `statusDefaulted` | `#DC2626` | Defaulted |
| `statusRestructured` | `#EA580C` | Restructured |
| `statusPartial` | `#D97706` | Partial payment |
| `statusLate` | `#991B1B` | Late payment |

### Role Colors
| Role | Color | Hex |
|------|-------|-----|
| Admin | Red | `#DC2626` |
| Collector | Emerald | `#059669` |
| Loan Encoder | Blue | `#2563EB` |
| Payment Encoder | Orange | `#EA580C` |
| Expenses Encoder | Violet | `#7C3AED` |
| Borrower | Slate | `#1E293B` |

### Transaction Colors
| Type | Hex |
|------|-----|
| Cash In | `#16A34A` (Green 600) |
| Cash Out | `#DC2626` (Red 600) |

## Currency

**Philippine Peso (₱)** — formatted via `src/utils/currency.ts` and rendered with `<PhpCurrencyText>` component.

Always format monetary values with the ₱ symbol and proper thousands separators.

## App Structure (Expo Router)

```
app/
├── _layout.tsx          # Root layout
├── index.tsx            # Entry redirect
├── login.tsx            # Login screen (16KB — complex)
├── register.tsx         # Registration
├── loading.tsx          # Loading/splash
├── sync-center.tsx      # Sync management UI
├── (admin)/             # Admin dashboard & management
│   ├── index.tsx        # Admin dashboard (39KB — largest screen)
│   ├── loans/           # Loan management
│   ├── borrowers/       # Borrower management
│   ├── collectors/      # Collector management
│   ├── payments/        # Payment management
│   ├── expenses/        # Expense tracking
│   ├── cash-on-hand/    # Cash management
│   ├── bank-accounts/   # Bank accounts
│   ├── remittances.tsx  # Remittance tracking
│   ├── reports/         # Financial reports
│   ├── settings/        # App settings
│   ├── users/           # User management
│   └── help.tsx         # Help guide
├── (collector)/         # Collector dashboard
│   ├── index.tsx        # Collector dashboard (26KB)
│   ├── collection-sheet.tsx      # Default collection sheet
│   ├── collection-sheet-daily.tsx
│   ├── collection-sheet-weekly.tsx
│   ├── borrowers/
│   ├── remittances.tsx
│   └── help.tsx
├── (borrower)/          # Borrower portal
├── (loan-encoder)/      # Loan entry screens
├── (payment-encoder)/   # Payment entry screens
└── (expenses-encoder)/  # Expense entry screens
```

## Key Components

Located in `src/components/`:

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `StatCard` | Dashboard metric cards | `title`, `value`, `icon`, `color` |
| `CollectorKpiCard` | KPI display for collectors | KPI metrics |
| `SyncStatusBadge` | Shows sync state (syncing/complete/error) | Reads from `useSyncStore` |
| `SyncStatusIndicator` | Detailed sync progress | Progress bar, logs |
| `ConfirmDialog` | Confirmation modal | `title`, `message`, `onConfirm` |
| `ActionSheet` | Bottom sheet actions | `actions[]` |
| `AnimatedPressable` | Pressable with scale animation | Wraps `Pressable` |
| `ErrorBoundary` | Catches React render errors | Wraps children |
| `OfflineBanner` | Shows when device offline | Auto via `useNetworkStatus` |
| `BorrowerSelector` | Searchable borrower picker | Reactive via WatermelonDB |
| `SearchBar` | Reusable search input | `onSearch`, `placeholder` |
| `PhpCurrencyText` | Formats numbers as ₱ | `amount` |
| `LendingPerformanceChart` | Chart for lending metrics | `react-native-chart-kit` |
| `MetricInfoDialog` | KPI metric explanations | `metric`, `visible` |
| `MetricBreakdownDialog` | Detailed metric breakdown | `data` |
| `ReportInfoModal` | Report metadata display | - |
| `AppLogo` | Brand logo SVG | - |
| `SwipeableItem` | Swipe-to-reveal actions | `react-native-gesture-handler` |
| `SidebarContent` | Navigation drawer | Role-based menu items |
| `HelpStepCard` | Help guide step card | `step`, `title`, `description` |

## Animation Patterns

Using `react-native-reanimated` v4:

```tsx
import Animated, { FadeInUp, FadeInDown, LinearTransition } from 'react-native-reanimated';

// Entry animations
<Animated.View entering={FadeInUp.delay(100).duration(400)}>
    <StatCard ... />
</Animated.View>

// Layout animations for list reordering
<Animated.View layout={LinearTransition.springify()}>
    ...
</Animated.View>
```

## Reactive WatermelonDB Components

Use `@nozbe/with-observables` HOC or `observe()` for reactive data binding:

```tsx
import { withObservables } from '@nozbe/with-observables';
import { database } from '../database';

const enhance = withObservables([], () => ({
    borrowers: database.get('borrowers').query().observe(),
}));

export default enhance(BorrowerList);
```

## Icons

Primary icon library: `@expo/vector-icons` — Ionicons

```tsx
import { Ionicons } from '@expo/vector-icons';
<Ionicons name="people" size={24} color={Colors.primary} />
```

Role icons from `src/constants/roles.ts`:
- admin → `shield-checkmark`
- collector → `people`
- loan_encoder → `document-text`
- payment_encoder → `cash`
- expenses_encoder → `receipt`
- borrower → `person-outline`
- main_office → `business`

## UI Conventions

1. **Dark nav, light content**: Navigation bars use `secondary` (`#1E293B`), content areas use `background` (`#F8FAFC`)
2. **Card-based layouts**: All data displayed in white surface cards with subtle borders (`#E2E8F0`)
3. **Emerald CTAs**: Primary actions always use `primary` emerald green
4. **Status pills**: Color-coded badges for loan status, payment status, etc.
5. **Bottom toast notifications**: Via `react-native-toast-message` with error/success/info variants
6. **Pull-to-refresh**: Standard pattern for data lists
7. **Haptic feedback**: Via `expo-haptics` for confirmations and actions
8. **No Arbitrary Hex Colors**: NativeWind v4 does NOT support arbitrary hex colors (e.g. `bg-[#1E3A8A]`). You MUST use standard Tailwind classes (e.g. `bg-blue-900`) instead.
