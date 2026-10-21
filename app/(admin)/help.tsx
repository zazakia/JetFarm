import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable, LayoutAnimation, Platform, UIManager, TextInput, Alert, ActivityIndicator } from 'react-native';
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
    { id: 'agri', label: '🌾 Farm Operations', icon: 'eco' },
    { id: 'settlement', label: '🧾 Harvest & Settlements', icon: 'event-note' },
    { id: 'accounting', label: '💰 Accounting & Ledger', icon: 'menu-book' },
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
                Alert.alert('Demo Data Loaded!', 'Realistic mock data (parcels, crop cycles, harvest settlements, farm labor, farm expenses, chart of accounts and journal entries) has been seeded into your local database.');
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
                    Master farm operations, harvest settlements, the general ledger and offline field work.
                </Text>

                {/* Real-time Search Input */}
                <View className="mt-4 flex-row items-center bg-white rounded-2xl px-4 py-2.5 shadow-sm">
                    <MaterialIcons name="search" size={20} color="#9CA3AF" />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search workflows, screens, or instructions..."
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
                        Need a refresher or onboarding a new teammate? Replay the guided walkthrough across the farm command center, yield analytics and the general ledger.
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
                                        ? `Active Demo Data: ${sampleStatus.active} records populated across farm and finance modules`
                                        : 'No demo data loaded yet — load with 1 tap'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <Text className="text-emerald-900/80 text-xs leading-5 mb-4">
                        Populate the system with realistic Philippine agricultural parcels, crop cycles, harvest logs, weekly settlements, farm labor logs, farm expenses and journal entries to immediately test and explore every screen.
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
                                        {sampleStatus?.enabled ? 'Hide All Demo Data' : 'Load Demo Data'}
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

                {/* 1. Getting Started & Navigation */}
                {(showCategory('all') || selectedCategory === 'all') && matchesSearch(['dashboard', 'start', 'navigation', 'sidebar', 'sync', 'roles'], 'Getting Started & Navigation') && (
                    <Accordion title="1. Getting Started & App Navigation" icon="home" defaultOpen={true}>
                        <Text className="text-gray-600 mb-4 leading-6">
                            Agri-One is an offline-first agribusiness operations and accounting system. It runs completely offline using local persistence and synchronizes with the cloud whenever internet is available.
                        </Text>
                        <HelpNote
                            title="Roles"
                            body="Admins have full oversight of farm operations and the ledger. Main Office users work from the head-office screens. Expenses Encoders record farm expenses and their disbursements."
                        />
                        <BulletList
                            items={[
                                'Daily Start: Pull down to refresh your dashboard metrics and trigger an instant background sync.',
                                'Full Navigation: Tap the Menu icon in the top left to open the sidebar with the farm and finance groups.',
                                'Branch & Warehouse Switcher: Use the branch switcher chip in the header to change active branch context.',
                                'Sync Status Badge: Top right. Green = fully synced; orange = pending; red = offline queue.',
                                'Drill-downs: Every card opens a clean detail modal — parcels, cycles, settlements and journal entries.'
                            ]}
                        />
                        <HelpStepCard stepNumber={1} icon="dashboard" title="Review Live Dashboard KPIs" description="Monitor active hectares, standing crop cycles, harvest tonnage, settlement status and cash balances before taking action." />
                        <HelpStepCard stepNumber={2} icon="menu" title="Open the Sidebar Menu" description="Browse the modules grouped into Agribusiness, Accounting & General Ledger, Reports and Settings." />
                        <HelpStepCard stepNumber={3} icon="sync" title="Monitor Sync Convergence" description="Records created locally are saved offline immediately and synced automatically once the device connects." />
                    </Accordion>
                )}

                {/* 2. Farm Operations */}
                {(showCategory('agri') || selectedCategory === 'all') && matchesSearch(['agri', 'agribusiness', 'farm', 'parcel', 'crop', 'cycle', 'mapping', 'worker', 'labor', 'expense'], 'Farm Operations & Crop Cycles') && (
                    <Accordion title="2. 🌾 Farm Operations & Crop Cycles" icon="eco" defaultOpen={selectedCategory === 'agri'}>
                        <Text className="text-gray-600 mb-4 leading-6">
                            The Agribusiness command center coordinates land parcels, crop cycles (e.g. High-Starch Cassava KU50), farm workers, labor logs and input costs.
                        </Text>
                        <HelpNote
                            title="Core Agricultural Flow"
                            variant="emerald"
                            body="1. Register Land Parcel -> 2. Map Boundary & Blocks -> 3. Create Crop Cycle -> 4. Log Labor & Input Expenses -> 5. Record Harvest Weigh-ins -> 6. Generate Weekly Settlements."
                        />
                        <HelpStepCard stepNumber={1} icon="landscape" title="Land Parcels Registry" description="Register parcels with code, hectares, soil type (Sandy Loam, Clay Loam), land owner association and GPS boundary markers." />
                        <HelpStepCard stepNumber={2} icon="map" title="Boundary Mapping & Blocks" description="Draw boundaries on the map, split large parcels into blocks and keep every boundary or layout edit as a new revision." />
                        <HelpStepCard stepNumber={3} icon="agriculture" title="Crop Cycles" description="Open a cycle with planting date, target harvest date, variety, expected yield in kg, capital allocated and the agreed offtake price per kg." />
                        <HelpStepCard stepNumber={4} icon="engineering" title="Farm Workers & Labor Logs" description="Keep worker profiles (specialization, daily rate) and log field tasks — plowing, weeding, spraying, harvesting — by time or piece rate." />
                        <HelpStepCard stepNumber={5} icon="money-off" title="Farm Expenses" description="Record input costs (fertilizer, seeds, fuel, haulage) against a crop cycle and optionally a parcel so per-cycle cost of production stays accurate." />
                        <BulletList
                            items={[
                                'Command Center: Real-time active hectares, ongoing cycles, total yield in kg and settlement status.',
                                'Yield & P&L Analytics: Cost per hectare, gross margin per cycle, planned vs actual yield, block progress.',
                                'Offline Field Friendly: Log labor and expenses out in rural fields with zero connectivity.'
                            ]}
                        />
                    </Accordion>
                )}

                {/* 3. Harvest & Settlements */}
                {(showCategory('settlement') || selectedCategory === 'all') && matchesSearch(['harvest', 'weigh', 'settlement', 'land owner', 'investor', 'offtake', 'guaranteed'], 'Harvest, Settlements & Capital Partners') && (
                    <Accordion title="3. 🧾 Harvest, Settlements & Capital Partners" icon="event-note" defaultOpen={selectedCategory === 'settlement'}>
                        <Text className="text-gray-600 mb-4 leading-6">
                            Harvest weigh-ins feed the weekly settlement engine, which pays land owners by kilo and reports partner shares from the offtake.
                        </Text>
                        <HelpNote
                            title="Settlement Computation"
                            variant="indigo"
                            body="Net kilos = gross − tare. Cumulative kilos × rate per kilo = raw kilo earnings. Target cumulative payout = max(raw earnings, guaranteed minimum). Net payout due this week = target − previous cumulative payout."
                        />
                        <HelpStepCard stepNumber={1} icon="scale" title="Digital Harvest Weigh-in" description="Record truck weigh-ins: gross weight, tare weight, net kilos, quality grade, truck plate, supervisor and photo evidence." />
                        <HelpStepCard stepNumber={2} icon="event-note" title="Weekly Land Owner Settlements" description="Generate the weekly settlement per cycle, confirm the guaranteed minimum floor, then mark it paid with a disbursement date and receipt reference." />
                        <HelpStepCard stepNumber={3} icon="groups" title="Capital Partners & Ledgers" description="Track BioGreen partner investments, kilos received, price per kg and the running balance per cycle in the investor ledger." />
                        <HelpStepCard stepNumber={4} icon="assessment" title="Yield & Implementation Reports" description="Produce the implementation report and yield analytics for land owners, partners and auditors." />
                    </Accordion>
                )}

                {/* 4. Accounting & General Ledger */}
                {(showCategory('accounting') || selectedCategory === 'all') && matchesSearch(['accounting', 'ledger', 'cash', 'bank', 'journal', 'coa', 'crj', 'cdj', 'statement'], 'Accounting & General Ledger') && (
                    <Accordion title="4. 💰 Accounting, Cash & General Ledger" icon="menu-book" defaultOpen={selectedCategory === 'accounting'}>
                        <Text className="text-gray-600 mb-4 leading-6">
                            Double-entry accounting with strict balance enforcement. Manages cash on hand, petty cash, bank accounts, suppliers and the certified books of account.
                        </Text>
                        <HelpNote
                            title="Strict Double-Entry Rule"
                            variant="indigo"
                            body="Every journal entry must balance: total debits equal total credits exactly. The rule is enforced at both the client service and the database trigger level."
                        />
                        <HelpStepCard stepNumber={1} icon="account-balance-wallet" title="Cash On Hand & Petty Cash" description="Track physical cash positions; expense disbursements reduce cash while collections and partner funding increase it." />
                        <HelpStepCard stepNumber={2} icon="account-balance" title="Bank Accounts & Transfers" description="Maintain corporate bank accounts (e.g. BDO, PNB) with opening balances, transactions and internal transfers between cash and bank." />
                        <HelpStepCard stepNumber={3} icon="format-list-numbered" title="Chart of Accounts & Journals" description="Farm chart of accounts, journal entries, Cash Receipts Journal (CRJ), Cash Disbursements Journal (CDJ), sales and purchase journals." />
                        <HelpStepCard stepNumber={4} icon="assessment" title="Audited Financial Statements" description="Generate the Balance Sheet, Income Statement, Statement of Cash Flows, Changes in Equity and Notes to the Financial Statements." />
                    </Accordion>
                )}

                {/* 5. Offline-First & Cloud Sync */}
                {(showCategory('sync') || selectedCategory === 'all') && matchesSearch(['sync', 'offline', 'backup', 'restore', 'cloud', 'supabase'], 'Offline Resilience & Cloud Sync') && (
                    <Accordion title="5. 🔄 Offline-First Architecture & Cloud Sync" icon="sync" defaultOpen={selectedCategory === 'sync'}>
                        <Text className="text-gray-600 mb-4 leading-6">
                            Agri-One is engineered for Philippine rural conditions where connectivity is intermittent or unavailable.
                        </Text>
                        <HelpNote
                            title="Zero-Lag Local First"
                            variant="emerald"
                            body="Every write — parcel edits, harvest weigh-ins, labor logs, expenses, journal entries — lands in the local database instantly in under 5ms. No spinners, no waiting for internet."
                        />
                        <HelpStepCard stepNumber={1} icon="cloud-download" title="Automatic Two-Way Sync" description="When a connection is detected, the sync engine exchanges changes with the cloud using Last-Write-Wins in strict relational dependency order." />
                        <HelpStepCard stepNumber={2} icon="sync" title="Sync Status Indicators" description="Green badge = all data safely synced; amber badge = syncing; red badge = offline changes queued on the device." />
                        <HelpStepCard stepNumber={3} icon="backup" title="Local Backup & Restore" description="Create encrypted database backups in Settings > Backup and restore them on a replacement device anytime." />
                    </Accordion>
                )}

                <View className="h-14" />
            </ScrollView>
        </SafeAreaView>
    );
}
