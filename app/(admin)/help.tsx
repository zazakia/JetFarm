import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable, Image, LayoutAnimation, Platform, UIManager, TextInput, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HelpStepCard } from '../../src/components/HelpStepCard';
import { SampleDataService, SampleStatus } from '../../src/services/SampleDataService';
import { database } from '../../src/database';
import { useOnboardingTour } from '../../src/context/OnboardingTourContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

function Accordion({ title, icon, children, defaultOpen = false }: any) {
    const [expanded, setExpanded] = useState(defaultOpen);

    const toggle = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    return (
        <View className="bg-white rounded-3xl overflow-hidden mb-4 border border-gray-100 shadow-sm">
            <Pressable onPress={toggle} className="flex-row items-center p-5 active:bg-gray-50">
                <View className="w-10 h-10 rounded-2xl bg-blue-900 items-center justify-center mr-4">
                    <MaterialIcons name={icon} size={20} color="#FFFFFF" />
                </View>
                <Text className="flex-1 font-bold text-gray-900 text-lg">{title}</Text>
                <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={24} color="#9CA3AF" />
            </Pressable>
            {expanded && (
                <View className="px-5 pb-5 pt-2 border-t border-gray-50">
                    {children}
                </View>
            )}
        </View>
    );
}

function HelpNote({ title, body, variant = 'indigo' }: { title: string; body: string; variant?: 'indigo' | 'emerald' | 'amber' }) {
    const bgClass = variant === 'emerald' ? 'bg-emerald-50 border-emerald-100' : variant === 'amber' ? 'bg-amber-50 border-amber-100' : 'bg-indigo-50 border-indigo-100';
    const titleClass = variant === 'emerald' ? 'text-emerald-900' : variant === 'amber' ? 'text-amber-900' : 'text-indigo-900';
    const bodyClass = variant === 'emerald' ? 'text-emerald-700' : variant === 'amber' ? 'text-amber-700' : 'text-indigo-700';

    return (
        <View className={`${bgClass} border rounded-2xl p-4 mb-5`}>
            <Text className={`${titleClass} font-black text-xs uppercase tracking-[2px] mb-1`}>{title}</Text>
            <Text className={`${bodyClass} text-sm leading-6`}>{body}</Text>
        </View>
    );
}

function BulletList({ items }: { items: string[] }) {
    return (
        <View className="mb-5">
            {items.map((item) => (
                <View key={item} className="flex-row items-start mb-2.5">
                    <View className="w-1.5 h-1.5 rounded-full bg-blue-900 mt-2.5 mr-3" />
                    <Text className="flex-1 text-gray-700 text-sm leading-6">{item}</Text>
                </View>
            ))}
        </View>
    );
}

const CATEGORIES = [
    { id: 'all', label: 'All Guides', icon: 'apps' },
    { id: 'agri', label: '🌾 Agribusiness', icon: 'eco' },
    { id: 'market', label: '🏪 Marketplace & POS', icon: 'storefront' },
    { id: 'water', label: '💧 Water Station', icon: 'water-drop' },
    { id: 'lending', label: '💳 Lending & Credit', icon: 'payments' },
    { id: 'accounting', label: '💰 Accounting & Vault', icon: 'menu-book' },
    { id: 'hr', label: '👥 HR & Payroll', icon: 'badge' },
    { id: 'sync', label: '🔄 Offline & Sync', icon: 'sync' },
];

