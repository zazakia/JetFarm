import React from 'react';
import { View, Text, Pressable, useWindowDimensions, Modal, SafeAreaView, ScrollView } from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/store/AuthContext';
import { AuthGateLoading } from '../../src/components/AuthGateLoading';
import { ROLE_HOME_ROUTES, UserRole } from '../../src/constants/roles';
import { AppLogo } from '../../src/components/AppLogo';
import { useRolePermissions } from '../../src/hooks/useSettingsConfig';

type MenuItem = {
    icon: keyof typeof MaterialIcons.glyphMap;
    label: string;
    route: string;
};

const BORROWER_MENU: MenuItem[] = [
    { icon: 'dashboard', label: 'Dashboard', route: '/(borrower)' },
    { icon: 'storefront', label: 'Marketplace', route: '/(borrower)/marketplace' },
    { icon: 'store', label: 'Seller Center', route: '/(borrower)/seller-center' },
    { icon: 'receipt-long', label: 'My Loans', route: '/(borrower)/loans' },
    { icon: 'savings', label: 'Savings', route: '/(borrower)/savings-cbu' },
    { icon: 'history', label: 'Payments', route: '/(borrower)/transactions' },
    { icon: 'menu-book', label: 'Manual', route: '/(borrower)/manual' },
    { icon: 'person', label: 'Profile', route: '/(borrower)/profile' },
];

const BORROWER_BOTTOM_NAV: { icon: keyof typeof MaterialIcons.glyphMap; label: string; route?: string; isMore?: boolean }[] = [
    { icon: 'dashboard', label: 'Home', route: '/(borrower)' },
    { icon: 'receipt-long', label: 'Loans', route: '/(borrower)/loans' },
    { icon: 'savings', label: 'Savings', route: '/(borrower)/savings-cbu' },
    { icon: 'storefront', label: 'Shop', route: '/(borrower)/marketplace' },
    { icon: 'menu', label: 'More', isMore: true },
];

