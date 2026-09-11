import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, Pressable,
    ActivityIndicator, Alert, SafeAreaView, Modal
} from 'react-native';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import CollectionGroup from '../../../src/database/models/CollectionGroup';
import Collector from '../../../src/database/models/Collector';
import Borrower from '../../../src/database/models/Borrower';
import { MaterialIcons } from '@expo/vector-icons';
import uuid from 'react-native-uuid';
import { useRouter } from 'expo-router';
import { BaseModelService } from '../../../src/services/BaseModelService';

import { safeBack } from '../../../src/utils/navigation';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_COLORS = [
    '#9333EA', '#0D9488', '#2563EB', '#D97706', '#355E3B', '#DC2626', '#9CA3AF',
];

interface EditState {
    name: string;
    collectorId: string;
    collectionDay: number;
}

export default function CollectionGroupsScreen() {
    const router = useRouter();
    const [groups, setGroups] = useState<CollectionGroup[]>([]);
    const [collectors, setCollectors] = useState<Collector[]>([]);
    const [borrowerGroupNames, setBorrowerGroupNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<EditState>({ name: '', collectorId: '', collectionDay: 1 });
    const [showDayPicker, setShowDayPicker] = useState(false);
    const [showCollectorPicker, setShowCollectorPicker] = useState(false);
    const [showGroupPicker, setShowGroupPicker] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [grps, cols, borrowers] = await Promise.all([
                database.get<CollectionGroup>('collection_groups')
                    .query(Q.sortBy('collection_day', Q.asc))
                    .fetch(),
                database.get<Collector>('collectors')
                    .query(Q.where('is_active', true))
                    .fetch(),
                database.get<Borrower>('borrowers').query().fetch(),
            ]);

            const uniqueGroups = [...new Set(
                borrowers
                    .map(b => b.group?.trim())
                    .filter((g): g is string => !!g && g.length > 0)
            )].sort();

            setGroups(grps.filter(g => !g.deletedAt));
            setCollectors(cols);
            setBorrowerGroupNames(uniqueGroups);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const assignedGroupNames = new Set(groups.map(g => g.name));
    const unassignedGroups = borrowerGroupNames.filter(name => !assignedGroupNames.has(name));

    const openCreate = (prefillName?: string) => {
        setEditingId(null);
        setForm({ name: prefillName ?? '', collectorId: collectors[0]?.id ?? '', collectionDay: 1 });
        setShowForm(true);
    };

    const openEdit = (group: CollectionGroup) => {
        setEditingId(group.id);
        setForm({ name: group.name, collectorId: group.collectorId ?? '', collectionDay: group.collectionDay });
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            Alert.alert('Validation', 'Group name is required.');
            return;
        }
        setSaving(true);
        try {
            if (editingId) {
                const existing = groups.find(g => g.id === editingId)!;
                await BaseModelService.update<CollectionGroup>(existing, g => {
                    g.name = form.name.trim();
                    g.collectorId = form.collectorId;
                    g.collectionDay = form.collectionDay;
                });
            } else {
                await BaseModelService.create<CollectionGroup>('collection_groups', g => {
                    g._raw.id = uuid.v4().toString();
                    g.name = form.name.trim();
                    g.collectorId = form.collectorId;
                    g.collectionDay = form.collectionDay;
                    g.isActive = true;
                });
            }

            setShowForm(false);
            fetchData();
        } catch (error) {
            Alert.alert('Error', 'Failed to save collection group.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (group: CollectionGroup) => {
        Alert.alert(
            'Delete Group',
            `Delete "${group.name}"? This will not affect existing borrowers.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                        try {
                            await BaseModelService.update<CollectionGroup>(group, g => {
                                g.deletedAt = Date.now();
                            });

                            fetchData();
                        } catch { Alert.alert('Error', 'Failed to delete group.'); }
                    }
                }
            ]
        );
    };

    const selectedCollectorName = collectors.find(c => c.id === form.collectorId)?.fullName ?? 'All Collectors';

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                <Pressable onPress={() => safeBack(router, '/(admin)')} style={{ padding: 8, marginLeft: -8 }}>
                    <MaterialIcons name="arrow-back" size={24} color="#1E3A8A" />
                </Pressable>
                <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: '#111827' }}>Collection Groups</Text>
                    <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Assign Day → Group</Text>
                </View>
                <Pressable
                    onPress={() => openCreate()}
                    style={{ backgroundColor: '#0D9488', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                    <MaterialIcons name="add" size={18} color="#FFF" />
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>New Group</Text>
                </Pressable>
            </View>

            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#0D9488" />
                </View>
            ) : (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

                    {/* Unassigned Groups Banner */}
                    {unassignedGroups.length > 0 && (
                        <View style={{ backgroundColor: '#FFFBEB', borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#FDE68A' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <MaterialIcons name="warning-amber" size={20} color="#D97706" />
                                <Text style={{ color: '#92400E', fontWeight: '800', fontSize: 14, marginLeft: 8 }}>
                                    {unassignedGroups.length} Borrower Group{unassignedGroups.length > 1 ? 's' : ''} Without Schedule
                                </Text>
                            </View>
                            <Text style={{ color: '#78350F', fontSize: 12, marginBottom: 12 }}>
                                These groups exist in your borrower data but have no assigned collection day. Tap to assign one.
                            </Text>
                            {unassignedGroups.map(name => (
                                <Pressable
                                    key={name}
                                    onPress={() => openCreate(name)}
                                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#FCD34D' }}
                                >
                                    <View style={{ backgroundColor: '#FEF3C7', width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                        <MaterialIcons name="group" size={18} color="#D97706" />
                                    </View>
                                    <Text style={{ flex: 1, color: '#92400E', fontWeight: '700', fontSize: 14 }}>{name}</Text>
                                    <View style={{ backgroundColor: '#D97706', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
                                        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>Assign Day</Text>
                                    </View>
                                </Pressable>
                            ))}
                        </View>
                    )}

                    {/* Assigned Groups */}
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
                        Scheduled Groups ({groups.length})
                    </Text>

                    {groups.length === 0 ? (
                        <View style={{ backgroundColor: '#FFF', borderRadius: 24, padding: 48, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' }}>
                            <MaterialIcons name="group-work" size={56} color="#E5E7EB" />
                            <Text style={{ color: '#111827', fontWeight: '900', fontSize: 17, marginTop: 16 }}>No Groups Scheduled</Text>
                            <Text style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 24 }}>
                                Assign a collection day to the borrower groups above, or create a new group.
                            </Text>
                        </View>
                    ) : (
                        <View style={{ backgroundColor: '#FFF', borderRadius: 24, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' }}>
                            {groups.map((group, idx) => {
                                const dayColor = DAY_COLORS[group.collectionDay] ?? '#6B7280';
                                const collectorName = collectors.find(c => c.id === group.collectorId)?.fullName ?? '—';
                                return (
                                    <View
                                        key={group.id}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
                                            borderBottomWidth: idx < groups.length - 1 ? 1 : 0, borderBottomColor: '#F9FAFB'
                                        }}
                                    >
                                        <View style={{ backgroundColor: dayColor + '20', width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                                            <Text style={{ color: dayColor, fontSize: 10, fontWeight: '900' }}>
                                                {DAY_SHORT[group.collectionDay]}
                                            </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: '#111827', fontWeight: '900', fontSize: 15 }}>{group.name}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 }}>
                                                <MaterialIcons name="person" size={11} color="#9CA3AF" />
                                                <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '600' }}>{collectorName}</Text>
                                                <Text style={{ color: '#E5E7EB' }}>•</Text>
                                                <MaterialIcons name="event" size={11} color="#9CA3AF" />
                                                <Text style={{ color: dayColor, fontSize: 12, fontWeight: '700' }}>
                                                    {DAYS[group.collectionDay]}
                                                </Text>
                                            </View>
                                        </View>
                                        <Pressable onPress={() => openEdit(group)} style={{ padding: 8 }}>
                                            <MaterialIcons name="edit" size={20} color="#6B7280" />
                                        </Pressable>
                                        <Pressable onPress={() => handleDelete(group)} style={{ padding: 8 }}>
                                            <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                                        </Pressable>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* All borrower groups reference chips */}
                    {borrowerGroupNames.length > 0 && (
                        <View style={{ marginTop: 24 }}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
                                All Groups in Borrower Data ({borrowerGroupNames.length})
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {borrowerGroupNames.map(name => {
                                    const isAssigned = assignedGroupNames.has(name);
                                    return (
                                        <View key={name} style={{
                                            flexDirection: 'row', alignItems: 'center', gap: 6,
                                            backgroundColor: isAssigned ? '#F0FDF4' : '#FFFBEB',
                                            borderWidth: 1, borderColor: isAssigned ? '#86EFAC' : '#FDE68A',
                                            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20
                                        }}>
                                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isAssigned ? '#47734B' : '#F59E0B' }} />
                                            <Text style={{ color: isAssigned ? '#15803D' : '#92400E', fontSize: 12, fontWeight: '700' }}>{name}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* Create/Edit Form Modal */}
            <Modal visible={showForm} animationType="slide" transparent>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                    <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                            <Text style={{ fontSize: 20, fontWeight: '900', color: '#111827', flex: 1 }}>
                                {editingId ? 'Edit Group' : 'Assign Collection Day'}
                            </Text>
                            <Pressable onPress={() => setShowForm(false)} style={{ padding: 8 }}>
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        {/* Group Name picker */}
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Group Name</Text>
                        <Pressable
                            onPress={() => setShowGroupPicker(true)}
                            style={{ backgroundColor: '#F9FAFB', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ backgroundColor: '#EEF2FF', width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                                    <MaterialIcons name="group" size={16} color="#6366F1" />
                                </View>
                                <Text style={{ color: form.name ? '#111827' : '#9CA3AF', fontWeight: '700', fontSize: 15 }}>
                                    {form.name || 'Select a group...'}
                                </Text>
                            </View>
                            <MaterialIcons name="expand-more" size={22} color="#6B7280" />
                        </Pressable>

                        {/* Collection Day */}
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Collection Day</Text>
                        <Pressable
                            onPress={() => setShowDayPicker(true)}
                            style={{ backgroundColor: '#F9FAFB', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ backgroundColor: DAY_COLORS[form.collectionDay] + '20', width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                    <Text style={{ color: DAY_COLORS[form.collectionDay], fontSize: 10, fontWeight: '900' }}>{DAY_SHORT[form.collectionDay]}</Text>
                                </View>
                                <Text style={{ color: '#111827', fontWeight: '700', fontSize: 15 }}>{DAYS[form.collectionDay]}</Text>
                            </View>
                            <MaterialIcons name="expand-more" size={22} color="#6B7280" />
                        </Pressable>

                        {/* Collector */}
                        {collectors.length > 0 && (
                            <>
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Assigned Collector</Text>
                                <Pressable
                                    onPress={() => setShowCollectorPicker(true)}
                                    style={{ backgroundColor: '#F9FAFB', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <View style={{ backgroundColor: '#CCFBF1', width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ color: '#0F766E', fontWeight: '900', fontSize: 13 }}>{selectedCollectorName.charAt(0)}</Text>
                                        </View>
                                        <Text style={{ color: '#111827', fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{selectedCollectorName}</Text>
                                    </View>
                                    <MaterialIcons name="expand-more" size={22} color="#6B7280" />
                                </Pressable>
                            </>
                        )}

                        <Pressable
                            onPress={handleSave}
                            disabled={saving}
                            style={{ paddingVertical: 16, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: saving ? '#E5E7EB' : '#0D9488' }}
                        >
                            {saving
                                ? <ActivityIndicator color="white" />
                                : <Text style={{ color: '#FFF', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>
                                    {editingId ? 'Save Changes' : 'Create Group'}
                                </Text>
                            }
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* Group Picker Modal */}
            <Modal visible={showGroupPicker} animationType="fade" transparent>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 24 }} onPress={() => setShowGroupPicker(false)}>
                    <View style={{ backgroundColor: '#FFF', borderRadius: 24, padding: 16, maxHeight: 400 }}>
                        <Text style={{ fontSize: 17, fontWeight: '900', color: '#111827', marginBottom: 12, paddingHorizontal: 8 }}>Select Borrower Group</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {borrowerGroupNames.length === 0 ? (
                                <Text style={{ color: '#9CA3AF', textAlign: 'center', padding: 24 }}>
                                    No groups found in borrower data.
                                </Text>
                            ) : (
                                borrowerGroupNames.map(name => {
                                    const isSelected = form.name === name;
                                    const isAlreadyAssigned = assignedGroupNames.has(name) && !editingId;
                                    return (
                                        <Pressable
                                            key={name}
                                            onPress={() => { setForm(f => ({ ...f, name })); setShowGroupPicker(false); }}
                                            style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 4, backgroundColor: isSelected ? '#CCFBF1' : '#F9FAFB', borderWidth: 1, borderColor: isSelected ? '#5EEAD4' : '#F1F5F9' }}
                                        >
                                            <View style={{ backgroundColor: isSelected ? '#14B8A6' : '#E5E7EB', width: 8, height: 8, borderRadius: 4, marginRight: 12 }} />
                                            <Text style={{ flex: 1, fontWeight: '700', fontSize: 14, color: isSelected ? '#0F766E' : '#111827' }}>{name}</Text>
                                            {isAlreadyAssigned && (
                                                <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                                                    <Text style={{ color: '#065F46', fontSize: 10, fontWeight: '700' }}>Assigned</Text>
                                                </View>
                                            )}
                                            {isSelected && <MaterialIcons name="check-circle" size={18} color="#0D9488" />}
                                        </Pressable>
                                    );
                                })
                            )}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>

            {/* Day Picker Modal */}
            <Modal visible={showDayPicker} animationType="fade" transparent>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 24 }} onPress={() => setShowDayPicker(false)}>
                    <View style={{ backgroundColor: '#FFF', borderRadius: 24, padding: 16 }}>
                        <Text style={{ fontSize: 17, fontWeight: '900', color: '#111827', marginBottom: 12, paddingHorizontal: 8 }}>Select Collection Day</Text>
                        {DAYS.slice(1, 7).map((day, i) => {
                            const dayIdx = i + 1;
                            const isSelected = form.collectionDay === dayIdx;
                            return (
                                <Pressable
                                    key={day}
                                    onPress={() => { setForm(f => ({ ...f, collectionDay: dayIdx })); setShowDayPicker(false); }}
                                    style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 4, backgroundColor: isSelected ? '#F0FDF4' : '#F9FAFB', borderWidth: 1, borderColor: isSelected ? '#86EFAC' : '#F1F5F9' }}
                                >
                                    <View style={{ backgroundColor: DAY_COLORS[dayIdx] + '20', width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                                        <Text style={{ color: DAY_COLORS[dayIdx], fontWeight: '900', fontSize: 11 }}>{DAY_SHORT[dayIdx]}</Text>
                                    </View>
                                    <Text style={{ fontWeight: '700', fontSize: 15, flex: 1, color: isSelected ? '#15803D' : '#111827' }}>{day}</Text>
                                    {isSelected && <MaterialIcons name="check-circle" size={20} color="#0D9488" />}
                                </Pressable>
                            );
                        })}
                    </View>
                </Pressable>
            </Modal>

            {/* Collector Picker Modal */}
            <Modal visible={showCollectorPicker} animationType="fade" transparent>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 24 }} onPress={() => setShowCollectorPicker(false)}>
                    <View style={{ backgroundColor: '#FFF', borderRadius: 24, padding: 16 }}>
                        <Text style={{ fontSize: 17, fontWeight: '900', color: '#111827', marginBottom: 12, paddingHorizontal: 8 }}>Select Collector</Text>
                        {collectors.map(col => {
                            const isSelected = form.collectorId === col.id;
                            return (
                                <Pressable
                                    key={col.id}
                                    onPress={() => { setForm(f => ({ ...f, collectorId: col.id })); setShowCollectorPicker(false); }}
                                    style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 4, backgroundColor: isSelected ? '#CCFBF1' : '#F9FAFB', borderWidth: 1, borderColor: isSelected ? '#5EEAD4' : '#F1F5F9' }}
                                >
                                    <View style={{ backgroundColor: '#CCFBF1', width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                                        <Text style={{ color: '#0F766E', fontWeight: '900' }}>{col.fullName.charAt(0)}</Text>
                                    </View>
                                    <Text style={{ fontWeight: '700', fontSize: 15, flex: 1, color: isSelected ? '#0F766E' : '#111827' }}>{col.fullName}</Text>
                                    {isSelected && <MaterialIcons name="check-circle" size={20} color="#0D9488" />}
                                </Pressable>
                            );
                        })}
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}
