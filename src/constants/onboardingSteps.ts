import { MaterialIcons } from '@expo/vector-icons';

export interface OnboardingStep {
    id: string;
    stepNumber: number;
    title: string;
    description: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    badgeText?: string;
    badgeColor?: string; // e.g. 'bg-emerald-600'
    targetRoute?: string;
    highlightLabel?: string;
}

export const ADMIN_ONBOARDING_STEPS: OnboardingStep[] = [
    {
        id: 'welcome',
        stepNumber: 1,
        title: 'Welcome to JetFarm',
        description: 'JetFarm is your unified enterprise platform for agribusiness outgrower management, touch POS operations, and cooperative credit. This 60-second tour shows where essential tools live.',
        icon: 'dashboard',
        badgeText: 'Overview',
        badgeColor: 'bg-blue-600',
    },
    {
        id: 'agribusiness',
        stepNumber: 2,
        title: 'Agribusiness Command Center',
        description: 'Track managed land parcels, monitor Cassava & Corn crop cycles, log daily farm labor, and record digital harvest weigh-ins with guaranteed ₱1.00/kg land owner settlements.',
        icon: 'eco',
        badgeText: 'Outgrower Platform',
        badgeColor: 'bg-emerald-600',
        targetRoute: '/(admin)/agribusiness',
        highlightLabel: 'Agribusiness Operations',
    },
    {
        id: 'pos_retail',
        stepNumber: 3,
        title: 'Touch POS & Store Inventory',
        description: 'Execute lightning-fast cashier sales, manage item categories and stock replenishment, process customer returns, and issue official receipts in Philippine Pesos (₱).',
        icon: 'point-of-sale',
        badgeText: 'Point of Sale',
        badgeColor: 'bg-amber-600',
        targetRoute: '/(cashier)/pos',
        highlightLabel: 'Touch POS Terminal',
    },
    {
        id: 'lending_credit',
        stepNumber: 4,
        title: 'Lending & Credit Portfolio',
        description: 'Manage borrower profiles, disburse agricultural loans with custom interest schedules, assign field collection routes, and view automatic daily repayment ledgers.',
        icon: 'payments',
        badgeText: 'Credit & Loans',
        badgeColor: 'bg-indigo-600',
        targetRoute: '/(admin)/loans',
        highlightLabel: 'Lending Operations',
    },
    {
        id: 'offline_sync',
        stepNumber: 5,
        title: '100% Offline-Ready Data Engine',
        description: 'Farm in remote locations with zero signal anxiety. All transactions persist locally in WatermelonDB and automatically synchronize with Supabase cloud when internet restores.',
        icon: 'sync',
        badgeText: 'Offline First',
        badgeColor: 'bg-teal-600',
        highlightLabel: 'Sync Status Indicator',
    },
    {
        id: 'help_demo',
        stepNumber: 6,
        title: 'Help Guides & Demo Data',
        description: 'Access complete standard operating procedures anytime, or load rich demo farm parcels and products to test every feature risk-free without affecting real records.',
        icon: 'auto-fix-high',
        badgeText: 'Training & SOPs',
        badgeColor: 'bg-purple-600',
        targetRoute: '/(admin)/help',
        highlightLabel: 'Help & Operational Guides',
    },
];
