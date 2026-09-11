import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

type TabItem = {
    label: string;
    route: string;
    icon: keyof typeof MaterialIcons.glyphMap;
};

function normalizeAccountingPath(path: string): string {
    const cleaned = path.replace('/(admin)', '').replace(/\/$/, '');
    return cleaned || '/';
}

const TABS: TabItem[] = [
    { label: 'Dashboard', route: '/(admin)/accounting', icon: 'dashboard' },
    { label: 'CRJ (Cash Receipts)', route: '/(admin)/accounting/crj', icon: 'receipt' },
    { label: 'CDJ (Disbursements)', route: '/(admin)/accounting/cdj', icon: 'outbox' },
    { label: 'AR Ledger', route: '/(admin)/accounting/ar-ledger', icon: 'people-alt' },
    { label: 'AP Journal', route: '/(admin)/accounting/ap-journal', icon: 'payments' },
    { label: 'Sales Journal', route: '/(admin)/accounting/sales-journal', icon: 'store' },
    { label: 'Purchase Journal', route: '/(admin)/accounting/purchase-journal', icon: 'shopping-cart' },
    { label: 'Inventory Journal', route: '/(admin)/accounting/inventory-journal', icon: 'inventory-2' },
    { label: 'Suppliers', route: '/(admin)/accounting/suppliers', icon: 'business' },
    { label: 'Chart of Accounts', route: '/(admin)/accounting/chart-of-accounts', icon: 'format-list-numbered' },
    { label: 'Journal Entries', route: '/(admin)/accounting/journal-entries', icon: 'book' },
    { label: 'General Ledger', route: '/(admin)/accounting/general-ledger', icon: 'account-tree' },
    { label: 'Trial Balance', route: '/(admin)/accounting/trial-balance', icon: 'balance' },
];

export default function AccountingLayout() {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <View className="flex-1 bg-gray-50">
            {/* Top Sub-navigation Tabs */}
            <View className="bg-white border-b border-gray-200">
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16 }}
                >
                    <View className="flex-row py-2">
                        {TABS.map((tab) => {
                            const current = normalizeAccountingPath(pathname);
                            const target = normalizeAccountingPath(tab.route);
                            const isActive = target === '/accounting'
                                ? current === '/accounting'
                                : current === target || current.startsWith(target + '/');

                            return (
                                <Pressable
                                    key={tab.route}
                                    onPress={() => router.push(tab.route as any)}
                                    className={`flex-row items-center px-4 py-2.5 rounded-full mr-2 ${
                                        isActive ? 'bg-blue-900' : 'bg-transparent active:bg-gray-100'
                                    }`}
                                >
                                    <MaterialIcons
                                        name={tab.icon}
                                        size={18}
                                        color={isActive ? '#FFFFFF' : '#4B5563'}
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text
                                        className={`text-sm font-bold ${
                                            isActive ? 'text-white' : 'text-gray-700'
                                        }`}
                                    >
                                        {tab.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>

            {/* Child Screen Slot */}
            <View className="flex-1">
                <Slot />
            </View>
        </View>
    );
}

export { RouteErrorBoundary as ErrorBoundary } from '../../../src/components/RouteErrorBoundary';
