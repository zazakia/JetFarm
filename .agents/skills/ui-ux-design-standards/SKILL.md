---
name: ui-ux-design-standards
description: UI/UX design standards, accessibility checks (contrast/white-on-white detection), layout grid, typography hierarchy, touch targets, state management, and quality audit guidelines for POSCursor/POS Cursor.
---

# UI/UX Design Standards & Quality Audit Skill

This skill defines the authoritative design standards, accessibility requirements, spatial grids, and quality checks for building and reviewing user interfaces across mobile (React Native / Expo) and web environments in POSCursor / POS Cursor.

---

## 1. Core Principles

1. **Accessibility First & High Contrast**: Zero unreadable text (e.g. white text on white background or dark text on dark background). All text and interactive controls must meet WCAG 2.1 AA standards (minimum 4.5:1 contrast ratio for normal text, 3:1 for large text & UI components).
2. **Predictable Spatial Grid**: Clean, consistent layout spacing using an 8pt/4pt grid system.
3. **Clear Visual Hierarchy**: Distinct typographic contrast (font size, weight, and color) guiding user focus.
4. **Accessible Touch Targets**: All interactive elements must have a minimum touch target size of 44x44 dp.
5. **Complete State Coverage**: Every screen/component must gracefully handle 5 states: Ideal, Loading, Empty, Error, and Partial/Zero Filter.
6. **Polished Micro-Interactions**: Active pressed feedback, smooth transitions, and haptic feedback.

---

## 2. Contrast & Color Safety Rules

### Anti-Pattern Rulebook (Strictly Prohibited)

| Anti-Pattern | Description | Correct Alternative |
|--------------|-------------|---------------------|
| 🛑 **White-on-White** | `text-white` or `text-slate-50` inside a white/light surface (`bg-white` or `bg-slate-50`) without a dark container | `text-slate-900 dark:text-white` |
| 🛑 **Dark-on-Dark** | `text-slate-900` or `text-black` inside a dark surface (`bg-slate-900` or `bg-black`) | `text-white dark:text-slate-100` |
| 🛑 **Hardcoded Color on Dynamic Background** | `<Text style={{ color: '#FFF' }}>` inside a card that defaults to light background | Use Tailwind text classes (`text-white` inside `bg-emerald-600`) or theme dynamic tokens (`text-slate-900 dark:text-white`) |
| 🛑 **Arbitrary Hex Colors** | Using arbitrary hex colors in NativeWind (e.g., `bg-[#1E3A8A]`) which are unsupported in v4 | Use standard Tailwind color classes (e.g., `bg-blue-900`) |
| 🛑 **Low Contrast Muted Text** | `text-slate-300` text on a white background | Use `text-slate-500` or `text-slate-600` for secondary text on light backgrounds |
| 🛑 **Missing Dark Mode Variant** | Defining `bg-white` or `text-slate-900` without providing matching `dark:bg-slate-800` or `dark:text-white` | Always pair: `bg-white dark:bg-slate-800` and `text-slate-900 dark:text-slate-100` |

### Approved Color Token Matrix

| Surface Context | Primary Text | Secondary / Caption Text | Accent / Icon Color |
|-----------------|--------------|--------------------------|---------------------|
| **Light Surface** (`#FFFFFF` / `bg-white`) | `#0F172A` (`text-slate-900`) | `#475569` (`text-slate-600`) | `#355E3B` (`text-emerald-700` / `primary`) |
| **Light Screen Background** (`#F8FAFC` / `bg-slate-50`) | `#0F172A` (`text-slate-900`) | `#64748B` (`text-slate-500`) | `#1E293B` (`text-slate-800`) |
| **Dark Card Surface** (`#1E293B` / `bg-slate-800`) | `#F8FAFC` (`text-slate-50`) | `#94A3B8` (`text-slate-400`) | `#34D399` (`text-emerald-400`) |
| **Dark Screen Background** (`#0F172A` / `bg-slate-900`) | `#FFFFFF` (`text-white`) | `#CBD5E1` (`text-slate-300`) | `#10B981` (`text-emerald-500`) |
| **Primary CTA Button** (`#355E3B` / Emerald) | `#FFFFFF` (`text-white`) | `#D1FAE5` (`text-emerald-100`) | `#FFFFFF` (`icon color="#FFF"`) |
| **Danger / Destructive Button** (`#DC2626` / Red) | `#FFFFFF` (`text-white`) | `#FEE2E2` (`text-red-100`) | `#FFFFFF` (`icon color="#FFF"`) |

---

## 3. Spatial Grid & Layout Standards

Utilize an **8pt / 4pt spatial grid** across all containers, cards, and interactive components:

```
Spacing Tokens:
- p-1 / gap-1 = 4px  (micro gaps, badge padding)
- p-2 / gap-2 = 8px  (icon-to-text gaps, tight list items)
- p-3 / gap-3 = 12px (standard button vertical padding, input padding)
- p-4 / gap-4 = 16px (card inner padding, standard stack spacing)
- p-6 / gap-6 = 24px (large section padding, screen margins)
```

### Layout Guidelines
- **Screen Margins**: `px-4 py-4` (mobile) or `px-6 py-6` (tablet/web).
- **Card Spacing**: Cards should use `p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm`.
- **List Item Gaps**: `space-y-3` or `gap-3` between list items.
- **Header to Content Gap**: `mb-4` or `mb-6`.
- **Safe Area Insets**: Always wrap top app headers or bottom fixed action bars with `SafeAreaView` or inset utility classes (`pt-safe`, `pb-safe`).

---

## 4. Typography Scale & Visual Hierarchy

Maintain strict typographic visual hierarchy so users can scan screens quickly:

