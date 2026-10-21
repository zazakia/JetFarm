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
import { getAppVersion, APP_DOWNLOAD_URL } from '../src/constants/AppVersion';
import { ErrorService } from '../src/services/ErrorService';
import { LandingVideoPlayer } from '../src/components/LandingVideoPlayer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LAST_AUTHORIZED_ROUTE_KEY } from '../src/utils/authNavigation';

const ROLE_STYLES: Record<string, {
    gradient: [string, string];
    iconBg: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    badge: string;
    badgeText: string;
}> = {
    admin: {
        gradient: ['#064E3B', '#047857'],
        iconBg: 'rgba(16, 185, 129, 0.25)',
        icon: 'admin-panel-settings',
        badge: 'rgba(16, 185, 129, 0.30)',
        badgeText: '#A7F3D0',
    },
    main_office: {
        gradient: ['#047857', '#059669'],
        iconBg: 'rgba(16, 185, 129, 0.25)',
        icon: 'business',
        badge: 'rgba(16, 185, 129, 0.30)',
        badgeText: '#A7F3D0',
    },
    expenses_encoder: {
        gradient: ['#4C1D95', '#5B21B6'],
        iconBg: 'rgba(139, 92, 246, 0.25)',
        icon: 'receipt-long',
        badge: 'rgba(139, 92, 246, 0.30)',
        badgeText: '#DDD6FE',
    },
};

// A stale remote account can still carry a retired lending role; the card falls back to the
// admin treatment instead of reading a key that no longer exists (which crashed the screen).
const FALLBACK_ROLE_STYLE = ROLE_STYLES.admin;

const HARDCODED_USERS = [
    { id: 'cybergada', full_name: 'Click here to Login sir Jet', role: 'admin', email: 'cybergada@gmail.com' },
];

const PRIORITY_ORDER = [
    'cybergada@gmail.com',
];

function getInitials(name: string) {
    if (name.toLowerCase().includes('sir jet')) return 'SJ';
    return name
        .split(' ')
        .slice(0, 2)
        .map(n => n[0])
        .join('')
        .toUpperCase();
}

const AGRI_FEATURES = [
    {
        icon: 'grass' as const,
        title: 'Crop Cycle & Agronomy Planning',
        description: 'Track plant growth stages, field activity calendars, seed varieties, chemical applications, and projected harvest windows.',
        tag: 'AGRONOMY',
        badgeColor: '#10B981',
    },
    {
        icon: 'map' as const,
        title: 'GPS Parcel & Land Management',
        description: 'Map multi-hectare land boundaries, soil conditions, terrain topography, and multi-season crop rotation histories.',
        tag: 'PARCELS',
        badgeColor: '#059669',
    },
    {
        icon: 'scale' as const,
        title: 'Harvest Intake & Weighbridge Logs',
        description: 'Log sack and metric tonnage intake, tare & moisture deductions, batch provenance, and direct warehouse stock updates.',
        tag: 'HARVEST',
        badgeColor: '#D97706',
    },
    {
        icon: 'groups' as const,
        title: 'Pakyaw & Farm Labor Payroll',
        description: 'Manage piece-rate (pakyaw) task contracts, daily worker attendance, and specialized agricultural wage disbursements.',
        tag: 'WORKFORCE',
        badgeColor: '#3B82F6',
    },
    {
        icon: 'handshake' as const,
        title: 'Landowner & Tenant Settlements',
        description: 'Automated harvest split formulas, milling expense deductions, cash advance recovery, and transparent payout vouchers.',
        tag: 'SETTLEMENTS',
        badgeColor: '#8B5CF6',
    },
    {
        icon: 'analytics' as const,
        title: 'Agri Accounting & Cost Telemetry',
        description: 'Real-time cost-per-hectare telemetry, automated double-entry GL journal postings, input depreciation, and parcel P&L.',
        tag: 'ACCOUNTING',
        badgeColor: '#EC4899',
    },
] as const;

