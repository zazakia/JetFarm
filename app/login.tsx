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
import { DEMO_ADMIN_CONTACT } from '../src/services/InquiryService';
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
    { id: 'admin', full_name: 'Admin User', role: 'admin', email: 'admin@jetfarm.com' },
    { id: 'master_collector', full_name: 'Master Collector', role: 'collector', email: 'collector@jetfarm.com' },
    { id: 'cresencio', full_name: 'Cresencio Junco', role: 'collector', email: 'cresencio.junco@jetfarm.com' },
    { id: 'gerald', full_name: 'Gerald Gera', role: 'collector', email: 'gerald.gera@jetfarm.com' },
    { id: 'bernie', full_name: 'Bernie Casera', role: 'collector', email: 'bernie.casera@jetfarm.com' },
    { id: 'encoder', full_name: 'Loan Encoder', role: 'loan_encoder', email: 'encoder@jetfarm.com' },
    { id: 'payment_enc', full_name: 'Payment Encoder', role: 'payment_encoder', email: 'payment_encoder@jetfarm.com' },
    { id: 'expenses_enc', full_name: 'Expenses Encoder', role: 'expenses_encoder', email: 'expenses_encoder@jetfarm.com' },
    { id: 'test_member', full_name: 'Test Member', role: 'borrower', email: 'member.test@jetfarm.com' },
];

const PRIORITY_ORDER = [
    'cybergada@gmail.com',
    'admin@jetfarm.com',
    'member.test@jetfarm.com',
    'collector@jetfarm.com',
    'encoder@jetfarm.com',
    'payment_encoder@jetfarm.com',
    'expenses_encoder@jetfarm.com',
];

function getInitials(name: string) {
    return name
        .split(' ')
        .slice(0, 2)
        .map(n => n[0])
        .join('')
        .toUpperCase();
}

const JETFARM_MISSION = [
    "Promote better social relationship between and among members, staff and officers.",
    "Bring its services closer to the members and develop stronger mutual trust that should expand membership and touch the lives of more people.",
    "Utilize all available resources efficiently and effectively and bring about more better services to members and in turn more extensive utilization of the cooperatives services by the members for better economic and social benefits.",
    "Strengthen existing cooperative services and activities;",
    "Provide affordable and quality services for the member's satisfaction."
] as const;

