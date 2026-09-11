import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import RolePermission from '../../../src/database/models/RolePermission';
import { SettingsService } from '../../../src/services/SettingsService';
import { ROLE_LABELS, UserRole } from '../../../src/constants/roles';
import { useAuth } from '../../../src/store/AuthContext';
import { safeBack } from '../../../src/utils/navigation';

const ADMIN_ROUTE_PERMISSION_KEY = 'route.(admin)';
const ADMIN_ROLES = new Set<UserRole>(['admin', 'main_office']);

export default function RoleAccessSettingsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [permissions, setPermissions] = useState<RolePermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [selectedRole, setSelectedRole] = useState<UserRole>('admin');

    const load = async () => {
        setLoading(true);
        try {
            setPermissions(await SettingsService.getRolePermissions());
        } catch (error) {
            console.error('[RoleAccessSettings] load failed:', error);
            Alert.alert('Settings Error', 'Unable to load role permissions.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const roles = useMemo(() => Array.from(new Set(permissions.map(permission => permission.role))) as UserRole[], [permissions]);
    const visiblePermissions = permissions.filter(permission => permission.role === selectedRole);

    const toggle = async (permission: RolePermission, enabled: boolean) => {
        if (
            !enabled
            && permission.permissionKey === ADMIN_ROUTE_PERMISSION_KEY
            && ADMIN_ROLES.has(permission.role as UserRole)
        ) {
            Alert.alert(
                'Protected Access',
                'Admin and Main Office dashboard access cannot be disabled from the app. This prevents locking all administrators out of Settings.'
            );
            return;
        }

        setSavingId(permission.id);
        try {
            await SettingsService.setRolePermissionEnabled(permission, enabled, user?.id);
            await load();
        } catch (error: any) {
            Alert.alert('Save Failed', error?.message || 'Unable to update role permission.');
        } finally {
            setSavingId(null);
        }
    };

    if (loading) {
        return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="flex-row items-center p-4 bg-white border-b border-gray-100">
                <Pressable onPress={() => safeBack(router, '/(admin)/settings/business-rules')} className="p-2 -ml-2">
                    <MaterialIcons name="arrow-back" size={24} color="#1E3A8A" />
                </Pressable>
                <View className="ml-2 flex-1">
                    <Text className="text-xl font-black text-gray-900">Role Access</Text>
                    <Text className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">Route and module permissions</Text>
                </View>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                    {roles.map(role => (
                        <Pressable
                            key={role}
                            onPress={() => setSelectedRole(role)}
                            className={`mr-2 px-4 py-3 rounded-2xl border ${selectedRole === role ? 'bg-blue-900 border-blue-900' : 'bg-white border-gray-100'}`}
                        >
                            <Text className={`font-black text-xs ${selectedRole === role ? 'text-white' : 'text-gray-700'}`}>
                                {ROLE_LABELS[role] ?? role}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>

                <View className="bg-blue-50 border border-blue-100 rounded-3xl p-5 mb-4">
                    <Text className="text-blue-900 font-black text-sm">Access defaults stay safe</Text>
                    <Text className="text-blue-800 text-xs leading-4 mt-1">
                        Role access controls menus and route/module availability. Admin and Main Office should keep Settings access enabled.
                    </Text>
                </View>

                {visiblePermissions.map(permission => (
                    <View key={permission.id} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-3 flex-row items-center">
                        <View className="flex-1 pr-4">
                            <Text className="text-gray-900 font-black text-base">{permission.label}</Text>
                            <Text className="text-gray-700 text-[10px] font-bold uppercase tracking-widest mt-1">{permission.category}</Text>
                            <Text className="text-gray-500 text-[9px] mt-1">{permission.permissionKey}</Text>
                        </View>
                        {savingId === permission.id ? (
                            <ActivityIndicator color="#1E3A8A" />
                        ) : (
                            <Switch
                                value={permission.enabled !== false}
                                trackColor={{ true: '#1E3A8A' }}
                                onValueChange={value => toggle(permission, value)}
                            />
                        )}
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
