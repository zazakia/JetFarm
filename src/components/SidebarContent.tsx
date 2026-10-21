import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, SafeAreaView, TextInput, Linking } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import { AppLogo } from './AppLogo';
import { useFeatureFlags, useRolePermissions } from '../hooks/useSettingsConfig';
import { isAgri } from '../config/deployment';
import { COMPANY_NAME } from '../constants/brand';
import { getAppVersion, APP_BUILD_NUMBER, APP_DOWNLOAD_URL } from '../constants/AppVersion';
import { useOnboardingTour } from '../context/OnboardingTourContext';

export type MenuItem = {
    icon: keyof typeof MaterialIcons.glyphMap;
    label: string;
    route: string;
    featureKey?: string;
    permissionKey?: string;
};

// ==========================================
// 0. AGRIBUSINESS OUTGROWER PLATFORM (AGRI-ONE)
// ==========================================
// Every route below is one of the 13 screens under app/(admin)/agribusiness/. Adding an entry here
// without the file, or deleting the file without the entry, fails
// src/__tests__/agribusinessNavWhitelist.test.ts.
export const AGRIBUSINESS_MENU: MenuItem[] = [
    { icon: 'eco', label: 'Operator Command Center', route: '/(admin)/agribusiness' },
    { icon: 'landscape', label: 'Land Parcels Registry', route: '/(admin)/agribusiness/parcels' },
    { icon: 'map', label: 'GPS Boundary Mapping', route: '/(admin)/agribusiness/mapping' },
    { icon: 'grass', label: 'Cassava Crop Cycles', route: '/(admin)/agribusiness/cycles' },
    { icon: 'scale', label: 'Harvest Scale Terminal', route: '/(admin)/agribusiness/harvest' },
    { icon: 'receipt-long', label: 'Land Owner Settlements', route: '/(admin)/agribusiness/settlements' },
    { icon: 'attach-money', label: 'BioGreen Investor Ledger', route: '/(admin)/agribusiness/investors' },
    { icon: 'engineering', label: 'Farm Labor Ledger', route: '/(admin)/agribusiness/labor' },
    { icon: 'groups', label: 'Farm Laborers & Staff', route: '/(admin)/agribusiness/workers' },
    { icon: 'receipt', label: 'Farm Input Expenses', route: '/(admin)/agribusiness/expenses' },
    { icon: 'account-balance', label: 'Farm Accounting', route: '/(admin)/agribusiness/accounting' },
    { icon: 'insights', label: 'P&L & Yield Analytics', route: '/(admin)/agribusiness/analytics' },
    { icon: 'assignment-turned-in', label: 'Implementation Report', route: '/(admin)/agribusiness/implementation-report' },
];

// ==========================================
// 1. FINANCIAL STATEMENTS
// ==========================================
// The lending, collector and coop share-capital report families were deleted with their screens;
// this list is the 10 files that remain under app/(admin)/reports/.
export const FINANCIAL_REPORTS_MENU: MenuItem[] = [
    { icon: 'account-balance', label: 'Balance Sheet', route: '/(admin)/reports/balance-sheet', featureKey: 'module.reports' },
    { icon: 'receipt', label: 'Income Statement', route: '/(admin)/reports/income-statement', featureKey: 'module.reports' },
    { icon: 'waterfall-chart', label: 'Cash Flows', route: '/(admin)/reports/cash-flows', featureKey: 'module.reports' },
    { icon: 'show-chart', label: 'Changes in Equity', route: '/(admin)/reports/changes-in-equity', featureKey: 'module.reports' },
    { icon: 'menu-book', label: 'Notes to the Financial Statements', route: '/(admin)/reports/notes-to-fs', featureKey: 'module.reports' },
    { icon: 'auto-stories', label: 'Annual Financial Report', route: '/(admin)/reports/annual-report', featureKey: 'module.reports' },
    { icon: 'table-chart', label: 'Statutory Reserves', route: '/(admin)/reports/statutory-reserves', featureKey: 'module.reports' },
    { icon: 'bar-chart', label: 'Expense Breakdown', route: '/(admin)/reports/expenses', featureKey: 'module.reports' },
    { icon: 'compare-arrows', label: 'Segment Comparison', route: '/(admin)/reports/segment-comparison', featureKey: 'module.reports' },
    { icon: 'date-range', label: 'Period Settings', route: '/(admin)/reports/period-settings', featureKey: 'module.reports' },
];

// ==========================================
// 2. CORE OPERATIONS
// ==========================================
export const MAIN_MENU: MenuItem[] = [
    { icon: 'account-balance-wallet', label: 'Operating Expenses', route: '/(admin)/expenses', featureKey: 'module.expenses' },
];

// ==========================================
// 3. FINANCIALS & VAULT MANAGEMENT
// ==========================================
export const FINANCIALS_MENU: MenuItem[] = [
    { icon: 'account-balance', label: 'Cash on Hand & Vault', route: '/(admin)/cash-on-hand', featureKey: 'module.cash_on_hand' },
    { icon: 'savings', label: 'Petty Cash Fund', route: '/(admin)/cash-on-hand/petty-cash', featureKey: 'module.cash_on_hand' },
    { icon: 'account-balance-wallet', label: 'Bank Accounts', route: '/(admin)/bank-accounts', featureKey: 'module.bank_accounts' },
    { icon: 'swap-horiz', label: 'Cash Transfers', route: '/(admin)/transfers', featureKey: 'module.cash_on_hand' },
];