export default function AdminHelpScreen() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [sampleStatus, setSampleStatus] = useState<SampleStatus | null>(null);
    const [loadingSampleAction, setLoadingSampleAction] = useState(false);
    const tour = useOnboardingTour();

    const loadSampleStatus = async () => {
        try {
            const status = await SampleDataService.getStatus(database);
            setSampleStatus(status);
        } catch (err) {
            console.warn('[AdminHelp] Could not load sample status:', err);
        }
    };

    useEffect(() => {
        loadSampleStatus();
    }, []);

    const handleToggleDemoData = async () => {
        setLoadingSampleAction(true);
        try {
            if (sampleStatus?.enabled) {
                await SampleDataService.disable(database);
                Alert.alert('Demo Data Hidden', 'Mock records have been temporarily hidden. You can re-enable them anytime.');
            } else {
                await SampleDataService.enable(database);
                Alert.alert('Demo Data Loaded!', 'Realistic mock data across all modules (Agribusiness, Store, Water Station, Lending, Accounting, and Employees) has been seeded into your local database.');
            }
            await loadSampleStatus();
        } catch (err: any) {
            Alert.alert('Action Failed', err.message || 'Unable to update demo data.');
        } finally {
            setLoadingSampleAction(false);
        }
    };

    const q = searchQuery.toLowerCase().trim();

    const matchesSearch = (tags: string[], text: string) => {
        if (!q) return true;
        return tags.some(t => t.toLowerCase().includes(q)) || text.toLowerCase().includes(q);
    };

    const showCategory = (catId: string) => {
        if (selectedCategory === 'all') return true;
        return selectedCategory === catId;
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            {/* Header */}
            <LinearGradient colors={['#1E3A8A', '#065F46']} className="pt-12 pb-6 px-6 rounded-b-[40px] shadow-sm">
                <Text className="text-white/90 text-xs font-bold uppercase tracking-[3px] mb-1">Interactive User Guide & Walkthrough</Text>
                <Text className="text-white text-3xl font-black">Help & Operating Guide</Text>
                <Text className="text-white/80 text-sm font-medium mt-2">
                    Master all modules, field workflows, offline operations, and financial features.
                </Text>

                {/* Real-time Search Input */}
                <View className="mt-4 flex-row items-center bg-white rounded-2xl px-4 py-2.5 shadow-sm">
                    <MaterialIcons name="search" size={20} color="#9CA3AF" />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search modules, workflows, or instructions..."
                        placeholderTextColor="#9CA3AF"
                        className="flex-1 ml-2.5 text-gray-900 text-sm font-medium"
                    />
                    {searchQuery ? (
                        <Pressable onPress={() => setSearchQuery('')} className="p-1">
                            <MaterialIcons name="close" size={18} color="#9CA3AF" />
                        </Pressable>
                    ) : null}
                </View>
            </LinearGradient>

            <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                {/* Interactive Guided Tour Hero Card */}
                <View className="bg-gray-900 border border-gray-700 rounded-3xl p-5 mb-6 shadow-sm">
                    <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center flex-1 mr-3">
                            <View className="w-10 h-10 rounded-2xl bg-blue-600 items-center justify-center mr-3 shadow-sm">
                                <MaterialIcons name="explore" size={22} color="#FFFFFF" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-extrabold text-white text-base">Interactive Platform Tour</Text>
                                <Text className="text-gray-400 text-xs">60-second guided onboarding walkthrough</Text>
                            </View>
                        </View>
                        <View className="px-2.5 py-1 rounded-full bg-blue-900 border border-blue-500">
                            <Text className="text-blue-300 font-bold text-[10px] uppercase tracking-wider">Guided</Text>
                        </View>
                    </View>

                    <Text className="text-gray-300 text-xs leading-5 mb-4">
                        Need a refresher or onboarding a new teammate? Replay the 6-step guided walkthrough to explore Agribusiness, Touch POS, Lending, and Offline-First Sync.
                    </Text>

                    <Pressable
                        testID="help-launch-tour-button"
                        onPress={() => tour?.startTour()}
                        className="py-3 px-4 rounded-2xl bg-blue-600 active:bg-blue-700 items-center flex-row justify-center"
                    >
                        <MaterialIcons name="play-arrow" size={18} color="#FFFFFF" />
                        <Text className="text-white font-bold text-xs ml-2">
                            Launch Guided Tour
                        </Text>
                    </Pressable>
                </View>

                {/* One-Tap Demo Data Card */}
                <View className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl p-5 mb-6 shadow-sm">
                    <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center flex-1 mr-3">
                            <View className="w-10 h-10 rounded-2xl bg-emerald-600 items-center justify-center mr-3 shadow-sm">
                                <MaterialIcons name="auto-fix-high" size={22} color="#FFFFFF" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-emerald-950 font-black text-base">Quick Start: Mock Data</Text>
                                <Text className="text-emerald-800 text-xs font-semibold">
                                    {sampleStatus?.enabled
                                        ? `Active Demo Data: ${sampleStatus.active} records populated across all modules`
                                        : 'No demo data loaded yet — load with 1 tap'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <Text className="text-emerald-900/80 text-xs leading-5 mb-4">
                        Populate the entire system with realistic Philippine agricultural parcels, crop cycles, farm harvests, store inventory, sales returns, water station orders, and loans to immediately test and explore every screen.
                    </Text>

                    <View className="flex-row items-center gap-3">
                        <Pressable
                            onPress={handleToggleDemoData}
                            disabled={loadingSampleAction}
                            className={`flex-1 py-3 px-4 rounded-2xl items-center flex-row justify-center ${sampleStatus?.enabled ? 'bg-amber-600 active:bg-amber-700' : 'bg-emerald-600 active:bg-emerald-700'}`}
                        >
                            {loadingSampleAction ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <MaterialIcons name={sampleStatus?.enabled ? 'visibility-off' : 'cloud-download'} size={18} color="#FFFFFF" />
                                    <Text className="text-white font-bold text-xs ml-2">
                                        {sampleStatus?.enabled ? 'Hide All Demo Data' : 'Load All Modules Demo Data'}
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                </View>

                {/* Category Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 -mx-6 px-6">
                    <View className="flex-row gap-2">
                        {CATEGORIES.map(cat => {
                            const active = selectedCategory === cat.id;
                            return (
                                <Pressable
                                    key={cat.id}
                                    onPress={() => setSelectedCategory(cat.id)}
                                    className={`py-2 px-3.5 rounded-2xl border flex-row items-center ${active ? 'bg-blue-900 border-blue-900' : 'bg-white border-gray-200 active:bg-gray-100'}`}
                                >
                                    <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-gray-700'}`}>
                                        {cat.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </ScrollView>

                {/* 1. Getting Started & Dashboard */}
                {(showCategory('all') || selectedCategory === 'all') && matchesSearch(['dashboard', 'start', 'navigation', 'sidebar', 'sync'], 'Getting Started & Navigation') && (
                    <Accordion title="1. Getting Started & App Navigation" icon="home" defaultOpen={true}>
                        <Text className="text-gray-600 mb-4 leading-6">
                            JetFarm is an offline-first enterprise management, POS, and agricultural operations system. It runs completely offline using local persistence and synchronizes seamlessly with the cloud when internet is available.
                        </Text>
                        <HelpNote
                            title="Multi-Role Architecture"
                            body="Admins have full oversight across all modules. Collectors use mobile route lists. Cashiers operate the Touch POS and Till. Branch managers oversee store receiving and stock audits."
                        />
                        <BulletList
                            items={[
                                'Daily Start: Pull down to refresh your dashboard metrics and trigger an instant background sync with Supabase.',
                                'Full Navigation: Tap the Menu icon in the top left to open the sidebar with organized operational groups.',
                                'Branch & Warehouse Switcher: Use the branch switcher chip in the header to switch active branch context.',
                                'Sync Status Badge: Located at the top right. Green indicates fully synchronized; orange indicates pending sync; red indicates offline queue.',
                                'Super User-Friendly: Every screen supports drill-downs and clean modal details with zero learning curve.'
                            ]}
                        />
                        <HelpStepCard stepNumber={1} icon="dashboard" title="Review Live Dashboard KPIs" description="Monitor outstanding balances, daily collections, crop hectarage, and cash balances before taking action." />
                        <HelpStepCard stepNumber={2} icon="menu" title="Open the Sidebar Menu" description="Browse modules categorized into Agribusiness, Crispy King POS, Lending, Accounting, and Business Units." />
                        <HelpStepCard stepNumber={3} icon="sync" title="Monitor Sync Convergence" description="All records created locally are encrypted, saved offline immediately, and synced automatically when connected." />
                    </Accordion>
                )}

                {/* 2. 🌾 Agribusiness Outgrower Platform */}
                {(showCategory('agri') || selectedCategory === 'all') && matchesSearch(['agri', 'agribusiness', 'farm', 'parcel', 'crop', 'cycle', 'harvest', 'labor', 'settlement'], 'Agribusiness & Farm Operations') && (
                    <Accordion title="2. 🌾 Agribusiness & Farm Operations" icon="eco" defaultOpen={selectedCategory === 'agri'}>
                        <Text className="text-gray-600 mb-4 leading-6">
                            The JetFarm Agribusiness platform coordinates outgrower farmers, crop cycles (e.g. High-Starch Cassava KU50 and Hybrid Yellow Corn), farm inputs, labor tracking, harvest scale weigh-ins, and weekly land settlements.
                        </Text>
                        <HelpNote
                            title="Core Agricultural Flow"
                            variant="emerald"
                            body="1. Register Land Parcel -> 2. Create Crop Cycle -> 3. Record Labor & Input Expenses -> 4. Harvest Weigh-in Scale -> 5. Generate Land Owner & Investor Weekly Settlements."
                        />
                        <HelpStepCard stepNumber={1} icon="landscape" title="Land Parcels Registry & Mapping" description="Register farm land parcels with total hectares, soil type (Sandy Loam, Clay Loam), land owner association, and GPS boundary markers." />
                        <HelpStepCard stepNumber={2} icon="grass" title="Crop Cycles Management" description="Start a crop cycle with target planting date, target harvest date, variety (KU50 Cassava, Pioneer Corn), expected yield, and offtake price in ₱/kg." />
                        <HelpStepCard stepNumber={3} icon="engineering" title="Farm Labor & Input Expenses" description="Log daily labor (weeding, plowing, spraying, transplanting) with daily rates or piece rates, and track input costs (organic fertilizer, seeds)." />
                        <HelpStepCard stepNumber={4} icon="scale" title="Digital Harvest Scale Terminal" description="Record truck weigh-ins: gross weight, tare weight, net weight in kg, quality grade (Grade A/B), moisture levels, and truck plate number." />
                        <HelpStepCard stepNumber={5} icon="receipt-long" title="Land Owner & Investor Settlements" description="Automatically compute net payouts using guaranteed minimums, per-kilo rate sharing, and offtake revenue with audit-ready statements." />
                        <BulletList
                            items={[
                                'Command Center: View real-time active hectares, ongoing crop cycles, total harvest yield in kg, and settlement status.',
                                'Yield & P&L Analytics: Track cost per hectare, gross margin per crop cycle, and compare planned vs actual harvest yields.',
                                'Offline Field Friendly: Record labor tasks and harvest weigh-ins out in rural fields with zero internet connectivity.'
                            ]}
                        />
                    </Accordion>
                )}

                {/* 3. 🏪 Marketplace, Retail POS & Sales Returns */}
                {(showCategory('market') || selectedCategory === 'all') && matchesSearch(['market', 'marketplace', 'pos', 'store', 'return', 'refund', 'inventory', 'warehouse'], 'Marketplace, POS & Sales Returns') && (
                    <Accordion title="3. 🏪 Marketplace, Retail POS & Sales Returns" icon="storefront" defaultOpen={selectedCategory === 'market'}>
                        <Text className="text-gray-600 mb-4 leading-6">
                            Manage retail agricultural supplies, cooperative stores, product listings, stock inventory across warehouses, touch POS sales, and audited sales returns.
                        </Text>
                        <HelpNote
                            title="Sales Return Workflow (Strict 3-Step Compliance)"
                            variant="amber"
                            body="Step 1 (Draft): Customer gives reason and item list. Step 2 (Approve): Supervisor reviews and approves. Step 3 (Complete): Good items are restocked onto warehouse shelves with stock movement logged; Damaged items are routed to waste log; POS sale is reversed and refund issued in cash or credit."
                        />
                        <HelpStepCard stepNumber={1} icon="inventory-2" title="Product Catalog & Warehousing" description="Maintain inventory SKUs, categories (Seeds, Fertilizers, Produce), barcodes, base units, and stock quantities across warehouses." />
                        <HelpStepCard stepNumber={2} icon="point-of-sale" title="Touch POS & Daily Till Register" description="Fast counter checkout with item search, discounts, official receipts, and opening/closing cash float reconciliation." />
                        <HelpStepCard stepNumber={3} icon="assignment-return" title="Sales Returns & Restocking" description="Process customer returns safely. System verifies original receipt, checks item condition (good vs damaged), and automatically updates warehouse stock balances." />
                        <BulletList
                            items={[
                                'Stock Movements: Every inbound purchase, retail sale, transfer, and return generates an unalterable stock ledger record.',
                                'Multi-Warehouse: Support for Central Warehouse, Transit Silo, and Cold Storage with cross-warehouse transfers.',
                                'Currency Standard: All product prices, discounts, and sales figures are strictly handled in Philippine Peso (₱ PHP).'
                            ]}
                        />
                    </Accordion>
                )}

                {/* 4. 💧 Water Refilling Station Module */}
                {(showCategory('water') || selectedCategory === 'all') && matchesSearch(['water', 'station', 'gallon', 'container', 'bottle', 'delivery'], 'Water Station Module') && (
                    <Accordion title="4. 💧 Water Refilling Station Module" icon="water-drop" defaultOpen={selectedCategory === 'water'}>
                        <Text className="text-gray-600 mb-4 leading-6">
                            Dedicated business unit module for operating community water refilling stations with customer container tracking, delivery routing, and payment logging.
                        </Text>
                        <HelpStepCard stepNumber={1} icon="people" title="Customer Profiles & Special Rates" description="Register household and commercial customers (bakeries, schools, barangay halls) with default gallon rates and delivery addresses." />
                        <HelpStepCard stepNumber={2} icon="local-drink" title="Bottle & Container Asset Tracking" description="Track Round 5-Gallon and Slim 5-Gallon containers. Record bottles owned by the customer vs loaned from the station to prevent asset loss." />
                        <HelpStepCard stepNumber={3} icon="local-shipping" title="Deliveries & Payment Collection" description="Dispatch delivery runs, mark orders delivered, and accept payments via Cash or GCash with instant receipt generation." />
                        <HelpStepCard stepNumber={4} icon="build" title="Station Maintenance & Operating Expenses" description="Record operating expenses such as replacement sediment filters, activated carbon cartridges, and delivery vehicle fuel." />
                    </Accordion>
                )}

                {/* 5. 💳 Microfinance & Lending Management */}
                {(showCategory('lending') || selectedCategory === 'all') && matchesSearch(['lending', 'loan', 'borrower', 'collector', 'payment', 'penalty', 'cic'], 'Lending & Credit Operations') && (
                    <Accordion title="5. 💳 Microfinance & Lending Operations" icon="payments" defaultOpen={selectedCategory === 'lending'}>
                        <Text className="text-gray-600 mb-4 leading-6">
                            Comprehensive microfinance engine supporting member registration, loan products, amortization calculation, field collection sheets, and delinquency management.
                        </Text>
                        <HelpStepCard stepNumber={1} icon="person-add" title="Member KYC & Area Route Assignment" description="Register borrowers with co-maker details, ID photos, and assign them to collector routes and geographical areas." />
                        <HelpStepCard stepNumber={2} icon="receipt-long" title="Loan Application & Approval" description="Configure loan products (Standard, Petty Cash, Livelihood, Emergency) with flat interest calculation, terms, and approval workflows." />
                        <HelpStepCard stepNumber={3} icon="calendar-today" title="Payment Schedules & Field Collections" description="Generate installment schedules (daily/weekly/monthly). Collectors use mobile collection sheets with live offline receipting." />
                        <HelpStepCard stepNumber={4} icon="gavel" title="Portfolio Aging & File Cases" description="Track Portfolio at Risk (PAR>30 days), automatic delinquency flags, and legal case file logging for defaulted accounts." />
                    </Accordion>
                )}

                {/* 6. 💰 Vault, Cash on Hand & Accounting */}
                {(showCategory('accounting') || selectedCategory === 'all') && matchesSearch(['accounting', 'vault', 'cash', 'bank', 'journal', 'ledger', 'coa'], 'Accounting & Financial Vault') && (
                    <Accordion title="6. 💰 Accounting, Vault & General Ledger" icon="menu-book" defaultOpen={selectedCategory === 'accounting'}>
                        <Text className="text-gray-600 mb-4 leading-6">
                            Enterprise double-entry accounting with strict PostgreSQL balance triggers. Manages vault cash, petty cash funds, bank accounts, and certified books of accounts.
                        </Text>
                        <HelpNote
                            title="Strict Double-Entry Rule"
                            variant="indigo"
                            body="Every journal entry must be balanced: Total Debits must exactly equal Total Credits. The database enforces this at both client and database trigger levels."
                        />
                        <HelpStepCard stepNumber={1} icon="account-balance-wallet" title="Cash Vault & Petty Cash Float" description="Track physical vault movements. Approved collector remittances increase vault cash, while expenses and disbursements decrease it." />
                        <HelpStepCard stepNumber={2} icon="account-balance" title="Bank Accounts & Reconciliations" description="Manage multiple corporate bank accounts (e.g. LandBank, BDO) with opening balances, deposit records, and fund transfers." />
                        <HelpStepCard stepNumber={3} icon="format-list-numbered" title="Chart of Accounts & Journal Entries" description="Standard Cooperative Chart of Accounts (COA). View Cash Receipts Journal (CRJ), Cash Disbursements (CDJ), and General Ledger." />
                        <HelpStepCard stepNumber={4} icon="assessment" title="Audited Financial Statements" description="Generate on-demand Balance Sheets, Income Statements, Statements of Cash Flows, and Cooperative Annual Statutory Reserve Reports." />
                    </Accordion>
                )}

                {/* 7. 👥 Employees, HR & Philippine Payroll */}
                {(showCategory('hr') || selectedCategory === 'all') && matchesSearch(['hr', 'employee', 'payroll', 'sss', 'philhealth', 'pagibig', 'tin'], 'HR & Staff Payroll') && (
                    <Accordion title="7. 👥 HR & Philippine Statutory Payroll" icon="badge" defaultOpen={selectedCategory === 'hr'}>
                        <Text className="text-gray-600 mb-4 leading-6">
                            Manage staff records and automate Philippine statutory contributions (SSS, PhilHealth, Pag-IBIG, Withholding Tax) with semi-monthly payroll runs.
                        </Text>
                        <HelpStepCard stepNumber={1} icon="assignment-ind" title="201 Employee Masterlist" description="Store employee profiles, positions, daily/monthly salary rates, branch assignment, and government ID numbers (SSS, PhilHealth, Pag-IBIG, TIN)." />
                        <HelpStepCard stepNumber={2} icon="calculate" title="Statutory Deductions Engine" description="Accurately compute employee and employer share contributions in accordance with current Philippine statutory tables." />
                        <HelpStepCard stepNumber={3} icon="monetization-on" title="Payroll Processing & Payslips" description="Run semi-monthly payroll, review gross pay, overtime, deductions, and net pay in ₱ PHP with downloadable payslips." />
                    </Accordion>
                )}

                {/* 8. 🔄 Offline-First & Cloud Sync */}
                {(showCategory('sync') || selectedCategory === 'all') && matchesSearch(['sync', 'offline', 'backup', 'restore', 'cloud', 'supabase'], 'Offline Resilience & Cloud Sync') && (
                    <Accordion title="8. 🔄 Offline-First Architecture & Cloud Sync" icon="sync" defaultOpen={selectedCategory === 'sync'}>
                        <Text className="text-gray-600 mb-4 leading-6">
                            JetFarm is engineered from the ground up for Philippine rural conditions where connectivity is intermittent or unavailable.
                        </Text>
                        <HelpNote
                            title="Zero-Lag Local First"
                            variant="emerald"
                            body="All transactions (loans, harvest weigh-ins, POS sales, payments) write to local WatermelonDB instantly in less than 5ms. No spinners or waiting for internet."
                        />
                        <HelpStepCard stepNumber={1} icon="cloud-download" title="Automatic Two-Way Sync" description="When internet is detected, the sync engine exchanges changes with Supabase using Last-Write-Wins and strict relational dependency order." />
                        <HelpStepCard stepNumber={2} icon="sync" title="Sync Status Indicators" description="Green badge = All data safely synced to cloud; Amber badge = Syncing in progress; Red badge = Offline changes queued on device." />
                        <HelpStepCard stepNumber={3} icon="backup" title="Local Backup & Cloud Archival" description="Create complete encrypted JSON database backups in Settings > Backup, and restore on replacement devices anytime." />
                    </Accordion>
                )}

                <View className="h-14" />
            </ScrollView>
        </SafeAreaView>
    );
}