const JETFARM_GOALS = [
    "To attain increased income, savings, investments, productivity, and purchasing power, and promote among themselves equitable distribution of net surplus through maximum utilization of economies of scale, cost-sharing and risk-sharing;",
    "To provide optimum social and economic benefits to its members;",
    "To teach members efficient ways of doing things in a cooperative manner;",
    "To propagate cooperative practices and new ideas in business and management;",
    "To allow the lower income and less privileged groups to increase their ownership in the wealth of the nation;",
    "To actively support the government, other cooperatives and people oriented organizations, both local and foreign, in promoting cooperatives as a practical means towards sustainable socio-economic development under a truly just and democratic society;",
    "To institutionalize a dynamic savings mobilization and capital build-up schemes to sustain its developmental activities and long-term investments, thereby ensuring optimum economic benefits to the members, their families and the general public;",
    "To adopt membership expansion mechanism/scheme, thereby ensuring growth of the cooperative movement;",
    "To implement policy guidelines that will ensure transparency, equitable access to its resources and services, and promote the interests of the members; and",
    "To adopt such other plans as may help foster the welfare of the members, their families and the community."
] as const;

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
            // Try quick sign-in first (handles E2E test users on any domain),
            // falls through to real Supabase auth for non-E2E users.
            await AuthService.quickSignIn(email, password);
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
            await AuthService.quickSignIn(userEmail, '12345678');
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



    return (
        <SafeAreaView className="flex-1">
            <LinearGradient
                colors={['#3F1608', '#0F172A', '#521B08']}
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
                        <View style={{ flex: 0.85, width: '100%', maxWidth: isWideLayout ? 430 : 620, alignSelf: isWideLayout ? 'flex-start' : 'center' }}>
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
                                                placeholder="••••••••"
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
                                        <Text style={{ color: '#EF4444', fontWeight: '900', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Forgot Password?</Text>
                                    </AnimatedPressable>
                                </View>

                                <AnimatedPressable
                                    onPress={signIn}
                                    disabled={loading}
                                >
                                    <LinearGradient
                                        colors={loading ? ['#94A3B8', '#64748B'] : ['#DC2626', '#991B1B']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={{
                                            height: 56,
                                            borderRadius: 16,
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            ...Platform.select({
                                                web: {
                                                    boxShadow: '0 4px 8px 0 rgba(220, 38, 38, 0.3)',
                                                },
                                                default: {
                                                    shadowColor: '#DC2626',
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
                                        <Text style={{ color: '#EF4444', fontWeight: '900', fontSize: 12 }}>Register Now</Text>
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
                                    marginBottom: 18,
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
                                        <ActivityIndicator color="#DC2626" size="small" />
                                        <Text style={{ color: '#475569', marginTop: 8, fontWeight: '600', fontSize: 12 }}>Loading accounts…</Text>
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
                                            backgroundColor: 'rgba(255,255,255,0.08)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(255,255,255,0.15)',
                                            borderRadius: isCompactPhone ? 16 : 20,
                                            padding: isCompactPhone ? 8 : 12,
                                            marginRight: isCompactPhone ? 0 : 14,
                                            marginBottom: isCompactPhone ? 12 : 0,
                                        }}
                                    >
                                        <AppLogo size={isCompactPhone ? 'sm' : 'md'} hideText={true} />
                                    </View>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={{ color: '#FBBF24', fontSize: 11, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }}>
                                            {COMPANY_PRODUCT_NAME}
                                        </Text>
                                        <Text style={{ color: '#E2E8F0', marginTop: 4, fontSize: 13, fontWeight: '700' }}>
                                            Brgy. Linao Ormoc City • 255-4463
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
                                    POS Cursor CSCC is likened to the rays of the sun, a symbol of Strength, Hope and Aspiration.
                                </Text>
                                <Text style={{ color: '#CBD5E1', fontSize: isCompactPhone ? 14 : 16, lineHeight: isCompactPhone ? 22 : 25, marginTop: 16, fontWeight: '600', fontStyle: 'italic' }}>
                                    "We envision ourselves in commitment to help its members and community in its financial management for social and economic growth."
                                </Text>

                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
                                    <AnimatedPressable
                                        testID="landing-request-demo"
                                        onPress={requestDemoByEmail}
                                        style={{
                                            backgroundColor: '#B91C1C',
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
                                            backgroundColor: 'rgba(245,158,11,0.12)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(245,158,11,0.32)',
                                            borderRadius: 14,
                                            paddingVertical: 13,
                                            paddingHorizontal: 18,
                                            ...fullWidthCtaStyle,
                                        }}
                                    >
                                        <Text style={{ color: '#FDE68A', fontWeight: '900', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
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
                                            backgroundColor: 'rgba(245,158,11,0.16)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(251,191,36,0.35)',
                                            borderRadius: 14,
                                            paddingVertical: 13,
                                            paddingHorizontal: 18,
                                            ...fullWidthCtaStyle,
                                        }}
                                    >
                                        <Text style={{ color: '#FEF08A', fontWeight: '900', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                                            Online Calculator
                                        </Text>
                                    </AnimatedPressable>
                                    <AnimatedPressable
                                        testID="landing-loan-application"
                                        onPress={() => router.push('/loan-application')}
                                        style={{
                                            backgroundColor: 'rgba(220,38,38,0.14)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(248,113,113,0.35)',
                                            borderRadius: 14,
                                            paddingVertical: 13,
                                            paddingHorizontal: 18,
                                            ...fullWidthCtaStyle,
                                        }}
                                    >
                                        <Text style={{ color: '#FCA5A5', fontWeight: '900', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                                            Apply for Loan
                                        </Text>
                                    </AnimatedPressable>
                                    <AnimatedPressable
                                        testID="landing-download-apk"
                                        onPress={() => Linking.openURL('https://jetfarm.pages.dev/download')}
                                        style={{
                                            backgroundColor: 'rgba(16,185,129,0.16)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(52,211,153,0.35)',
                                            borderRadius: 14,
                                            paddingVertical: 13,
                                            paddingHorizontal: 18,
                                            ...fullWidthCtaStyle,
                                        }}
                                    >
                                        <Text style={{ color: '#A7F3D0', fontWeight: '900', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                                            Download Android APK
                                        </Text>
                                    </AnimatedPressable>
                                </View>

                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
                                    {['Offline-ready', 'Printable reports', 'Role-based access'].map((label) => (
                                        <View
                                            key={label}
                                            style={{
                                                backgroundColor: 'rgba(245,158,11,0.10)',
                                                borderColor: 'rgba(245,158,11,0.22)',
                                                borderWidth: 1,
                                                borderRadius: 999,
                                                paddingHorizontal: 12,
                                                paddingVertical: 7,
                                            }}
                                        >
                                            <Text style={{ color: '#FDE68A', fontWeight: '900', fontSize: 11 }}>{label}</Text>
                                        </View>
                                    ))}
                                </View>
                            </Animated.View>

                            {/* POS Cursor Mission */}
                            <Animated.View entering={FadeInUp.duration(600).delay(80).springify()} style={{ marginBottom: 18 }}>
                                <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900', marginBottom: 12 }}>
                                    Our Mission
                                </Text>
                                <View style={{ flexDirection: 'column', gap: 12 }}>
                                    {JETFARM_MISSION.map((mission, index) => (
                                        <Animated.View
                                            key={`mission-${index}`}
                                            entering={FadeInUp.duration(400).delay(index * 35).springify()}
                                            style={{
                                                backgroundColor: 'rgba(255,255,255,0.06)',
                                                borderColor: 'rgba(255,255,255,0.09)',
                                                borderWidth: 1,
                                                borderRadius: 16,
                                                padding: 16,
                                                flexDirection: 'row',
                                            }}
                                        >
                                            <View
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 16,
                                                    backgroundColor: 'rgba(220,38,38,0.14)',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginRight: 14,
                                                }}
                                            >
                                                <Text style={{ color: '#EF4444', fontWeight: '900', fontSize: 14 }}>{index + 1}</Text>
                                            </View>
                                            <Text style={{ flex: 1, color: '#E2E8F0', fontSize: 13, lineHeight: 20, fontWeight: '600' }}>
                                                {mission}
                                            </Text>
                                        </Animated.View>
                                    ))}
                                </View>
                            </Animated.View>

                            {/* POS Cursor Goals */}
                            <Animated.View
                                entering={FadeInUp.duration(600).delay(140).springify()}
                                style={{
                                    marginBottom: isWideLayout ? 0 : 18,
                                }}
                            >
                                <View
                                    style={{
                                        backgroundColor: 'rgba(15,23,42,0.52)',
                                        borderColor: 'rgba(255,255,255,0.08)',
                                        borderWidth: 1,
                                        borderRadius: 24,
                                        padding: 18,
                                    }}
                                >
                                    <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900', marginBottom: 16 }}>
                                        Our Goals
                                    </Text>
                                    <View style={{ flexDirection: 'column', gap: 12 }}>
                                        {JETFARM_GOALS.map((goal, index) => (
                                            <View key={`goal-${index}`} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                                <Ionicons name="checkmark-circle" size={18} color="#D97706" style={{ marginTop: 2 }} />
                                                <Text style={{ color: '#FEF3C7', fontSize: 13, lineHeight: 20, fontWeight: '500', marginLeft: 12, flex: 1 }}>
                                                    {goal}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </Animated.View>
                        </View>
                    </View>
                </ScrollView>
            </LinearGradient>
        </SafeAreaView>
    );
}