```tsx
// Screen Title (24px, Bold)
<Text className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
  Collection Overview
</Text>

// Section Subheading (18px, SemiBold)
<Text className="text-lg font-semibold text-slate-800 dark:text-slate-100">
  Active Loans
</Text>

// Card Header / Item Title (16px, SemiBold)
<Text className="text-base font-semibold text-slate-900 dark:text-white">
  Juan Dela Cruz
</Text>

// Body Text (14px, Regular)
<Text className="text-sm font-normal text-slate-700 dark:text-slate-300">
  Daily amortization payment due today.
</Text>

// Caption / Metadata (12px, Medium)
<Text className="text-xs font-medium text-slate-500 dark:text-slate-400">
  Ref #LN-2026-0805 • 2 hours ago
</Text>
```

### Currency Formatting Rules
- Always use standard Philippine Peso formatting (`₱1,234.56`) using `src/utils/currency.ts` or `<PhpCurrencyText>`.
- Format monetary numbers with tabular numeric figures (`font-bold text-slate-900 dark:text-white` or `text-emerald-600 dark:text-emerald-400` for positive cash-in).

---

## 5. Touch Targets, Interactivity & Accessibility

### Touch Target Minimums
- **Minimum Interactive Size**: All touchable elements (`Pressable`, `TouchableOpacity`, `Button`) MUST be at least **44x44 dp** (or `min-h-[44px]` / `p-3`).
- **Icon Buttons**: Icon-only buttons must have sufficient padding (e.g. `p-3.5` or `w-11 h-11 items-center justify-center`).

### Tactile Feedback & Animation
- **Pressed State**: Use scale and opacity feedback on all buttons:
  ```tsx
  <Pressable 
    className="bg-emerald-700 active:opacity-90 active:scale-[0.98] px-4 py-3.5 rounded-xl items-center justify-center min-h-[44px]"
    onPress={handlePress}
    accessibilityLabel="Submit Payment"
    accessibilityRole="button"
  >
    <Text className="text-white font-semibold text-base">Submit Payment</Text>
  </Pressable>
  ```
- **Haptic Feedback**: Trigger `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` on button clicks, toggle switches, and pull-to-refresh.
- **Accessibility Attributes**: Icon-only buttons must include `accessibilityLabel="..."` and `accessibilityRole="button"`.

---

## 6. The 5 Essential UI States Checklist

Every feature screen and data widget must implement all 5 UI states:

1. **Ideal State**: Clean populated state with formatted rows, clear status pills, and action options.
2. **Loading State**: Skeleton loaders (`Animated` shimmer placeholders matching list item heights) or a centered `<ActivityIndicator size="large" color="#355E3B" />`. Prevents layout shift.
3. **Empty State**: Displayed when no data exists (e.g. 0 loans or empty search). Contains:
   - Modern icon/illustration (size 48-64px, muted slate color).
   - Clear headline: `"No Active Loans Found"`.
   - Friendly subtext: `"When new loans are created, they will appear here."`.
   - Primary Call to Action button: `"+ Add New Loan"`.
4. **Error State**: Displays clean error banner or full-screen fallback. Includes:
   - Error icon + concise user-friendly message (avoid raw technical stack traces).
   - `"Try Again"` or `"Refresh"` button.
5. **Partial / Filter Zero State**: Displayed when search/filter returns 0 matches.
   - Text: `"No results matching '...'"` + `"Clear Filters"` button.

---

## 7. Quality & Aesthetic Enhancement Factors

To deliver a premium visual and interactive experience:

- **Surface Elevation & Glassmorphism**: Use subtle borders (`border border-slate-200 dark:border-slate-800`) paired with subtle shadows (`shadow-sm` or `shadow-md`) rather than heavy dark shadows.
- **Status Pills & Badges**: Standardize status colors:
  - **Active / Approved**: Emerald pill (`bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300`)
  - **Pending / In Review**: Slate/Amber pill (`bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300`)
  - **Paid / Completed**: Blue pill (`bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300`)
  - **Overdue / Defaulted**: Red pill (`bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300`)
- **Keyboard Safety**: Wrap form inputs inside `KeyboardAvoidingView` (behavior `padding` on iOS) + `ScrollView` (`keyboardShouldPersistTaps="handled"`).
- **Form UX**: Top-aligned input labels, clear placeholder text, inline validation error text (`text-xs text-red-600 mt-1`), focus state ring (`focus:border-emerald-600`).
- **Offline / Sync Banners**: Subtle top banner showing network status (`OfflineBanner`) and sync status (`SyncStatusBadge`).

---

## 8. Code Audit Workflow & Diagnostic Tools

Run the automated UI contrast and accessibility scanner to detect anti-patterns in the codebase:

```bash
# Run UI Contrast & Accessibility Audit Script
node scripts/audit-ui-contrast.js
```

### What the Audit Script Scans:
1. **White-on-White / Light-on-Light contrast violations** (`text-white` on `bg-white`).
2. **Dark-on-Dark contrast violations** (`text-slate-900` on `bg-slate-900`).
3. **Hardcoded color `#fff` without dark container styling**.
4. **Interactive elements with small touch targets** (<44px).
5. **Icon-only pressable buttons missing `accessibilityLabel`**.
6. **Hardcoded light backgrounds missing corresponding `dark:bg-*` pairs**.

---

## 9. Quick Verification Checklist for PRs / Code Reviews

- [ ] Ran `node scripts/audit-ui-contrast.js` with 0 HIGH severity violations.
- [ ] Verified light mode readability (no invisible white text).
- [ ] Verified dark mode readability (no dark text on dark surface).
- [ ] Checked touch target sizes on real mobile device or emulator (≥44x44 dp).
- [ ] Verified Empty, Loading, and Error states for all new screens.
- [ ] Verified haptic feedback and active press animation state.