// ==========================================
// 4. ACCOUNTING & GENERAL LEDGER
// ==========================================
export const ACCOUNTING_MENU: MenuItem[] = [
    { icon: 'menu-book', label: 'Accounting Overview', route: '/(admin)/accounting', featureKey: 'module.accounting' },
    { icon: 'format-list-numbered', label: 'Chart of Accounts', route: '/(admin)/accounting/chart-of-accounts', featureKey: 'module.accounting' },
    { icon: 'book', label: 'Journal Entries', route: '/(admin)/accounting/journal-entries', featureKey: 'module.accounting' },
    { icon: 'account-tree', label: 'General Ledger', route: '/(admin)/accounting/general-ledger', featureKey: 'module.accounting' },
    { icon: 'balance', label: 'Trial Balance', route: '/(admin)/accounting/trial-balance', featureKey: 'module.accounting' },
];

// ==========================================
// 5. BOOKS OF ACCOUNTS
// ==========================================
export const BOOKS_OF_ACCOUNTS_MENU: MenuItem[] = [
    { icon: 'receipt', label: 'Cash Receipts (CRJ)', route: '/(admin)/accounting/crj', featureKey: 'module.accounting' },
    { icon: 'outbox', label: 'Disbursements (CDJ)', route: '/(admin)/accounting/cdj', featureKey: 'module.accounting' },
    { icon: 'people-alt', label: 'AR Ledger', route: '/(admin)/accounting/ar-ledger', featureKey: 'module.accounting' },
    { icon: 'payments', label: 'AP Journal', route: '/(admin)/accounting/ap-journal', featureKey: 'module.accounting' },
    { icon: 'store', label: 'Sales Journal', route: '/(admin)/accounting/sales-journal', featureKey: 'module.accounting' },
    { icon: 'shopping-cart', label: 'Purchase Journal', route: '/(admin)/accounting/purchase-journal', featureKey: 'module.accounting' },
    { icon: 'inventory-2', label: 'Inventory Journal', route: '/(admin)/accounting/inventory-journal', featureKey: 'module.accounting' },
    { icon: 'business', label: 'Suppliers Masterlist', route: '/(admin)/accounting/suppliers', featureKey: 'module.accounting' },
];

// ==========================================
// 6. ADMIN & SYSTEM CONTROLS
// ==========================================
export const ADMIN_MENU: MenuItem[] = [
    { icon: 'storage', label: 'Data Maintenance & Lookups', route: '/(admin)/settings/data-maintenance' },
    { icon: 'manage-accounts', label: 'User Roles & Access', route: '/(admin)/users' },
    { icon: 'history', label: 'Audit Trail', route: '/(admin)/settings/audit-trail' },
    { icon: 'delete-outline', label: 'Deleted Items', route: '/(admin)/settings/deleted' },
    { icon: 'settings', label: 'System Settings', route: '/(admin)/settings' },
];

export const SUPPORT_MENU: MenuItem[] = [
    { icon: 'campaign', label: 'System Updates', route: '/(admin)/settings/updates' },
    { icon: 'help-outline', label: 'Help & Operational Guide', route: '/(admin)/help' },
    { icon: 'menu-book', label: 'Operations Manual', route: '/(admin)/member-manual' },
];

function NavItem({ item, isActive, onPress }: { item: MenuItem; isActive: boolean; onPress: () => void }) {
    return (
        <Pressable
            onPress={onPress}
            className={`flex-row items-center p-3 rounded-lg mb-1 mx-2 ${
                isActive ? 'bg-white/10' : 'hover:bg-white/5 active:bg-white/10'
            }`}
        >
            <MaterialIcons
                name={item.icon}
                size={24}
                color={isActive ? '#FFFFFF' : 'rgba(255,255,255,0.7)'}
                className="mr-3"
            />
            <Text className={`text-sm tracking-wide ${isActive ? 'text-white font-bold' : 'text-white/90 font-medium'}`}>
                {item.label}
            </Text>
        </Pressable>
    );
}

