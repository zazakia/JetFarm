import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable, Image, LayoutAnimation, Platform, UIManager } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HelpStepCard } from '../../src/components/HelpStepCard';

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

function HelpNote({ title, body }: { title: string; body: string }) {
    return (
        <View className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-5">
            <Text className="text-indigo-900 font-black text-xs uppercase tracking-[2px] mb-1">{title}</Text>
            <Text className="text-indigo-700 text-sm leading-6">{body}</Text>
        </View>
    );
}

function BulletList({ items }: { items: string[] }) {
    return (
        <View className="mb-5">
            {items.map((item) => (
                <View key={item} className="flex-row items-start mb-2.5">
                    <View className="w-1.5 h-1.5 rounded-full bg-blue-900 mt-2.5 mr-3" />
                    <Text className="flex-1 text-gray-600 text-sm leading-6">{item}</Text>
                </View>
            ))}
        </View>
    );
}

export default function AdminHelpScreen() {
    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <LinearGradient colors={['#1E3A8A', '#065F46']} className="pt-12 pb-6 px-6 rounded-b-[40px] shadow-sm">
                <Text className="text-white/90 text-xs font-bold uppercase tracking-[3px] mb-1">Help & Guide</Text>
                <Text className="text-white text-3xl font-black">Admin Help</Text>
                <Text className="text-white/70 text-sm font-medium mt-2">Detailed operating guide based on the current app modules and screens.</Text>
            </LinearGradient>

            <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                <Accordion title="Getting Started & Navigation" icon="home" defaultOpen={true}>
                    <Text className="text-gray-600 mb-4 leading-6">The admin portal is your control center for borrowers, loans, collections, remittances, reports, cash tracking, and system maintenance.</Text>
                    <HelpNote
                        title="What this role can access"
                        body="From the current codebase, admins can open the dashboard, borrowers, loans, payments, expenses, users, collectors, remittances, reports, cash on hand, bank accounts, deleted items, audit tools, updates, and settings."
                    />
                    <BulletList
                        items={[
                            'Use the dashboard as your daily start page. Pull down to refresh local metrics and trigger a manual sync when needed.',
                            'Use the menu button to open the full sidebar. The sidebar groups modules into Main, Admin, Daily Reports, Weekly Reports, Monthly Reports, Financials, and Support.',
                            'Tap the sync status badge in the header whenever you want to monitor sync health or open the Sync Center.',
                            'Use Support > Updates to review in-app release notes, and Support > Help & Guide whenever staff need process guidance.',
                            'If a module appears empty, first confirm you are online or run a manual sync, then refresh the page again.'
                        ]}
                    />
                    <HelpStepCard stepNumber={1} icon="dashboard" title="Start on Dashboard" description="Review KPIs, charts, overdue alerts, recent payments, and the quick action ribbon before moving into data-entry screens." />
                    <HelpStepCard stepNumber={2} icon="menu" title="Open the Sidebar" description="Use the menu to jump directly to Borrowers, Loans, Payments, Reports, Cash on Hand, Settings, and audit tools." />
                    <HelpStepCard stepNumber={3} icon="sync" title="Watch Sync Status" description="The sync indicator and Sync Center show whether the device is online, which table is syncing, and whether any errors need attention." />
                </Accordion>

                <Accordion title="Dashboard, KPIs & Quick Actions" icon="dashboard-customize">
                    <Text className="text-gray-600 mb-4 leading-6">The dashboard combines operational metrics with one-tap shortcuts so you can move from oversight into action quickly.</Text>
                    <Image
                        source={require('../../assets/help/admin_dashboard.png')}
                        className="w-full h-80 rounded-2xl border border-gray-200 mb-5 bg-gray-100"
                        resizeMode="cover"
                    />
                    <BulletList
                        items={[
                            'KPI tiles currently include Active Loans, Weekly Target, Outstanding, Total Disbursed, Overdue (PAR>30), Collected Today, This Month, Cash on Hand, and Borrowers.',
                            'Several KPI cards are drill-down entry points. For example, Weekly Target and Collected Today open collection reporting, while Cash on Hand opens the cash ledger module.',
                            'The quick action ribbon below the header jumps to frequently used modules such as remittances, new loan, new payment, new expense, disbursements, efficiency reports, and the cash box.',
                            'The overdue watchlist includes quick call, SMS, WhatsApp, and direct collect actions so you can resolve overdue accounts without leaving the dashboard.',
                            'Recent Payments gives a fast audit trail of the latest borrower payments and links back to borrower profiles.'
                        ]}
                    />
                    <HelpStepCard stepNumber={1} icon="insights" title="Review Live KPIs" description="Use the top metric grid to monitor growth, liquidity, and collection performance before approving new activity." />
                    <HelpStepCard stepNumber={2} icon="touch-app" title="Use Quick Actions" description="Tap the action ribbon to jump straight into common admin jobs like remittance review, loan release, payment entry, expense entry, or cash review." />
                    <HelpStepCard stepNumber={3} icon="warning" title="Work the Overdue Watchlist" description="Open late accounts, contact borrowers, or record collections directly from the dashboard when PAR starts increasing." />
                </Accordion>

                <Accordion title="Borrowers, Collectors, Users & Assignments" icon="people">
                    <Text className="text-gray-600 mb-4 leading-6">These modules define who is in the system and which collector is responsible for each borrower or loan.</Text>
                    <BulletList
                        items={[
                            'Borrowers can be created and searched from the Borrowers module. Borrower records include identifying details, address, and collector assignment.',
                            'The schema supports area and route index, so assigned borrowers can be ordered by route for field collection efficiency.',
                            'Collectors are managed separately and can be reviewed from the Collectors module. Their performance is also reflected in the dashboard and reports.',
                            'Users can be created with role-based access. The current codebase includes admin, collector, loan encoder, payment encoder, expenses encoder, and borrower roles.',
                            'Deleted Items and Audit Trail help you investigate changes instead of losing operational history.'
                        ]}
                    />
                    <HelpStepCard stepNumber={1} icon="person-add" title="Register Clean Borrower Records" description="Create the borrower first before releasing a loan so schedules, reports, and collector routing stay accurate." />
                    <HelpStepCard stepNumber={2} icon="directions-walk" title="Keep Collector Assignments Current" description="Borrower assignment, area, and route order affect field lists and collection sheets used by collectors." />
                    <HelpStepCard stepNumber={3} icon="manage-accounts" title="Manage Staff Access" description="Use the Users module to give the right role to each staff member and to keep collector-linked profiles in sync with auth access." />
                </Accordion>

                <Accordion title="Loans, Payments, Expenses & Cash Flow" icon="payments">
                    <Text className="text-gray-600 mb-4 leading-6">Core daily operations revolve around creating loans, recording payments, tracking expenses, and keeping cash balances accurate.</Text>
                    <HelpStepCard stepNumber={1} icon="receipt-long" title="Create New Loans" description="From New Loan, choose a registered borrower, enter principal, interest, term, and frequency, then review the generated schedule before disbursing." />
                    <HelpStepCard stepNumber={2} icon="calculate" title="Review Loan Calculations" description="The loan form computes installment amount and maturity date so you can verify repayment terms before release." />
                    <HelpStepCard stepNumber={3} icon="payments" title="Record or Edit Payments" description="Use the Payments module to enter collections manually, including cases linked from overdue actions or borrower records." />
                    <HelpStepCard stepNumber={4} icon="account-balance-wallet" title="Track Cash Movement" description="Cash on Hand reflects explicit cash ledger movement. Approved remittances increase admin cash, while expenses and other cash activity reduce it." />
                    <HelpStepCard stepNumber={5} icon="receipt" title="Capture Expenses" description="Use the Expenses module for operating costs, then review category-based reporting from the expense reports and settings." />
                    <BulletList
                        items={[
                            'Loan details screens expose borrower links, collector assignment, payment schedules, and related records such as previous loans or passbook access where applicable.',
                            'The remittance review module is where pending collector cash submissions are approved or rejected. Approval moves the money into the admin cash position.',
                            'Bank Accounts and Savings Portfolio are grouped under Financials for broader cash and portfolio monitoring.',
                            'Because payment schedules can be pending, late, partial, or paid, always verify the latest status before editing a payment record.'
                        ]}
                    />
                </Accordion>

                <Accordion title="Reports, Analytics & Monthly Controls" icon="bar-chart">
                    <Text className="text-gray-600 mb-4 leading-6">The reporting area is organized by operational cadence so you can move from daily monitoring into weekly and monthly financial review.</Text>
                    <BulletList
                        items={[
                            'Daily and real-time reporting includes the reports overview and expense breakdown.',
                            'Weekly operations include consolidated collection sheets, active loan collection views, and weekly collection reporting.',
                            'Monthly performance includes Financial Summary, Collector Efficiency, Portfolio Aging, MFI Metrics, Income Statement, Balance Sheet, Disbursement History, and Savings.',
                            'The MFI metrics screens help track sustainability and risk indicators, while Portfolio Aging highlights overdue buckets used for PAR analysis.',
                            'Monthly Financial Closing is available from Settings when you need to lock in a financial snapshot for a reporting period.'
                        ]}
                    />
                    <HelpStepCard stepNumber={1} icon="assessment" title="Use Reports Overview" description="Start with the overview screen to choose the correct report family before drilling into deeper financial analysis." />
                    <HelpStepCard stepNumber={2} icon="assignment-late" title="Review Portfolio Aging" description="Track overdue buckets, late accounts, and PAR-related exposure to catch deterioration early." />
                    <HelpStepCard stepNumber={3} icon="trending-up" title="Monitor Collector Efficiency" description="Compare collector performance, collection rates, and cash handling using the current reporting screens." />
                </Accordion>

                <Accordion title="Sync, Backup, Restore & Data Safety" icon="sync">
                    <Text className="text-gray-600 mb-4 leading-6">The app is offline-first. Every device works locally first, then exchanges updates with the Supabase backend when online.</Text>
                    <HelpStepCard stepNumber={1} icon="cloud-download" title="Pull Latest Cloud Changes" description="Manual sync downloads new or updated data from the server, including work submitted by other devices or staff." />
                    <HelpStepCard stepNumber={2} icon="cloud-upload" title="Push Local Changes" description="Records created or updated locally are uploaded during sync so the rest of the team receives current data." />
                    <HelpStepCard stepNumber={3} icon="history" title="Review Sync Logs" description="Open Sync Center to inspect per-table progress, row counts, timestamps, current model, and the last sync error if something fails." />
                    <HelpStepCard stepNumber={4} icon="backup" title="Protect Critical Data" description="Settings includes local backup export, restore from file, cloud backup, cloud merge, audit tools, and last-resort local database reset controls." />
                    <BulletList
                        items={[
                            'Manual backup exports local data. Restore can merge data or wipe local data first, depending on the option you choose.',
                            'Cloud backup and cloud merge affect the live Supabase database for all users, so use them carefully and only with the right admin authority.',
                            'Deleted records are soft-deleted rather than permanently removed, which helps preserve history and supports audit tools.',
                            'Use Data Integrity Audit and Audit Trail before doing destructive maintenance, especially if staff report missing or inconsistent figures.'
                        ]}
                    />
                </Accordion>

                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
