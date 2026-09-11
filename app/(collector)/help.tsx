import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable, Image, Platform, UIManager, StatusBar } from 'react-native';
import { useAuth } from '../../src/store/AuthContext';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { HelpStepCard } from '../../src/components/HelpStepCard';
import { LinearGradient } from 'expo-linear-gradient';
import { SyncStatusIndicator } from '../../src/components/SyncStatusIndicator';
import Animated, { FadeInUp, FadeInDown, Layout, ZoomIn } from 'react-native-reanimated';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { useRouter } from 'expo-router';
import { safeBack } from '../../src/utils/navigation';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

function Accordion({ title, icon, children, defaultOpen = false, delay = 0, sunlightMode }: any) {
    const [expanded, setExpanded] = useState(defaultOpen);
    const color = '#4F46E5';

    const toggle = () => {
        setExpanded(!expanded);
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(delay).springify()}
            layout={Layout.springify()}
            className={`${sunlightMode ? 'bg-white border-4 border-black' : 'bg-white shadow-sm border-gray-50'} rounded-[40px] overflow-hidden mb-6`}
        >
            <Pressable onPress={toggle} className={`flex-row items-center p-6 ${sunlightMode ? 'active:bg-gray-100' : 'active:bg-gray-50'}`}>
                <View
                    style={!sunlightMode ? { backgroundColor: `${color}10` } : undefined}
                    className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${sunlightMode ? 'bg-black' : ''}`}
                >
                    <MaterialIcons name={icon} size={24} color={sunlightMode ? '#FFF' : color} />
                </View>
                <Text className={`flex-1 font-black text-lg tracking-tight ${sunlightMode ? 'text-black' : 'text-gray-900'}`}>{title}</Text>
                <View className={`w-8 h-8 rounded-full items-center justify-center ${sunlightMode ? (expanded ? 'bg-black' : 'bg-white border-2 border-black') : (expanded ? 'bg-indigo-50' : 'bg-gray-50')}`}>
                    <MaterialIcons
                        name={expanded ? 'expand-less' : 'expand-more'}
                        size={20}
                        color={sunlightMode ? (expanded ? '#FFF' : '#000') : (expanded ? color : '#94A3B8')}
                    />
                </View>
            </Pressable>
            {expanded && (
                <Animated.View
                    entering={FadeInUp.duration(300)}
                    className="px-6 pb-6 pt-2 border-t border-gray-50 bg-white"
                >
                    {children}
                </Animated.View>
            )}
        </Animated.View>
    );
}

function HelpNote({ title, body, sunlightMode }: { title: string; body: string; sunlightMode: boolean }) {
    return (
        <View className={`rounded-[24px] p-4 border mb-5 ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-indigo-50 border-indigo-100'}`}>
            <Text className={`${sunlightMode ? 'text-black' : 'text-indigo-900'} font-black text-[10px] uppercase tracking-[2px] mb-1`}>{title}</Text>
            <Text className={`${sunlightMode ? 'text-black' : 'text-indigo-700'} text-sm leading-6 font-bold`}>{body}</Text>
        </View>
    );
}

function BulletList({ items, sunlightMode }: { items: string[]; sunlightMode: boolean }) {
    return (
        <View className="mb-5">
            {items.map((item) => (
                <View key={item} className="flex-row items-start mb-2.5">
                    <View className={`w-1.5 h-1.5 rounded-full mt-2.5 mr-3 ${sunlightMode ? 'bg-black' : 'bg-indigo-500'}`} />
                    <Text className={`flex-1 text-sm leading-6 ${sunlightMode ? 'text-black font-black' : 'text-gray-700 font-bold'}`}>{item}</Text>
                </View>
            ))}
        </View>
    );
}

