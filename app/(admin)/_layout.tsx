import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, useWindowDimensions, Modal, SafeAreaView } from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/store/AuthContext';
import { SidebarContent, AGRIBUSINESS_MENU, CRISPY_KING_OPERATIONS, FRANCHISE_MENU, LENDING_MENU, MAIN_MENU, ADMIN_MENU, DAILY_REPORTS, WEEKLY_REPORTS, MONTHLY_REPORTS, COOPERATIVE_REPORTS, FINANCIALS_MENU, ACCOUNTING_MENU, BOOKS_OF_ACCOUNTS_MENU, SUPPORT_MENU } from '../../src/components/SidebarContent';
import { SyncStatusBadge } from '../../src/components/SyncStatusBadge';
import { AuthGateLoading } from '../../src/components/AuthGateLoading';
import { ROLE_HOME_ROUTES, UserRole } from '../../src/constants/roles';
import { COMPANY_NAME } from '../../src/constants/brand';
import { useFeatureFlags, useRolePermissions } from '../../src/hooks/useSettingsConfig';
import { getFeatureKeyForRoute } from '../../src/utils/featureFlags';
import { isCrispyKing } from '../../src/config/deployment';

function FeatureDisabledNotice({ featureName }: { featureName: string }) {
    const router = useRouter();
    return (
        <View className="flex-1 justify-center items-center p-6 bg-gray-50">
            <View className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm max-w-md w-full items-center">
                <View className="w-16 h-16 rounded-full bg-amber-100 items-center justify-center mb-4">
                    <MaterialIcons name="lock-outline" size={36} color="#D97706" />
                </View>
                <Text className="text-xl font-bold text-gray-900 text-center mb-2">
                    {featureName} Disabled
                </Text>
                <Text className="text-sm text-gray-600 text-center mb-6 leading-5">
                    This module is currently turned off in Feature Flags settings. You can re-enable it anytime from System Settings.
                </Text>
                <View className="flex-row gap-3 w-full">
                    <Pressable
                        onPress={() => router.push('/(admin)' as any)}
                        className="flex-1 py-3 px-4 rounded-xl bg-gray-100 active:bg-gray-200 items-center"
                    >
                        <Text className="text-sm font-semibold text-gray-800">Dashboard</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => router.push('/(admin)/settings/feature-flags' as any)}
                        className="flex-1 py-3 px-4 rounded-xl bg-blue-900 active:bg-blue-800 items-center"
                    >
                        <Text className="text-sm font-semibold text-white">Open Settings</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

export default function AdminShellLayout() {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 720;
    const [drawerOpen, setDrawerOpen] = useState(false);
    const pathname = usePathname();
    const { user, role, roleResolved, initialized } = useAuth();
    const { isEnabled } = useFeatureFlags();
    const { isAllowed } = useRolePermissions(role);
    const routeAllowed = isAllowed('route.(admin)');
    const router = useRouter();
    const routeFeature = getFeatureKeyForRoute(pathname);
    const isCurrentRouteFeatureEnabled = routeFeature ? isEnabled(routeFeature.featureKey) : true;

    useEffect(() => {
        if (!initialized || !roleResolved) return;

        if (!user || role === null) {
            console.warn('[AdminLayout] Missing authorized user role. Redirecting to login...');
            router.replace('/login');
            return;
        }

        if ((role !== 'admin' && role !== 'main_office') || !routeAllowed) {
            console.warn(`[AdminLayout] Access denied for role: ${role}. Redirecting...`);
            router.replace((routeAllowed ? (ROLE_HOME_ROUTES[role as UserRole] ?? '/login') : '/login') as any);
        }
    }, [initialized, user, role, roleResolved, router, routeAllowed]);

    // Route guard for Admin dashboard
    const isReady = initialized && (!user || roleResolved);

    if (initialized && user && !roleResolved) {
        return <AuthGateLoading message="Restoring your access..." />;
    }

    if (isReady && !user) {
        return <AuthGateLoading message="Redirecting..." />;
    }

    if (initialized && user && roleResolved && ((role !== 'admin' && role !== 'main_office') || !routeAllowed)) {
        console.warn(`[AdminLayout] Access denied for role: ${role}. Redirecting...`);
        return <AuthGateLoading message="Redirecting..." />;
    }

    const currentTitle = [
        ...AGRIBUSINESS_MENU,
        ...(isCrispyKing() ? [...CRISPY_KING_OPERATIONS, ...FRANCHISE_MENU] : []),
        ...LENDING_MENU,
        ...MAIN_MENU,
        ...ADMIN_MENU,
        ...DAILY_REPORTS,
        ...WEEKLY_REPORTS,
        ...MONTHLY_REPORTS,
        ...COOPERATIVE_REPORTS,
        ...FINANCIALS_MENU,
        ...ACCOUNTING_MENU,
        ...BOOKS_OF_ACCOUNTS_MENU,
        ...SUPPORT_MENU
    ]
        .slice()
        .sort((a, b) => b.route.replace('/(admin)', '').length - a.route.replace('/(admin)', '').length)
        .find(item => pathname.replace('/(admin)', '').startsWith(item.route.replace('/(admin)', '')))?.label ?? COMPANY_NAME;

    // Desktop Layout
    if (isDesktop) {
        return (
            <View className="flex-1 flex-row bg-gray-50">
                <View className="w-64 border-r border-gray-200 shadow-sm z-10">
                    <SidebarContent />
                </View>
                <View className="flex-1 bg-gray-50">
                    {!isCurrentRouteFeatureEnabled ? (
                        <FeatureDisabledNotice featureName={routeFeature?.label || 'Feature'} />
                    ) : (
                        <Slot />
                    )}
                </View>
            </View>
        );
    }

    // Mobile Layout
    return (
        <View className="flex-1 bg-gray-50">
            {/* Header - Hidden on dashboard index because it has its own header */}
            {!pathname.endsWith('/(admin)') && !pathname.endsWith('/(admin)/') && (() => {
                const isSubScreen = (path: string) => {
                    const clean = path.replace('/(admin)', '').replace(/\/$/, '');
                    if (!clean || clean === '/') return false;
                    
                    const topLevelPaths = [
                        '/borrowers',
                        '/loans',
                        '/payments',
                        '/expenses',
                        '/payroll',
                        '/users',
                        '/collectors',
                        '/reports/dashboard',
                        '/settings'
                    ];
                    return !topLevelPaths.includes(clean);
                };

                const showBackButton = isSubScreen(pathname) && router.canGoBack();

                return (
                    <SafeAreaView className="bg-blue-900 shadow-sm z-10">
                        <View className="flex-row items-center justify-between p-4">
                            <View className="flex-row items-center">
                                {showBackButton ? (
                                    <Pressable onPress={() => router.back()} className="mr-4 p-1 active:bg-white/10 rounded-full">
                                        <MaterialIcons name="arrow-back" size={28} color="#FFFFFF" />
                                    </Pressable>
                                ) : (
                                    <Pressable onPress={() => setDrawerOpen(true)} className="mr-4 p-1 active:bg-white/10 rounded-full">
                                        <MaterialIcons name="menu" size={28} color="#FFFFFF" />
                                    </Pressable>
                                )}
                                <Text className="text-white text-lg font-bold tracking-wide">{currentTitle}</Text>
                            </View>
                            <View className="flex-row items-center">
                                <SyncStatusBadge />
                                <Pressable className="bg-white/10 p-2 rounded-full active:bg-white/20 ml-2">
                                    <MaterialIcons name="notifications-none" size={24} color="#FFFFFF" />
                                </Pressable>
                            </View>
                        </View>
                    </SafeAreaView>
                );
            })()}

            {/* Main Content */}
            <View className="flex-1">
                {!isCurrentRouteFeatureEnabled ? (
                    <FeatureDisabledNotice featureName={routeFeature?.label || 'Feature'} />
                ) : (
                    <Slot />
                )}
            </View>

            {/* Bottom Navigation (First 4 items) */}
            <SafeAreaView className="bg-white border-t border-gray-200">
                <View className="flex-row justify-around py-2">
                    {MAIN_MENU.filter(item => isEnabled(item.featureKey) && isAllowed(item.permissionKey ?? item.featureKey)).slice(0, 4).map(item => {
                        const isActive = pathname.replace('/(admin)', '').startsWith(item.route.replace('/(admin)', ''));
                        return (
                            <Pressable
                                key={item.route}
                                onPress={() => router.push(item.route as any)}
                                className="items-center justify-center p-2 flex-1"
                            >
                                <MaterialIcons
                                    name={item.icon}
                                    size={24}
                                    color={isActive ? '#1E3A8A' : '#9CA3AF'}
                                    className="mb-1"
                                />
                                <Text className={`text-[10px] font-medium ${isActive ? 'text-blue-900' : 'text-gray-700'}`}>
                                    {item.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </SafeAreaView>

            {/* Mobile Drawer Overflow Modal */}
            <Modal
                visible={drawerOpen}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setDrawerOpen(false)}
            >
                <View className="flex-1 flex-row">
                    {/* Dark overlay backdrop */}
                    <Pressable
                        className="absolute inset-0 bg-black/50"
                        onPress={() => setDrawerOpen(false)}
                    />

                    {/* Drawer Content */}
                    <View className="w-72 bg-blue-900 h-full shadow-2xl">
                        <SidebarContent onClose={() => setDrawerOpen(false)} />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

export { RouteErrorBoundary as ErrorBoundary } from '../../src/components/RouteErrorBoundary';