export default function BorrowerLayout() {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 720;
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const { signOut, user, role, roleResolved, initialized } = useAuth();
    const { isAllowed } = useRolePermissions(role);
    const routeAllowed = isAllowed('route.(borrower)');

    React.useEffect(() => {
        if (!initialized || !roleResolved) return;

        if (!user || role === null) {
            console.warn('[BorrowerLayout] Missing authorized user role. Redirecting to login...');
            router.replace('/login');
            return;
        }

        if (role !== 'borrower' || !routeAllowed) {
            console.warn(`[BorrowerLayout] Access denied for role: ${role}. Redirecting...`);
            router.replace((routeAllowed ? (ROLE_HOME_ROUTES[role as UserRole] ?? '/login') : '/login') as any);
        }
    }, [initialized, user, role, roleResolved, router, routeAllowed]);

    // Route guard for Borrower portal
    if (initialized && user && !roleResolved) {
        return <AuthGateLoading message="Restoring your access..." />;
    }

    if (initialized && (!user || role !== 'borrower' || !routeAllowed)) {
        console.warn(`[BorrowerLayout] Access denied for role: ${role}. Redirecting...`);
        return <AuthGateLoading message="Redirecting..." />;
    }

    const currentTitle = BORROWER_MENU.find(item => 
        pathname === item.route || pathname.startsWith(item.route + '/')
    )?.label ?? 'Borrower Portal';

    const renderSidebar = () => (
        <View className="flex-1 bg-blue-900">
            <SafeAreaView className="flex-1">
                <View className="p-4 items-center justify-center border-b border-white/10 mb-4 h-24">
                    <View className="bg-white rounded-xl px-3 py-2">
                        <AppLogo size="sm" layout="horizontal" subtitle="Borrower Portal" />
                    </View>
                </View>

                <ScrollView className="flex-1 px-2">
                    {BORROWER_MENU.map(item => {
                        const isActive = pathname === item.route || pathname.startsWith(item.route + '/');
                        return (
                            <Pressable
                                key={item.route}
                                onPress={() => {
                                    router.push(item.route as any);
                                    setDrawerOpen(false);
                                }}
                                className={`flex-row items-center p-4 rounded-xl mb-1 ${isActive ? 'bg-white/10' : 'active:bg-white/5'}`}
                            >
                                <MaterialIcons 
                                    name={item.icon} 
                                    size={22} 
                                    color={isActive ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} 
                                    className="mr-3"
                                />
                                <Text className={`text-sm tracking-wide ${isActive ? 'text-white font-bold' : 'text-white/90 font-medium'}`}>
                                    {item.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>

                <View className="p-4 border-t border-white/10">
                    <Pressable
                        onPress={signOut}
                        className="flex-row items-center p-4 rounded-xl bg-red-500/10 active:bg-red-500/20"
                    >
                        <MaterialIcons name="logout" size={20} color="#EF5350" className="mr-3" />
                        <Text className="text-red-400 font-bold text-sm">Sign Out</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        </View>
    );

    if (isDesktop) {
        return (
            <View className="flex-1 flex-row bg-gray-50">
                <View className="w-64 border-r border-gray-200">
                    {renderSidebar()}
                </View>
                <View className="flex-1">
                    <Slot />
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            <SafeAreaView className="bg-blue-900 shadow-sm z-10">
                <View className="flex-row items-center justify-between p-4">
                    <View className="flex-row items-center flex-1 mr-2">
                        <Pressable onPress={() => setDrawerOpen(true)} className="mr-3 p-1 active:bg-white/10 rounded-full">
                            <MaterialIcons name="menu" size={26} color="#FFFFFF" />
                        </Pressable>
                        <Text numberOfLines={1} className="text-white text-lg font-bold tracking-wide flex-1">{currentTitle}</Text>
                    </View>
                    <Pressable onPress={() => router.push('/(borrower)/profile')} className="w-10 h-10 bg-white/10 rounded-full items-center justify-center border border-white/20 active:bg-white/20">
                        <MaterialIcons name="person" size={24} color="#FFFFFF" />
                    </Pressable>
                </View>
            </SafeAreaView>

            <View className="flex-1">
                <Slot />
            </View>

            {/* Bottom Nav for Mobile */}
            <SafeAreaView className="bg-white border-t border-gray-200 shadow-md">
                <View className="flex-row items-center justify-between px-1 py-1.5">
                    {BORROWER_BOTTOM_NAV.map(item => {
                        const isPrimaryActive = item.route ? (
                            item.route === '/(borrower)' 
                                ? (pathname === '/(borrower)' || pathname === '/(borrower)/') 
                                : pathname.startsWith(item.route)
                        ) : false;

                        const isAnyPrimaryActive = BORROWER_BOTTOM_NAV.some(nav => 
                            nav.route ? (
                                nav.route === '/(borrower)' 
                                    ? (pathname === '/(borrower)' || pathname === '/(borrower)/') 
                                    : pathname.startsWith(nav.route)
                            ) : false
                        );

                        const isActive = item.isMore ? (!isAnyPrimaryActive || drawerOpen) : isPrimaryActive;

                        return (
                            <Pressable
                                key={item.label}
                                onPress={() => {
                                    if (item.isMore) {
                                        setDrawerOpen(true);
                                    } else if (item.route) {
                                        router.push(item.route as any);
                                    }
                                }}
                                className="items-center justify-center py-1 px-1 flex-1 active:opacity-70"
                            >
                                <View className={`items-center justify-center px-3 py-1 rounded-full ${isActive ? 'bg-blue-50' : 'bg-transparent'}`}>
                                    <MaterialIcons
                                        name={item.icon}
                                        size={22}
                                        color={isActive ? '#1E3A8A' : '#64748B'}
                                    />
                                </View>
                                <Text
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                    className={`text-[10px] tracking-tight mt-0.5 ${isActive ? 'text-blue-900 font-bold' : 'text-slate-500 font-medium'}`}
                                >
                                    {item.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </SafeAreaView>

            <Modal visible={drawerOpen} animationType="fade" transparent={true} onRequestClose={() => setDrawerOpen(false)}>
                <View className="flex-1 flex-row">
                    <Pressable className="absolute inset-0 bg-black/50" onPress={() => setDrawerOpen(false)} />
                    <View className="w-72 h-full shadow-2xl">
                        {renderSidebar()}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

export { RouteErrorBoundary as ErrorBoundary } from '../../src/components/RouteErrorBoundary';