export function SidebarContent({ onClose }: { onClose?: () => void }) {
    const router = useRouter();
    const pathname = usePathname();
    const { signOut, role } = useAuth();
    const { isEnabled } = useFeatureFlags();
    const { isAllowed } = useRolePermissions(role);
    const tour = useOnboardingTour();
    const [searchQuery, setSearchQuery] = useState('');

    const normalizePath = (p: string) => {
        const clean = p.replace('/(admin)', '');
        return clean === '' ? '/' : clean;
    };
    const currentPath = normalizePath(pathname);

    const handlePress = (route: string) => {
        router.push(route as any);
        if (onClose) onClose();
    };

    // isAgri() is the build selector (EXPO_PUBLIC_BUSINESS_TYPE). This branch only ships the
    // agribusiness screens, so a bundle baked with the old POS or cooperative value shows an empty
    // drawer rather than a menu of routes that were deleted from the app tree.
    const canShow = (item: MenuItem) =>
        isAgri() && isEnabled(item.featureKey) && isAllowed(item.permissionKey ?? item.featureKey);

    const renderMenuSection = (title: string, items: MenuItem[], highlight = false) => {
        const visibleItems = items.filter(canShow).filter((item) =>
            searchQuery === '' || item.label.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (visibleItems.length === 0) return null;
        return (
            <View className={`mb-4 ${highlight ? 'bg-white/5 py-2 rounded-2xl mx-1 mb-5' : ''}`}>
                <View className="flex-row items-center px-4 mb-2">
                    {highlight && <View className="w-1.5 h-3.5 bg-amber-400 rounded-full mr-2" />}
                    <Text
                        className={`text-[10px] uppercase font-black tracking-widest ${
                            highlight ? 'text-amber-300' : 'text-white/70'
                        }`}
                    >
                        {title}
                    </Text>
                </View>
                {visibleItems.map((item) => {
                    const itemPath = normalizePath(item.route);
                    const isActive = itemPath === '/' ? currentPath === '/' : currentPath.startsWith(itemPath);
                    return (
                        <NavItem
                            key={item.route}
                            item={item}
                            isActive={isActive}
                            onPress={() => handlePress(item.route)}
                        />
                    );
                })}
            </View>
        );
    };

    return (
        <View className="flex-1 bg-blue-900">
            <SafeAreaView className="flex-1">
                <View className="p-4 items-center justify-center mb-2 h-24 mt-2">
                    <View className="bg-white rounded-xl px-3 py-2">
                        <AppLogo size="sm" layout="horizontal" />
                    </View>
                </View>

                <View className="px-4 pb-4 border-b border-white/10 mb-2">
                    <View className="flex-row items-center bg-black/20 rounded-xl px-3 py-1">
                        <MaterialIcons name="search" size={20} color="rgba(255,255,255,0.5)" />
                        <TextInput
                            className="flex-1 ml-2 text-white h-10"
                            placeholder="Search menus & features..."
                            placeholderTextColor="rgba(255,255,255,0.5)"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            clearButtonMode="while-editing"
                        />
                        {searchQuery !== '' && (
                            <Pressable onPress={() => setSearchQuery('')} className="p-1">
                                <MaterialIcons name="close" size={16} color="rgba(255,255,255,0.5)" />
                            </Pressable>
                        )}
                    </View>
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    {/* Agribusiness Outgrower Platform */}
                    {renderMenuSection('Agribusiness Outgrower Platform', AGRIBUSINESS_MENU, true)}

                    {/* Financial Statements */}
                    {renderMenuSection('Financial Statements', FINANCIAL_REPORTS_MENU)}

                    {/* General Operations */}
                    {renderMenuSection('Core Operations', MAIN_MENU)}
                    {renderMenuSection('Financials & Vault', FINANCIALS_MENU)}

                    {/* Accounting */}
                    {renderMenuSection('Accounting & General Ledger', ACCOUNTING_MENU)}
                    {renderMenuSection('Books of Accounts', BOOKS_OF_ACCOUNTS_MENU)}

                    {/* System Administration */}
                    {renderMenuSection('System Administration', ADMIN_MENU)}
                    {renderMenuSection('Support & Guides', SUPPORT_MENU)}

                    {/* Interactive Guided Tour Quick-Launcher */}
                    <View className="px-4 py-2 mb-2">
                        <Pressable
                            testID="sidebar-start-tour-button"
                            onPress={() => {
                                if (onClose) onClose();
                                tour?.startTour();
                            }}
                            className="flex-row items-center p-3 rounded-xl bg-blue-800/80 active:bg-blue-700 border border-blue-600/40"
                        >
                            <MaterialIcons name="explore" size={20} color="#60A5FA" className="mr-2.5" />
                            <View className="flex-1">
                                <Text className="text-white font-bold text-xs">Take Guided Tour</Text>
                                <Text className="text-blue-200 text-[10px]">60-sec platform walkthrough</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={18} color="#93C5FD" />
                        </Pressable>
                    </View>
                </ScrollView>

                <View className="p-4 border-t border-white/10">
                    <Pressable
                        onPress={signOut}
                        testID="logout-button"
                        className="flex-row items-center p-3 rounded-lg bg-red-500/20 active:bg-red-500/30"
                    >
                        <MaterialIcons name="logout" size={20} color="#EF5350" className="mr-3" />
                        <Text className="text-red-400 font-bold text-sm">Sign Out</Text>
                    </Pressable>
                    <View className="mt-3 items-center">
                        <Text className="text-white/60 text-xs font-semibold">
                            {COMPANY_NAME} v{getAppVersion()} • Build {APP_BUILD_NUMBER}
                        </Text>
                        <Pressable
                            onPress={() => Linking.openURL(APP_DOWNLOAD_URL)}
                            className="mt-1"
                            accessibilityRole="link"
                        >
                            <Text className="text-emerald-400 text-xs font-bold">
                                Download Latest APK
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
}