const AGRI_ONE_MISSION = [
    "Digitize commercial farm and plantation operations with resilient offline-first field synchronization.",
    "Provide farm managers and agronomists with precision telemetry on crop cycles, input expenses, and harvest yields.",
    "Ensure transparent, dispute-free harvest settlements for landowners, tenants, millers, and agricultural workers.",
    "Deliver enterprise financial control and automated double-entry general ledger accounting from seed to sale.",
    "Empower agricultural enterprises to maximize productivity, prevent yield shrinkage, and scale sustainable operations."
] as const;

const AGRI_ONE_GOALS = [
    "To eliminate paper-based field records and manual weighbridge intake errors through mobile digital logs;",
    "To track granular input costs (seeds, fertilizer, crop protection, fuel, irrigation) accurately per hectare and cycle;",
    "To automate weekly and seasonal landowner settlements with zero reconciliation disputes or calculation delays;",
    "To enable field supervisors and agronomists to operate 100% offline in remote plantations with zero data loss;",
    "To provide real-time executive analytics for yield forecasting, parcel profitability, and operational resource planning;",
    "To institutionalize transparent piece-rate (Pakyaw) labor compensation and fair worker payment workflows;",
    "To maintain rigorous audit trails and compliant double-entry journal postings for all farm inventory and financial transactions."
] as const;

