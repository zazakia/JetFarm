import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ActivityIndicator, ScrollView, Platform, Linking, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthService } from '../src/services/AuthService';
import { AppLogo } from '../src/components/AppLogo';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../src/components/AnimatedPressable';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeIn, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { DEMO_ADMIN_CONTACT, InquiryService } from '../src/services/InquiryService';
import { COMPANY_EMAIL_PLACEHOLDER, COMPANY_NAME, COMPANY_PRODUCT_NAME } from '../src/constants/brand';
import { ErrorService } from '../src/services/ErrorService';

const ROLE_STYLES: Record<string, {
    gradient: [string, string];
    iconBg: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    badge: string;
    badgeText: string;
}> = {
    admin: {
        gradient: ['#7F1D1D', '#991B1B'],
        iconBg: 'rgba(220, 38, 38, 0.25)',
        icon: 'admin-panel-settings',
        badge: 'rgba(239, 68, 68, 0.30)',
        badgeText: '#FCA5A5',
    },
    collector: {
        gradient: ['#064E3B', '#065F46'],
        iconBg: 'rgba(16, 185, 129, 0.25)',
        icon: 'directions-walk',
        badge: 'rgba(16, 185, 129, 0.30)',
        badgeText: '#A7F3D0',
    },
    loan_encoder: {
        gradient: ['#1E3A8A', '#1D4ED8'],
        iconBg: 'rgba(59, 130, 246, 0.25)',
        icon: 'post-add',
        badge: 'rgba(59, 130, 246, 0.30)',
        badgeText: '#BAD0FB',
    },
    payment_encoder: {
        gradient: ['#78350F', '#92400E'],
        iconBg: 'rgba(245, 158, 11, 0.25)',
        icon: 'payments',
        badge: 'rgba(245, 158, 11, 0.30)',
        badgeText: '#FDE68A',
    },
    expenses_encoder: {
        gradient: ['#4C1D95', '#5B21B6'],
        iconBg: 'rgba(139, 92, 246, 0.25)',
        icon: 'receipt-long',
        badge: 'rgba(139, 92, 246, 0.30)',
        badgeText: '#DDD6FE',
    },
    borrower: {
        gradient: ['#1E293B', '#334155'],
        iconBg: 'rgba(148, 163, 184, 0.25)',
        icon: 'person-outline',
        badge: 'rgba(148, 163, 184, 0.25)',
        badgeText: '#CBD5E1',
    },
};

const HARDCODED_USERS = [
    { id: 'cybergada', full_name: 'Cybergada Master', role: 'admin', email: 'cybergada@gmail.com' },
    { id: 'admin', full_name: 'Admin User', role: 'admin', email: 'admin@poscursor.com' },
    { id: 'bisayang', full_name: 'Bisayang Collector', role: 'collector', email: 'bisayangcollector@gmail.com' },
    { id: 'master_collector', full_name: 'Master Collector', role: 'collector', email: 'collector@poscursor.com' },
    { id: 'main_office', full_name: 'Main Office', role: 'collector', email: 'mainoffice@poscursor.com' },
    { id: 'jayson', full_name: 'Jayson Cayanong', role: 'collector', email: 'jayson.cayanong@poscursor.com' },
    { id: 'cresencio', full_name: 'Cresencio Junco', role: 'collector', email: 'cresencio.junco@poscursor.com' },
    { id: 'gerald', full_name: 'Gerald Gera', role: 'collector', email: 'gerald.gera@poscursor.com' },
    { id: 'bernie', full_name: 'Bernie Casera', role: 'collector', email: 'bernie.casera@poscursor.com' },
    { id: 'encoder', full_name: 'Loan Encoder', role: 'loan_encoder', email: 'loan_encoder@poscursor.com' },
    { id: 'test_member', full_name: 'Test Member', role: 'borrower', email: 'member.test@poscursor.com' },
];

const PRIORITY_ORDER = [
    'cybergada@gmail.com',
    'admin@poscursor.com',
    'member.test@poscursor.com',
    'bisayangcollector@gmail.com',
    'collector@poscursor.com',
    'mainoffice@poscursor.com',
    'jayson.cayanong@poscursor.com',
    'cresencio.junco@poscursor.com',
    'gerald.gera@poscursor.com',
    'bernie.casera@poscursor.com',
    'loan_encoder@poscursor.com',
];

function getInitials(name: string) {
    return name
        .split(' ')
        .slice(0, 2)
        .map(n => n[0])
        .join('')
        .toUpperCase();
}

