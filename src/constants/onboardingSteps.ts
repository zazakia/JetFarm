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
        title: 'Welcome to Agri-One',
        description: 'Agri-One runs the outgrower operation: managed land parcels, crop cycles, harvest weigh-ins, farm labor, input expenses and the double-entry books that tie them together. This 60-second tour shows where the tools live.',
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
        id: 'farm_analytics',
        stepNumber: 3,
        title: 'Yield Analytics & Settlements',
        description: 'Compare yield and cost per hectare by parcel, review the BioGreen investor ledger, and settle land owners from the harvest scale records in Philippine Pesos (₱).',
        icon: 'show-chart',
        badgeText: 'Farm Performance',
        badgeColor: 'bg-amber-600',
        targetRoute: '/(admin)/agribusiness/analytics',
        highlightLabel: 'P&L & Yield Analytics',
    },
    {
        id: 'general_ledger',
        stepNumber: 4,
        title: 'Accounting & Financial Statements',
        description: 'Every farm posting writes to the general ledger. Close the month, then read the balance sheet, income statement, cash flows and notes to the financial statements.',
        icon: 'account-balance',
        badgeText: 'Books & Reports',
        badgeColor: 'bg-indigo-600',
        targetRoute: '/(admin)/accounting',
        highlightLabel: 'Accounting & General Ledger',
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
        description: 'Access complete standard operating procedures anytime, or load reversible demo parcels, crop cycles and journal entries to test every feature risk-free without affecting real records.',
        icon: 'auto-fix-high',
        badgeText: 'Training & SOPs',
        badgeColor: 'bg-purple-600',
        targetRoute: '/(admin)/help',
        highlightLabel: 'Help & Operational Guides',
    },
];