export default function CollectorHelpScreen() {
    const router = useRouter();
    const { sunlightMode } = useAuth();
    return (
        <SafeAreaView className={`flex-1 ${sunlightMode ? 'bg-white' : 'bg-slate-50'}`}>
            <StatusBar barStyle={sunlightMode ? 'dark-content' : 'light-content'} />
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {sunlightMode ? (
                    <View className="pt-12 pb-24 px-6 rounded-b-[48px] bg-white border-b-4 border-black mb-8">
                        <View className="flex-row justify-between items-center mb-6">
                            <View className="flex-row items-center">
                                <AnimatedPressable 
                                    onPress={() => safeBack(router, '/(collector)')} 
                                    className="bg-black w-11 h-11 rounded-2xl items-center justify-center mr-4 border-2 border-black"
                                >
                                    <MaterialIcons name="arrow-back" size={24} color="#FFF" />
                                </AnimatedPressable>
                                <View>
                                    <Text className="text-black text-[10px] font-black uppercase tracking-[2px]">Help & Guide</Text>
                                    <Text className="text-black text-xl font-black">Field Guide</Text>
                                </View>
                            </View>
                            <SyncStatusIndicator />
                        </View>
                        <Animated.View entering={FadeInUp}>
                            <Text className="text-black text-3xl font-black mt-1 leading-tight">Field Assistant Guide</Text>
                            <Text className="text-black text-sm font-black mt-2">Detailed help for collection, borrower follow-up, remittance, and sync</Text>
                        </Animated.View>
                    </View>
                ) : (
                    <LinearGradient
                        colors={['#4F46E5', '#3730A3']}
                        className="pt-12 pb-24 px-6 rounded-b-[48px] shadow-2xl mb-8"
                    >
                        <View className="flex-row justify-between items-center mb-6">
                            <View className="flex-row items-center">
                                <AnimatedPressable 
                                    onPress={() => safeBack(router, '/(collector)')} 
                                    className="bg-white/10 w-11 h-11 rounded-2xl items-center justify-center mr-4"
                                >
                                    <MaterialIcons name="arrow-back" size={24} color="#FFF" />
                                </AnimatedPressable>
                                <View>
                                    <Text className="text-indigo-100 text-[10px] font-black uppercase tracking-[2px]">Help & Guide</Text>
                                    <Text className="text-white text-xl font-black">Field Guide</Text>
                                </View>
                            </View>
                            <SyncStatusIndicator />
                        </View>
                        <Animated.View entering={FadeInUp}>
                            <Text className="text-white text-3xl font-black mt-1 leading-tight">Field Assistant Guide</Text>
                            <Text className="text-indigo-100/70 text-sm font-bold mt-2">Detailed help for collection, borrower follow-up, remittance, and sync</Text>
                        </Animated.View>
                    </LinearGradient>
                )}

                <View className="px-6 -mt-16">
                    <Accordion title="Start of Day Dashboard Workflow" icon="dashboard" defaultOpen={true} delay={200} sunlightMode={sunlightMode}>
                        <Text className={`${sunlightMode ? 'text-black font-black' : 'text-gray-700 font-bold'} mb-6 text-sm leading-relaxed`}>
                            Your collector dashboard is designed for one clear routine: review today's target, open your field list, collect payments, then remit cash before ending the day.
                        </Text>
                        <HelpNote
                            title="What you see on the home screen"
                            body="The current dashboard shows daily goal progress, active cases, efficiency, outstanding balance, collected amount, borrower search, and quick links to Field List, Remit Cash, Daily Sheet, Weekly Sheet, and this guide."
                            sunlightMode={sunlightMode}
                        />
                        <BulletList
                            sunlightMode={sunlightMode}
                            items={[
                                'Check your Daily Goal card first. It compares what you collected today against what is due today.',
                                'Use pull-to-refresh if your borrower list, KPI cards, or collections look outdated after working offline.',
                                'Use the search bar under My Borrowers to find an assigned borrower quickly before opening their detail screen.',
                                'Sunlight Mode is a high-contrast view meant for bright outdoor use during field visits.',
                                'Use the sync indicator in the header to confirm whether your latest work is already synchronized.'
                            ]}
                        />
                        <HelpStepCard stepNumber={1} icon="assignment" title="Open Field List" description="Use the main Field List card when you are ready to process today's route and collect due accounts." delay={400} />
                        <HelpStepCard stepNumber={2} icon="today" title="Use Daily Sheet or Weekly Sheet" description="Daily Sheet focuses on today's work, while Weekly Sheet helps you review grouped schedules and export a PDF summary." delay={500} />
                        <HelpStepCard stepNumber={3} icon="person-search" title="Search Assigned Borrowers" description="Use My Borrowers to open a borrower profile, review balances, and contact the client directly when follow-up is needed." delay={600} />
                    </Accordion>

                    <Accordion title="Using Collection Sheets" icon="list-alt" delay={300} sunlightMode={sunlightMode}>
                        <Text className={`${sunlightMode ? 'text-black font-black' : 'text-gray-700 font-bold'} mb-6 text-sm leading-relaxed`}>
                            Collection sheets combine your assigned borrowers, active loans, and unpaid schedules into a working route list.
                        </Text>
                        <Animated.View entering={ZoomIn.delay(300)} className="mb-8">
                            <Image
                                source={require('../../assets/help/collection_sheet.png')}
                                className={`w-full h-80 rounded-[40px] border bg-gray-50 ${sunlightMode ? 'border-4 border-black' : 'border-gray-100 shadow-xl shadow-indigo-200/20'}`}
                                resizeMode="cover"
                            />
                        </Animated.View>
                        <BulletList
                            sunlightMode={sunlightMode}
                            items={[
                                'The sheet date can be changed at the top, so you can review another day and not only the current date.',
                                'Items are sorted with overdue accounts first, then by route index, then by area so your route stays organized.',
                                'Quick Collect records the full scheduled installment immediately for the selected borrower and removes that item from the pending list.',
                                'Use the borrower button on each card when you need more detail than the quick action provides.',
                                'The Weekly Sheet groups schedules and can generate a weekly PDF report when you need a printable summary.'
                            ]}
                        />
                        <HelpStepCard stepNumber={1} icon="directions-walk" title="Check Route Order" description="Prioritize overdue accounts first, then continue through the sorted list based on the borrower's route and area." delay={400} />
                        <HelpStepCard stepNumber={2} icon="payments" title="Use Quick Collect for Exact Payments" description="When the borrower pays the full scheduled amount, use Quick Collect to post the payment faster." delay={500} />
                        <HelpStepCard stepNumber={3} icon="person" title="Open Borrower Profile for Exceptions" description="Use the borrower detail screen when you need contact info, balance review, payment history, or follow-up before collecting." delay={600} />
                    </Accordion>

                    <Accordion title="Borrower Profile, History & Communication" icon="forum" delay={400} sunlightMode={sunlightMode}>
                        <Text className={`${sunlightMode ? 'text-black font-black' : 'text-gray-700 font-bold'} mb-6 text-sm leading-relaxed`}>
                            Borrower detail screens help you understand repayment progress before you make a call, send a reminder, or request admin support.
                        </Text>
                        <BulletList
                            sunlightMode={sunlightMode}
                            items={[
                                'Borrower profiles show repayment progress, remaining balance, total loan, daily due, payment history, birthday, address, and contact actions.',
                                'You can call the borrower directly from the profile or open WhatsApp with a generated reminder message.',
                                'Payment history helps confirm whether the borrower already paid recently before you send another reminder.',
                                'If the borrower has account issues, balance disputes, or needs loan restructuring, escalate to admin instead of guessing in the field.'
                            ]}
                        />
                        <HelpStepCard stepNumber={1} icon="person-search" title="Review the Profile First" description="Open the borrower record to see current balance, repayment progress, and recent payment activity before taking action." delay={500} />
                        <HelpStepCard stepNumber={2} icon="chat" title="Send WhatsApp Reminder" description="Use the WhatsApp action when a borrower needs a quick written follow-up or a payment reminder." delay={600} />
                        <HelpStepCard stepNumber={3} icon="phone" title="Call for Urgent Follow-up" description="Use the call shortcut when you need a faster response or when the borrower needs directions before meeting." delay={700} />
                    </Accordion>

                    <Accordion title="Submitting Remittance & Handling Cash" icon="outbox" delay={500} sunlightMode={sunlightMode}>
                        <Text className={`${sunlightMode ? 'text-black font-black' : 'text-gray-700 font-bold'} mb-6 text-sm leading-relaxed`}>
                            The remittance screen helps you reconcile today's collections against the cash you still hold before turning funds over to admin.
                        </Text>
                        <Animated.View entering={ZoomIn.delay(400)} className="mb-8">
                            <Image
                                source={require('../../assets/help/remittance_submit.png')}
                                className={`w-full h-80 rounded-[40px] border bg-gray-50 ${sunlightMode ? 'border-4 border-black' : 'border-gray-100 shadow-xl shadow-indigo-200/20'}`}
                                resizeMode="cover"
                            />
                        </Animated.View>
                        <BulletList
                            sunlightMode={sunlightMode}
                            items={[
                                'Collected Today shows only what was posted today, while Total Cash Held reflects what you still carry after subtracting approved remittances.',
                                'The amount field is editable, and the Max Amount shortcut fills the current cash-held balance for you.',
                                'Use Notes to document shortages, batch details, or handover explanations that the admin should review.',
                                'Submitted remittances stay pending until an admin approves them. The Recent History list shows pending, approved, or rejected status.'
                            ]}
                        />
                        <HelpStepCard stepNumber={1} icon="account-balance-wallet" title="Confirm Cash Held" description="Before submitting, compare your physical cash with the Total Cash Held amount shown on screen." delay={500} />
                        <HelpStepCard stepNumber={2} icon="edit" title="Enter the Correct Remittance" description="Adjust the amount if you are remitting only part of your balance or if you need to document a discrepancy." delay={600} />
                        <HelpStepCard stepNumber={3} icon="send" title="Submit Then Hand Over Cash" description="Submit the remittance in the app and physically hand the cash to admin so they can approve it in their review screen." delay={700} />
                    </Accordion>

                    <Accordion title="Offline Work, Sync & Troubleshooting" icon="sync" delay={600} sunlightMode={sunlightMode}>
                        <Text className={`${sunlightMode ? 'text-black font-black' : 'text-gray-700 font-bold'} mb-6 text-sm leading-relaxed`}>
                            The app saves collection work locally first, so you can keep working in poor-signal areas and sync later.
                        </Text>
                        <HelpNote
                            title="How sync behaves"
                            body="Payments and remittances created in the field are stored on the device first. When connectivity returns, the sync process sends local changes and pulls updates from the cloud."
                            sunlightMode={sunlightMode}
                        />
                        <BulletList
                            sunlightMode={sunlightMode}
                            items={[
                                'Green sync status means you are up to date, yellow means syncing is in progress, and red means the last sync had a problem.',
                                'If you finish a long field session offline, open a stable internet connection before leaving the day unresolved so your latest work reaches admin.',
                                'If a borrower payment is missing from another device, force a sync and then refresh the screen.',
                                'If you see repeated sync failures, stop entering duplicate records and report the issue to admin or support with the time and module involved.'
                            ]}
                        />
                        <HelpStepCard stepNumber={1} icon="wifi-off" title="Keep Working Offline" description="You can continue recording collections and reviewing assigned borrowers even without internet access." delay={600} />
                        <HelpStepCard stepNumber={2} icon="cloud-upload" title="Sync When Back Online" description="Reconnect to the internet and allow the app to upload your local work and pull updates from the server." delay={700} />
                        <HelpStepCard stepNumber={3} icon="check-circle" title="Verify Before Ending the Day" description="Make sure the sync indicator is healthy and your remittance is submitted before you sign out or leave the branch." delay={800} />
                    </Accordion>

                    <Animated.View
                        entering={FadeInUp.delay(800)}
                        className={`p-8 rounded-[48px] items-center border mt-4 ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-indigo-50 border-indigo-100 shadow-xl shadow-indigo-100/40'}`}
                    >
                        <View className={`w-16 h-16 rounded-3xl items-center justify-center mb-6 shadow-sm ${sunlightMode ? 'bg-black' : 'bg-white'}`}>
                            <FontAwesome5 name="headset" size={24} color={sunlightMode ? '#FFF' : '#4F46E5'} />
                        </View>
                        <Text className={`font-black text-xl text-center mb-2 ${sunlightMode ? 'text-black' : 'text-indigo-900'}`}>Need direct help?</Text>
                        <Text className={`text-center font-bold text-sm leading-relaxed mb-6 ${sunlightMode ? 'text-black' : 'text-indigo-600/70'}`}>
                            If collections, remittances, borrower balances, or sync behavior do not match what you expect, contact your admin or technical support before entering duplicate records.
                        </Text>
                        <AnimatedPressable className={`${sunlightMode ? 'bg-black border-2 border-black' : 'bg-indigo-600 shadow-lg shadow-indigo-600/30'} px-8 py-4 rounded-2xl`}>
                            <Text className="text-white font-black uppercase tracking-wider text-xs">Contact Admin</Text>
                        </AnimatedPressable>
                    </Animated.View>
                </View>

                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