const FEATURE_CARDS = [
    {
        icon: 'calculate',
        title: 'Loan computation',
        description: 'Compute salary, pension, regular, contractual, and institutional loans with clear amortization.',
    },
    {
        icon: 'groups',
        title: 'Borrower management',
        description: 'Keep borrower profiles, co-makers, balances, terms, and collection history organized.',
    },
    {
        icon: 'route',
        title: 'Collector workflow',
        description: 'Give field collectors mobile collection sheets, remittance tracking, and daily accountability.',
    },
    {
        icon: 'cloud-off',
        title: 'Offline-ready records',
        description: 'Continue encoding and collecting even with weak internet, then sync when connection returns.',
    },
    {
        icon: 'print',
        title: 'Printable forms',
        description: 'Generate computation slips, promissory notes, contracts, and operational reports faster.',
    },
    {
        icon: 'admin-panel-settings',
        title: 'Role-based access',
        description: 'Separate tools for admins, collectors, loan encoders, payment encoders, expenses, and borrowers.',
    },
] as const;

const BUSINESS_BENEFITS = [
    'Reduce manual paperwork and repeated spreadsheet encoding.',
    'Track collections, balances, expenses, and remittances in one system.',
    'Improve accountability for collectors and office staff.',
    'See operational reports faster for better lending decisions.',
];

const TRUST_POINTS = [
    'Built for microfinance and local lending operations',
    'Supports field collection and back-office encoding',
    'Designed around Philippine Peso lending workflows',
];

const DEMO_MESSAGE = `Hello, I want to request a demo of ${COMPANY_NAME} for my lending business.`;