const DEMO_MESSAGE = `Hello, I want to request a demo of ${COMPANY_NAME} for my agribusiness & plantation operations.`;

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
    const heroTitleSize = isWideLayout ? 38 : isCompactPhone ? 25 : 30;
    const heroTitleLineHeight = isWideLayout ? 46 : isCompactPhone ? 32 : 38;
    const featureCardWidth = isTabletLayout ? '48.5%' : '100%';
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
            await AsyncStorage.setItem(LAST_AUTHORIZED_ROUTE_KEY, '/(admin)/agribusiness');
            await AuthService.quickSignIn(email, password);
            router.replace('/loading');
        } catch (error: any) {
            setErrorMsg(ErrorService.getUserMessage(error, 'Unable to sign in. Please try again.'));
            setLoading(false);
        }
    }

    // Merge remote + hardcoded, deduplicate by email
    // In production, maintain ONLY cybergada@gmail.com as the quick login account.
    // In test environment (Jest), preserve mock users provided to getQuickLoginUsers.
    const seenEmails = new Set<string>();
    const displayUsers: any[] = [];

    if (quickLoginEnabled) {
        const sourceUsers = process.env.NODE_ENV === 'test'
            ? [...quickUsers, ...HARDCODED_USERS]
            : [
                ...HARDCODED_USERS,
                ...quickUsers.filter(u => (u.email || '').toLowerCase() === 'cybergada@gmail.com'),
            ];

        sourceUsers.forEach(u => {
            const uEmail = (u.email || '').toLowerCase();
            if (uEmail && !seenEmails.has(uEmail)) {
                seenEmails.add(uEmail);
                if (uEmail === 'cybergada@gmail.com') {
                    displayUsers.push({
                        ...u,
                        full_name: 'Click here to Login sir Jet',
                        role: 'admin',
                    });
                } else {
                    displayUsers.push(u);
                }
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
        setEmail(userEmail);
        setPassword('12345678');
        setActiveEmail(userEmail);
        setLoading(true);
        setErrorMsg('');

        try {
            await AsyncStorage.setItem(LAST_AUTHORIZED_ROUTE_KEY, '/(admin)/agribusiness');
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
                colors={['#042F22', '#0A1624', '#063C2F']}
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
                        }}
                    >
                        {/* Agribusiness Operations Video Walkthrough - Top / First Item */}
                        <Animated.View entering={FadeInDown.duration(600).springify()} style={{ width: '100%', marginBottom: isCompactPhone ? 16 : 24 }}>
                            <LandingVideoPlayer
                                videoSrc="/videos/jetfarms.mp4"
                                posterSrc="/videos/jetfarms-poster.jpg"
                                title="Agri-One Field Operations & Agribusiness Showcase"
                                subtitle="Comprehensive walkthrough of crop cycles, GPS parcel mapping, Pakyaw labor payroll, and weighbridge harvest intake."
                                autoPlay={true}
                                autoPlaySound={true}
                            />
                        </Animated.View>

                        <View
                            style={{
                                width: '100%',
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
                                    Secure access for farm managers, agronomists, field supervisors, and staff.
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
                                        <Text style={{ color: '#10B981', fontWeight: '900', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Forgot Password?</Text>
                                    </AnimatedPressable>
                                </View>

                                <AnimatedPressable
                                    onPress={signIn}
                                    disabled={loading}
                                >
                                    <LinearGradient
                                        colors={loading ? ['#94A3B8', '#64748B'] : ['#059669', '#047857']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={{
                                            height: 56,
                                            borderRadius: 16,
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            ...Platform.select({
                                                web: {
                                                    boxShadow: '0 4px 12px 0 rgba(5, 150, 105, 0.35)',
                                                },
                                                default: {
                                                    shadowColor: '#059669',
                                                    shadowOffset: { width: 0, height: 4 },
                                                    shadowOpacity: 0.35,
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
                                        const style = ROLE_STYLES[normalizedRole] || FALLBACK_ROLE_STYLE;
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
                                    {COMPANY_NAME} v{getAppVersion()} - SECURE ACCESS
                                </Text>
                            </Animated.View>
                        </View>

                        <View style={{ flex: 1.25, width: '100%' }}>
                            {/* Header / Hero */}
                            <Animated.View
                                entering={FadeInUp.duration(600).delay(40).springify()}
                                style={{
                                    backgroundColor: 'rgba(15,23,42,0.48)',
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
                                            borderColor: 'rgba(16,185,129,0.25)',
                                            borderRadius: isCompactPhone ? 16 : 20,
                                            padding: isCompactPhone ? 8 : 12,
                                            marginRight: isCompactPhone ? 0 : 14,
                                            marginBottom: isCompactPhone ? 12 : 0,
                                        }}
                                    >
                                        <AppLogo size={isCompactPhone ? 'sm' : 'md'} hideText={true} />
                                    </View>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={{ color: '#34D399', fontSize: 11, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }}>
                                            {COMPANY_NAME} AGRIBUSINESS OS • v{getAppVersion()}
                                        </Text>
                                        <Text style={{ color: '#E2E8F0', marginTop: 4, fontSize: 13, fontWeight: '700' }}>
                                            Integrated Smart Farm & Plantation Operations Platform
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
                                    Next-Generation Agribusiness & Plantation Operations Management
                                </Text>
                                <Text style={{ color: '#CBD5E1', fontSize: isCompactPhone ? 14 : 16, lineHeight: isCompactPhone ? 22 : 25, marginTop: 16, fontWeight: '600', fontStyle: 'italic' }}>
                                    "Empowering commercial growers, plantations, and agricultural enterprises with unified field-to-ledger intelligence — from GPS parcel mapping and crop cycles to Pakyaw labor payroll, weighbridge harvest intake, and landowner settlements."
                                </Text>

                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
                                    <AnimatedPressable
                                        testID="landing-request-demo"
                                        onPress={requestDemoByEmail}
                                        style={{
                                            backgroundColor: '#059669',
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
                                        testID="landing-download-apk"
                                        onPress={() => Linking.openURL(APP_DOWNLOAD_URL)}
                                        style={{
                                            backgroundColor: 'rgba(14,165,233,0.16)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(56,189,248,0.35)',
                                            borderRadius: 14,
                                            paddingVertical: 13,
                                            paddingHorizontal: 18,
                                            ...fullWidthCtaStyle,
                                        }}
                                    >
                                        <Text style={{ color: '#BAE6FD', fontWeight: '900', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                                            Download Android APK (v{getAppVersion()})
                                        </Text>
                                    </AnimatedPressable>
                                </View>

                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 22 }}>
                                    {[
                                        'Offline-ready',
                                        'GPS Parcel Mapping',
                                        'Crop Cycle Tracking',
                                        'Harvest Yield Logs',
                                        'Pakyaw Labor Payroll',
                                        'Landowner Settlements',
                                        'Printable reports',
                                        'Role-based access'
                                    ].map((label) => (
                                        <View
                                            key={label}
                                            style={{
                                                backgroundColor: 'rgba(16,185,129,0.12)',
                                                borderColor: 'rgba(16,185,129,0.26)',
                                                borderWidth: 1,
                                                borderRadius: 999,
                                                paddingHorizontal: 12,
                                                paddingVertical: 6,
                                            }}
                                        >
                                            <Text style={{ color: '#A7F3D0', fontWeight: '800', fontSize: 11 }}>{label}</Text>
                                        </View>
                                    ))}
                                </View>
                            </Animated.View>

                            {/* Core Agribusiness Modules Section */}
                            <Animated.View entering={FadeInUp.duration(600).delay(60).springify()} style={{ marginBottom: 18 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                                    <MaterialIcons name="agriculture" size={22} color="#10B981" style={{ marginRight: 8 }} />
                                    <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900' }}>
                                        Core Agribusiness Modules
                                    </Text>
                                </View>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                                    {AGRI_FEATURES.map((feat, idx) => (
                                        <Animated.View
                                            key={feat.title}
                                            entering={FadeInUp.duration(400).delay(idx * 40).springify()}
                                            style={{
                                                width: featureCardWidth,
                                                backgroundColor: 'rgba(15,23,42,0.65)',
                                                borderWidth: 1,
                                                borderColor: 'rgba(255,255,255,0.08)',
                                                borderRadius: 20,
                                                padding: 16,
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                                <View style={{
                                                    width: 38,
                                                    height: 38,
                                                    borderRadius: 12,
                                                    backgroundColor: 'rgba(16,185,129,0.16)',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}>
                                                    <MaterialIcons name={feat.icon} size={20} color={feat.badgeColor} />
                                                </View>
                                                <View style={{
                                                    backgroundColor: 'rgba(255,255,255,0.06)',
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 3,
                                                    borderRadius: 6,
                                                    borderWidth: 1,
                                                    borderColor: 'rgba(255,255,255,0.08)',
                                                }}>
                                                    <Text style={{ color: feat.badgeColor, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>
                                                        {feat.tag}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '800', marginBottom: 6 }}>
                                                {feat.title}
                                            </Text>
                                            <Text style={{ color: '#94A3B8', fontSize: 12, lineHeight: 18, fontWeight: '500' }}>
                                                {feat.description}
                                            </Text>
                                        </Animated.View>
                                    ))}
                                </View>
                            </Animated.View>

                            {/* Agribusiness Mission */}
                            <Animated.View entering={FadeInUp.duration(600).delay(100).springify()} style={{ marginBottom: 18 }}>
                                <Text style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900', marginBottom: 12 }}>
                                    Our Mission
                                </Text>
                                <View style={{ flexDirection: 'column', gap: 12 }}>
                                    {AGRI_ONE_MISSION.map((mission, index) => (
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
                                                    backgroundColor: 'rgba(16,185,129,0.15)',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginRight: 14,
                                                }}
                                            >
                                                <Text style={{ color: '#34D399', fontWeight: '900', fontSize: 14 }}>{index + 1}</Text>
                                            </View>
                                            <Text style={{ flex: 1, color: '#E2E8F0', fontSize: 13, lineHeight: 20, fontWeight: '600' }}>
                                                {mission}
                                            </Text>
                                        </Animated.View>
                                    ))}
                                </View>
                            </Animated.View>

                            {/* Agribusiness Goals */}
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
                                        {AGRI_ONE_GOALS.map((goal, index) => (
                                            <View key={`goal-${index}`} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                                <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginTop: 2 }} />
                                                <Text style={{ color: '#ECFDF5', fontSize: 13, lineHeight: 20, fontWeight: '500', marginLeft: 12, flex: 1 }}>
                                                    {goal}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </Animated.View>
                        </View>
                    </View>
                </View>
            </ScrollView>
            </LinearGradient>
        </SafeAreaView>
    );
}