export default function LoginScreen() {
    const { width } = useWindowDimensions();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [activeEmail, setActiveEmail] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [quickUsers, setQuickUsers] = useState<any[]>([]);
    const [inquiry, setInquiry] = useState({
        fullName: '',
        businessName: '',
        contactNumber: '',
        email: '',
        message: '',
    });
    const [inquiryLoading, setInquiryLoading] = useState(false);
    const [inquiryStatus, setInquiryStatus] = useState('');
    const router = useRouter();
    const quickLoginEnabled = AuthService.isQuickLoginEnabled();
    const isWideLayout = Platform.OS === 'web' && width >= 920;
    const isTabletLayout = width >= 700;
    const isCompactPhone = width < 390;
    const horizontalPadding = isCompactPhone ? 12 : 20;
    const cardPadding = isCompactPhone ? 16 : 24;
    const compactCardPadding = isCompactPhone ? 16 : 22;
    const heroTitleSize = isWideLayout ? 42 : isCompactPhone ? 27 : 32;
    const heroTitleLineHeight = isWideLayout ? 50 : isCompactPhone ? 33 : 39;
    const featureCardWidth = isWideLayout ? '31.7%' : isTabletLayout ? '48%' : '100%';
    const fullWidthCtaStyle = !isTabletLayout ? { width: '100%' as const, alignItems: 'center' as const } : {};

    useEffect(() => {
        if (quickLoginEnabled) {
            loadQuickUsers();
        }
    }, [quickLoginEnabled]);

    async function loadQuickUsers() {
        try {
            const users = await AuthService.getQuickLoginUsers();
            setQuickUsers(users);
        } catch (e) {
            console.error('Failed to load quick users', e);
        }
    }

    async function signIn() {
        if (!email || !password) {
            setErrorMsg('Please enter both email and password.');
            return;
        }
        setLoading(true);
        setErrorMsg('');
        try {
            await AuthService.signIn(email, password);
            router.replace('/loading');
        } catch (error: any) {
            setErrorMsg(ErrorService.getUserMessage(error, 'Unable to sign in. Please try again.'));
            setLoading(false);
        }
    }

    // Merge remote + hardcoded, deduplicate by email
    const seenEmails = new Set<string>();
    const displayUsers: any[] = [];

    if (quickLoginEnabled) {
        quickUsers.forEach(u => {
            const uEmail = (u.email || '').toLowerCase();
            if (uEmail && !seenEmails.has(uEmail)) {
                seenEmails.add(uEmail);
                displayUsers.push(u);
            }
        });

        HARDCODED_USERS.forEach(u => {
            const uEmail = (u.email || '').toLowerCase();
            if (uEmail && !seenEmails.has(uEmail)) {
                seenEmails.add(uEmail);
                displayUsers.push(u);
            }
        });
    }

    displayUsers.sort((a, b) => {
        const aEmail = (a.email || '').toLowerCase();
        const bEmail = (b.email || '').toLowerCase();
        const aIdx = PRIORITY_ORDER.indexOf(aEmail);
        const bIdx = PRIORITY_ORDER.indexOf(bEmail);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return (a.full_name || '').localeCompare(b.full_name || '');
    });

    async function handleQuickLogin(userEmail: string) {
        if (loading) return;
        setActiveEmail(userEmail);
        setLoading(true);
        setErrorMsg('');

        try {
            await AuthService.signIn(userEmail, '12345678');
            router.replace('/loading');
        } catch (error: any) {
            setErrorMsg(ErrorService.getUserMessage(error, 'Quick login failed. Please try manual login.'));
            setLoading(false);
            setActiveEmail(null);
        }
    }

    function requestDemoByEmail() {
        const subject = encodeURIComponent(`${COMPANY_NAME} Demo Request`);
        const body = encodeURIComponent(`${DEMO_MESSAGE}\n\nPlease contact me with pricing and setup details.`);
        Linking.openURL(`mailto:${DEMO_ADMIN_CONTACT.email}?subject=${subject}&body=${body}`);
    }

    function requestDemoByWhatsApp() {
        Linking.openURL(`https://wa.me/${DEMO_ADMIN_CONTACT.whatsappInternational}?text=${encodeURIComponent(DEMO_MESSAGE)}`);
    }

    async function submitInquiry() {
        if (inquiryLoading) return;

        setInquiryLoading(true);
        setInquiryStatus('');

        try {
            const submittedInquiry = await InquiryService.submitDemoInquiry(inquiry);
            const { whatsappUrl, mailtoUrl } = InquiryService.buildAdminNotificationLinks(submittedInquiry);
            try {
                await Linking.openURL(whatsappUrl);
            } catch (linkError) {
                console.warn('Unable to open WhatsApp for demo inquiry notification, falling back to email.', linkError);
                await Linking.openURL(mailtoUrl);
            }
            setInquiryStatus('Inquiry submitted. Admin notification is ready to send in WhatsApp.');
            setInquiry({
                fullName: '',
                businessName: '',
                contactNumber: '',
                email: '',
                message: '',
            });
        } catch (error: any) {
            setInquiryStatus(error.message || 'Unable to submit inquiry. Please try again.');
        } finally {
            setInquiryLoading(false);
        }
    }

    return (
        <SafeAreaView className="flex-1">
            <LinearGradient
                colors={['#052E2B', '#0F172A', '#1E1B4B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="flex-1"
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, paddingVertical: isCompactPhone ? 18 : 32, paddingHorizontal: horizontalPadding }}
                    showsVerticalScrollIndicator={false}
                >
                    <View
                        style={{
                            width: '100%',
                            maxWidth: 1180,
                            alignSelf: 'center',
                            flexDirection: isWideLayout ? 'row' : 'column',
                            gap: isCompactPhone ? 14 : 24,
                            alignItems: isWideLayout ? 'flex-start' : 'stretch',
                        }}
                    >
                        <View style={{ flex: 1.25, width: '100%' }}>
                            {/* Header / Hero */}
                            <Animated.View
                                entering={FadeInDown.duration(600).springify()}
                                style={{
                                    backgroundColor: 'rgba(15,23,42,0.38)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.08)',
                                    borderRadius: isCompactPhone ? 24 : 32,
                                    padding: cardPadding,
                                    marginBottom: 18,
                                    overflow: 'hidden',
                                }}
                            >
                                <View style={{ flexDirection: isCompactPhone ? 'column' : 'row', alignItems: isCompactPhone ? 'flex-start' : 'center', marginBottom: isCompactPhone ? 18 : 22 }}>
                                    <View
                                        style={{
                                            backgroundColor: 'rgba(16,185,129,0.12)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(16,185,129,0.28)',
                                            borderRadius: isCompactPhone ? 20 : 24,
                                            padding: isCompactPhone ? 12 : 16,
                                            marginRight: isCompactPhone ? 0 : 14,
                                            marginBottom: isCompactPhone ? 12 : 0,
                                        }}
                                    >
                                        <AppLogo size={isCompactPhone ? 'sm' : 'md'} textColor="#F8FAFC" />
                                    </View>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={{ color: '#A7F3D0', fontSize: 11, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }}>
                                            {COMPANY_PRODUCT_NAME}
                                        </Text>
                                        <Text style={{ color: '#E2E8F0', marginTop: 4, fontSize: 13, fontWeight: '700' }}>
                                            Offline-first mobile and web operations
                                        </Text>
                                    </View>
                                </View>

                                <Text
                                    style={{
                                        color: '#F8FAFC',
                                        fontSize: heroTitleSize,
                                        lineHeight: heroTitleLineHeight,
                                        fontWeight: '900',
                                        letterSpacing: -1,
                                    }}
                                >
                                    Modern lending management for growing microfinance businesses.
                                </Text>
                                <Text style={{ color: '#CBD5E1', fontSize: isCompactPhone ? 14 : 16, lineHeight: isCompactPhone ? 22 : 25, marginTop: 16, fontWeight: '600' }}>
                                    Manage borrowers, loan computations, collections, payments, expenses, reports, and field collectors in one secure app built for real lending operations.
                                </Text>

                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
                                    <AnimatedPressable
                                        testID="landing-request-demo"
                                        onPress={requestDemoByEmail}
                                        style={{
                                            backgroundColor: '#355E3B',
                                            borderRadius: 14,
                                            paddingVertical: 13,
                                            paddingHorizontal: 18,
                                            ...fullWidthCtaStyle,
                                        }}
                                    >
                                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                                            Request Demo
                                        </Text>
                                    </AnimatedPressable>
                                    <AnimatedPressable
                                        testID="landing-whatsapp-demo"
                                        onPress={requestDemoByWhatsApp}
                                        style={{
                                            backgroundColor: 'rgba(16,185,129,0.12)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(16,185,129,0.32)',
                                            borderRadius: 14,
                                            paddingVertical: 13,
                                            paddingHorizontal: 18,
                                            ...fullWidthCtaStyle,
                                        }}
                                    >
                                        <Text style={{ color: '#A7F3D0', fontWeight: '900', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                                            WhatsApp {DEMO_ADMIN_CONTACT.whatsappDisplay}
                                        </Text>
                                    </AnimatedPressable>
                                    <AnimatedPressable
                                        testID="landing-login-cta"
                                        style={{
                                            borderWidth: 1,
                                            borderColor: 'rgba(255,255,255,0.18)',
                                            borderRadius: 14,
                                            paddingVertical: 13,
                                            paddingHorizontal: 18,
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            ...fullWidthCtaStyle,
                                        }}
                                    >
                                        <Text style={{ color: '#E2E8F0', fontWeight: '900', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                                            Login to Account
                                        </Text>
                                    </AnimatedPressable>
                                    <AnimatedPressable
                                        testID="landing-loan-calculator"
                                        onPress={() => router.push('/loan-calculator')}
                                        style={{
                                            backgroundColor: 'rgba(59,130,246,0.16)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(147,197,253,0.35)',
                                            borderRadius: 14,
                                            paddingVertical: 13,
                                            paddingHorizontal: 18,
                                            ...fullWidthCtaStyle,
                                        }}
                                    >
                                        <Text style={{ color: '#BFDBFE', fontWeight: '900', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                                            Online Calculator
                                        </Text>
                                    </AnimatedPressable>
                                    <AnimatedPressable
                                        testID="landing-loan-application"
                                        onPress={() => router.push('/loan-application')}
                                        style={{
                                            backgroundColor: 'rgba(250,204,21,0.14)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(253,224,71,0.35)',
                                            borderRadius: 14,
                                            paddingVertical: 13,
                                            paddingHorizontal: 18,
                                            ...fullWidthCtaStyle,
                                        }}
                                    >
                                        <Text style={{ color: '#FEF08A', fontWeight: '900', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                                            Apply for Loan
                                        </Text>
                                    </AnimatedPressable>
                                </View>

                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
                                    {['Offline-ready', 'Printable reports', 'Role-based access'].map((label) => (
                                        <View
                                            key={label}
                                            style={{
                                                backgroundColor: 'rgba(16,185,129,0.10)',
                                                borderColor: 'rgba(16,185,129,0.22)',
                                                borderWidth: 1,
                                                borderRadius: 999,
                                                paddingHorizontal: 12,
                                                paddingVertical: 7,
                                            }}
                                        >
                                            <Text style={{ color: '#A7F3D0', fontWeight: '900', fontSize: 11 }}>{label}</Text>
                                        </View>
                                    ))}
                                </View>
                            </Animated.View>

                            {/* Feature highlights */}
                            <Animated.View entering={FadeInUp.duration(600).delay(80).springify()} style={{ marginBottom: 18 }}>
                                <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900', marginBottom: 12 }}>
                                    What your lending business gets
                                </Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                                    {FEATURE_CARDS.map((feature, index) => (
                                        <Animated.View
                                            key={feature.title}
                                            entering={FadeInUp.duration(400).delay(index * 35).springify()}
                                            style={{
                                                width: featureCardWidth,
                                                minWidth: isWideLayout ? 190 : undefined,
                                                backgroundColor: 'rgba(255,255,255,0.06)',
                                                borderColor: 'rgba(255,255,255,0.09)',
                                                borderWidth: 1,
                                                borderRadius: 22,
                                                padding: 16,
                                            }}
                                        >
                                            <View
                                                style={{
                                                    width: 42,
                                                    height: 42,
                                                    borderRadius: 14,
                                                    backgroundColor: 'rgba(16,185,129,0.14)',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginBottom: 12,
                                                }}
                                            >
                                                <MaterialIcons name={feature.icon} size={23} color="#6FA878" />
                                            </View>
                                            <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '900', marginBottom: 6 }}>
                                                {feature.title}
                                            </Text>
                                            <Text style={{ color: '#CBD5E1', fontSize: 12, lineHeight: 18, fontWeight: '600' }}>
                                                {feature.description}
                                            </Text>
                                        </Animated.View>
                                    ))}
                                </View>
                            </Animated.View>

                            {/* Benefits / trust */}
                            <Animated.View
                                entering={FadeInUp.duration(600).delay(140).springify()}
                                style={{
                                    flexDirection: isTabletLayout ? 'row' : 'column',
                                    gap: 12,
                                    marginBottom: isWideLayout ? 0 : 18,
                                }}
                            >
                                <View
                                    style={{
                                        flex: 1,
                                        backgroundColor: 'rgba(15,23,42,0.52)',
                                        borderColor: 'rgba(255,255,255,0.08)',
                                        borderWidth: 1,
                                        borderRadius: 24,
                                        padding: 18,
                                    }}
                                >
                                    <Text style={{ color: '#F8FAFC', fontSize: 17, fontWeight: '900', marginBottom: 12 }}>
                                        Why owners choose it
                                    </Text>
                                    {BUSINESS_BENEFITS.map((benefit) => (
                                        <View key={benefit} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                                            <Ionicons name="checkmark-circle" size={18} color="#4F7F52" />
                                            <Text style={{ color: '#D1FAE5', fontSize: 13, lineHeight: 19, fontWeight: '700', marginLeft: 9, flex: 1 }}>
                                                {benefit}
                                            </Text>
                                        </View>
                                    ))}
                                </View>

                                <View
                                    style={{
                                        flex: 1,
                                        backgroundColor: 'rgba(245,158,11,0.08)',
                                        borderColor: 'rgba(245,158,11,0.22)',
                                        borderWidth: 1,
                                        borderRadius: 24,
                                        padding: 18,
                                    }}
                                >
                                    <Text style={{ color: '#FEF3C7', fontSize: 17, fontWeight: '900', marginBottom: 12 }}>
                                        Built for actual lending teams
                                    </Text>
                                    {TRUST_POINTS.map((point) => (
                                        <View key={point} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                                            <Ionicons name="shield-checkmark" size={18} color="#FBBF24" />
                                            <Text style={{ color: '#FDE68A', fontSize: 13, lineHeight: 19, fontWeight: '700', marginLeft: 9, flex: 1 }}>
                                                {point}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </Animated.View>
                        </View>

                        <View style={{ flex: 0.85, width: '100%', maxWidth: isWideLayout ? 430 : 620, alignSelf: 'center' }}>
                            {/* Error Message */}
                            {errorMsg ? (
                                <Animated.View
                                    entering={FadeIn.duration(300)}
                                    style={{
                                        backgroundColor: 'rgba(239,68,68,0.12)',
                                        borderWidth: 1,
                                        borderColor: 'rgba(239,68,68,0.3)',
                                        borderRadius: 16,
                                        padding: 16,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        marginBottom: 16,
                                        width: '100%',
                                    }}
                                >
                                    <MaterialIcons name="error-outline" size={22} color="#F87171" />
                                    <Text style={{ color: '#FCA5A5', marginLeft: 12, flex: 1, fontWeight: '700', fontSize: 14 }}>
                                        {errorMsg}
                                    </Text>
                                </Animated.View>
                            ) : null}

                            {/* Inquiry Form */}
                            <Animated.View
                                entering={FadeInUp.duration(600).delay(60).springify()}
                                style={{
                                    width: '100%',
                                    backgroundColor: 'rgba(6,78,59,0.42)',
                                    borderRadius: 28,
                                    borderWidth: 1,
                                    borderColor: 'rgba(16,185,129,0.22)',
                                    padding: compactCardPadding,
                                    marginBottom: 18,
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                                    <View
                                        style={{
                                            width: 42,
                                            height: 42,
                                            borderRadius: 14,
                                            backgroundColor: 'rgba(16,185,129,0.16)',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginRight: 12,
                                        }}
                                    >
                                        <MaterialIcons name="support-agent" size={23} color="#6FA878" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#F8FAFC', fontSize: 19, fontWeight: '900' }}>
                                            Request system demo
                                        </Text>
                                        <Text style={{ color: '#A7F3D0', fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                                            Submit an inquiry and notify the admin.
                                        </Text>
                                    </View>
                                </View>

                                {[
                                    { key: 'fullName', label: 'Your Name', placeholder: 'Juan Dela Cruz' },
                                    { key: 'businessName', label: 'Business Name', placeholder: 'ABC Lending Corporation' },
                                    { key: 'contactNumber', label: 'Contact Number', placeholder: '0917 123 4567' },
                                    { key: 'email', label: 'Email Optional', placeholder: 'client@example.com' },
                                ].map((field) => (
                                    <View key={field.key} style={{ marginBottom: 12 }}>
                                        <Text style={{ color: '#A7F3D0', fontSize: 9, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 6, marginLeft: 4 }}>
                                            {field.label}
                                        </Text>
                                        <TextInput
                                            testID={`inquiry-${field.key}`}
                                            style={{
                                                backgroundColor: 'rgba(15,23,42,0.42)',
                                                borderWidth: 1,
                                                borderColor: 'rgba(255,255,255,0.10)',
                                                borderRadius: 14,
                                                paddingHorizontal: 14,
                                                paddingVertical: 12,
                                                color: '#fff',
                                                fontWeight: '700',
                                                fontSize: 14,
                                                minWidth: 0,
                                            }}
                                            value={(inquiry as any)[field.key]}
                                            onChangeText={(value) => setInquiry(prev => ({ ...prev, [field.key]: value }))}
                                            placeholder={field.placeholder}
                                            placeholderTextColor="#64748B"
                                            editable={!inquiryLoading}
                                            autoCapitalize={field.key === 'email' ? 'none' : 'words'}
                                            keyboardType={field.key === 'email' ? 'email-address' : field.key === 'contactNumber' ? 'phone-pad' : 'default'}
                                        />
                                    </View>
                                ))}

                                <View style={{ marginBottom: 14 }}>
                                    <Text style={{ color: '#A7F3D0', fontSize: 9, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 6, marginLeft: 4 }}>
                                        Message Optional
                                    </Text>
                                    <TextInput
                                        testID="inquiry-message"
                                        style={{
                                            minHeight: 72,
                                            backgroundColor: 'rgba(15,23,42,0.42)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(255,255,255,0.10)',
                                            borderRadius: 14,
                                            paddingHorizontal: 14,
                                            paddingVertical: 12,
                                            color: '#fff',
                                            fontWeight: '700',
                                            fontSize: 14,
                                            textAlignVertical: 'top',
                                            minWidth: 0,
                                        }}
                                        value={inquiry.message}
                                        onChangeText={(value) => setInquiry(prev => ({ ...prev, message: value }))}
                                        placeholder="Tell us about your lending operation..."
                                        placeholderTextColor="#64748B"
                                        editable={!inquiryLoading}
                                        multiline
                                    />
                                </View>

                                {inquiryStatus ? (
                                    <Text
                                        testID="inquiry-status"
                                        style={{
                                            color: inquiryStatus.includes('submitted') ? '#A7F3D0' : '#FCA5A5',
                                            fontWeight: '800',
                                            fontSize: 12,
                                            lineHeight: 17,
                                            marginBottom: 12,
                                        }}
                                    >
                                        {inquiryStatus}
                                    </Text>
                                ) : null}

                                <AnimatedPressable
                                    testID="submit-inquiry"
                                    onPress={submitInquiry}
                                    disabled={inquiryLoading}
                                >
                                    <LinearGradient
                                        colors={inquiryLoading ? ['#94A3B8', '#64748B'] : ['#47734B', '#355E3B']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={{
                                            height: 50,
                                            borderRadius: 15,
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                        }}
                                    >
                                        {inquiryLoading ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={{ color: '#fff', fontWeight: '900', fontSize: isCompactPhone ? 11 : 12, letterSpacing: isCompactPhone ? 0.8 : 1.4, textTransform: 'uppercase', textAlign: 'center' }}>
                                                Submit Inquiry + Notify Admin
                                            </Text>
                                        )}
                                    </LinearGradient>
                                </AnimatedPressable>
                            </Animated.View>

                            {/* Standard Login Form */}
                            <Animated.View
                                entering={FadeInUp.duration(600).delay(100).springify()}
                                style={{
                                    width: '100%',
                                    backgroundColor: 'rgba(15,23,42,0.72)',
                                    borderRadius: 32,
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.10)',
                                    padding: cardPadding,
                                    marginBottom: 18,
                                }}
                            >
                                <Text style={{ color: '#F8FAFC', fontSize: isCompactPhone ? 21 : 24, fontWeight: '900', marginBottom: 6 }}>
                                    Login to your workspace
                                </Text>
                                <Text style={{ color: '#94A3B8', fontSize: 13, lineHeight: 19, fontWeight: '700', marginBottom: 22 }}>
                                    Secure access for admins, collectors, encoders, and borrowers.
                                </Text>

                                <View className="mb-6">
                                    <View>
                                        <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Email Address</Text>
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: 'rgba(15,23,42,0.4)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(255,255,255,0.1)',
                                            borderRadius: 16,
                                            paddingHorizontal: 16,
                                        }}>
                                            <MaterialIcons name="alternate-email" size={20} color="#64748B" />
                                            <TextInput
                                                style={{ flex: 1, minWidth: 0, padding: 14, color: '#fff', fontWeight: '700', fontSize: 15 }}
                                                onChangeText={setEmail}
                                                value={email}
                                                placeholder={COMPANY_EMAIL_PLACEHOLDER}
                                                autoCapitalize="none"
                                                keyboardType="email-address"
                                                editable={!loading}
                                                placeholderTextColor="#475569"
                                            />
                                        </View>
                                    </View>

                                    <View style={{ marginTop: 20 }}>
                                        <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Password</Text>
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: 'rgba(15,23,42,0.4)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(255,255,255,0.1)',
                                            borderRadius: 16,
                                            paddingHorizontal: 16,
                                        }}>
                                            <MaterialIcons name="lock-outline" size={20} color="#64748B" />
                                            <TextInput
                                                style={{ flex: 1, minWidth: 0, padding: 14, color: '#fff', fontWeight: '700', fontSize: 15 }}
                                                onChangeText={setPassword}
                                                value={password}
                                                secureTextEntry={!showPassword}
                                                placeholder="ΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇó"
                                                autoCapitalize="none"
                                                editable={!loading}
                                                placeholderTextColor="#475569"
                                            />
                                            <AnimatedPressable
                                                testID="password-toggle"
                                                onPress={() => setShowPassword(!showPassword)}
                                                style={{ padding: 4 }}
                                            >
                                                <Ionicons
                                                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                                                    size={20}
                                                    color="#64748B"
                                                />
                                            </AnimatedPressable>
                                        </View>
                                    </View>
                                </View>

                                <View style={{ alignItems: 'flex-end', marginBottom: 24 }}>
                                    <AnimatedPressable>
                                        <Text style={{ color: '#6FA878', fontWeight: '900', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Forgot Password?</Text>
                                    </AnimatedPressable>
                                </View>

                                <AnimatedPressable
                                    onPress={signIn}
                                    disabled={loading}
                                >
                                    <LinearGradient
                                        colors={loading ? ['#94A3B8', '#64748B'] : ['#4F7F52', '#355E3B']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={{
                                            height: 56,
                                            borderRadius: 16,
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            ...Platform.select({
                                                web: {
                                                    boxShadow: '0 4px 8px 0 rgba(16, 185, 129, 0.3)',
                                                },
                                                default: {
                                                    shadowColor: '#4F7F52',
                                                    shadowOffset: { width: 0, height: 4 },
                                                    shadowOpacity: 0.3,
                                                    shadowRadius: 8,
                                                    elevation: 5,
                                                },
                                            }),
                                        }}
                                    >
                                        {loading && !activeEmail ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' }}>Sign In</Text>
                                        )}
                                    </LinearGradient>
                                </AnimatedPressable>

                                <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
                                    <Text style={{ color: '#64748B', fontWeight: '700', fontSize: 12 }}>New member?</Text>
                                    <AnimatedPressable onPress={() => router.push('/register')} style={{ marginLeft: 8 }}>
                                        <Text style={{ color: '#6FA878', fontWeight: '900', fontSize: 12 }}>Register Now</Text>
                                    </AnimatedPressable>
                                </View>
                            </Animated.View>

                            {/* Quick Login Card */}
                            {quickLoginEnabled && <Animated.View
                                entering={FadeInUp.duration(600).delay(200).springify()}
                                style={{
                                    width: '100%',
                                    backgroundColor: 'rgba(15,23,42,0.62)',
                                    borderRadius: 32,
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.08)',
                                    padding: cardPadding,
                                    overflow: 'hidden',
                                }}
                            >
                                {/* Section header */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                                    <Text style={{
                                        paddingHorizontal: 16,
                                        color: '#64748B',
                                        fontSize: 10,
                                        fontWeight: '900',
                                        letterSpacing: 3,
                                        textTransform: 'uppercase',
                                    }}>
                                        Quick Access
                                    </Text>
                                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                                </View>

                                {/* User List */}
                                {displayUsers.length === 0 ? (
                                    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                                        <ActivityIndicator color="#4F7F52" size="small" />
                                        <Text style={{ color: '#475569', marginTop: 8, fontWeight: '600', fontSize: 12 }}>Loading accountsΓÇª</Text>
                                    </View>
                                ) : (
                                    displayUsers.map((u, index) => {
                                        const normalizedRole = (u.role || '').toLowerCase();
                                        const style = ROLE_STYLES[normalizedRole] || ROLE_STYLES.collector;
                                        const userEmail = (u.email || '').toLowerCase();
                                        const isActive = activeEmail === userEmail && loading;

                                        return (
                                            <Animated.View
                                                key={u.id + index}
                                                entering={FadeInUp.duration(400).delay(index * 40).springify()}
                                            >
                                                <AnimatedPressable
                                                    testID={`quick-login-${userEmail}`}
                                                    data-testid={`quick-login-${userEmail}`}
                                                    onPress={() => handleQuickLogin(userEmail)}
                                                    disabled={loading}
                                                    style={{ marginBottom: 10, opacity: loading && !isActive ? 0.5 : 1 }}
                                                >
                                                    <LinearGradient
                                                        colors={isActive
                                                            ? ['rgba(16,185,129,0.25)', 'rgba(16,185,129,0.1)']
                                                            : ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 0 }}
                                                        style={{
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            padding: 12,
                                                            borderRadius: 16,
                                                            borderWidth: 1,
                                                            borderColor: isActive
                                                                ? 'rgba(16,185,129,0.3)'
                                                                : 'rgba(255,255,255,0.05)',
                                                        }}
                                                    >
                                                        {/* Avatar */}
                                                        <LinearGradient
                                                            colors={style.gradient}
                                                            style={{
                                                                width: 40,
                                                                height: 40,
                                                                borderRadius: 12,
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                marginRight: 12,
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            {isActive ? (
                                                                <ActivityIndicator color="#fff" size="small" />
                                                            ) : (
                                                                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>
                                                                    {getInitials(u.full_name || 'U')}
                                                                </Text>
                                                            )}
                                                        </LinearGradient>

                                                        {/* Name + email */}
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ color: '#E2E8F0', fontWeight: '800', fontSize: 13, marginBottom: 1 }} numberOfLines={1}>
                                                                {u.full_name || 'Unknown'}
                                                            </Text>
                                                            <Text style={{ color: '#94A3B8', fontWeight: '600', fontSize: 10 }} numberOfLines={1}>
                                                                {userEmail}
                                                            </Text>
                                                        </View>

                                                        {/* Role badge */}
                                                        <View style={{
                                                            paddingHorizontal: 8,
                                                            paddingVertical: 3,
                                                            borderRadius: 8,
                                                            backgroundColor: style.badge,
                                                            marginLeft: 6,
                                                        }}>
                                                            <Text style={{
                                                                color: style.badgeText,
                                                                fontSize: 8,
                                                                fontWeight: '900',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: 0.5,
                                                            }}>
                                                                {normalizedRole.replace('_', ' ')}
                                                            </Text>
                                                        </View>
                                                    </LinearGradient>
                                                </AnimatedPressable>
                                            </Animated.View>
                                        );
                                    })
                                )}
                            </Animated.View>}

                            {/* Footer */}
                            <Animated.View
                                entering={FadeIn.duration(600).delay(500)}
                                style={{ marginTop: 24, marginBottom: 20, alignItems: 'center' }}
                            >
                                <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '700', textAlign: 'center', letterSpacing: 1 }}>
                                    {COMPANY_NAME} - SECURE ACCESS
                                </Text>
                            </Animated.View>
                        </View>
                    </View>
                </ScrollView>
            </LinearGradient>
        </SafeAreaView>
    );
}
