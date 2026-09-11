import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { database } from '../../../src/database';
import UserProfile from '../../../src/database/models/UserProfile';
import Collector from '../../../src/database/models/Collector';
import Borrower from '../../../src/database/models/Borrower';
import { Q } from '@nozbe/watermelondb';
import { BaseModelService } from '../../../src/services/BaseModelService';

import uuid from 'react-native-uuid';
import { useAuth } from '../../../src/store/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { EncryptionService } from '../../../src/services/EncryptionService';
import { parseDateLocal } from '../../../src/utils/dates';
import { handleFormValidationError, handleSaveError } from '../../../src/utils/errorAlerts';

const schema = z.object({
    fullName: z.string().min(2, "Name is required"),
    address: z.string().optional(),
    phone: z.string().optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    notes: z.string().optional(),
    collectorId: z.string().optional(),
    group: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    coMakerName: z.string().optional(),
    business: z.string().optional(),
    bankName: z.string().optional(),
    bankAccountName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankBranch: z.string().optional(),
    dateOfBirth: z.string().optional(),
    memberId: z.string().optional(),
    cycleId: z.string().optional().refine(v => !v || !isNaN(parseInt(v, 10)), 'Cycle must be a number'),
    loanCode: z.string().optional(),
    dateJoined: z.string().optional(),
    membershipStatus: z.enum(['active', 'inactive']).optional(),
    deceased: z.boolean().optional(),
    dateOfDeath: z.string().optional(),
    middleName: z.string().optional(),
    nameSuffix: z.string().optional(),
    birthplace: z.string().optional(),
    civilStatus: z.enum(['single', 'married', 'widowed', 'separated', 'annulled']).optional(),
    numberOfDependents: z.string().optional().refine(v => !v || !isNaN(parseInt(v, 10)), 'Must be a number'),
    spouseFirstName: z.string().optional(),
    spouseMiddleName: z.string().optional(),
    motherMaidenName: z.string().optional(),
    tinNumber: z.string().optional(),
    sssNumber: z.string().optional(),
    gsisNumber: z.string().optional(),
    philhealthNumber: z.string().optional(),
    barangay: z.string().optional(),
    cityMunicipality: z.string().optional(),
    province: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewBorrowerScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [collectors, setCollectors] = useState<Collector[]>([]);
    const [saving, setSaving] = useState(false);

    const { control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            fullName: '',
            address: '',
            phone: '',
            gender: 'other',
            notes: '',
            collectorId: '',
            group: '',
            firstName: '',
            lastName: '',
            coMakerName: '',
            business: '',
            bankName: '',
            bankAccountName: '',
            bankAccountNumber: '',
            bankBranch: '',
            dateOfBirth: '',
            memberId: '',
            cycleId: '1',
            loanCode: 'LC10K',
            dateJoined: new Date().toISOString().split('T')[0],
            membershipStatus: 'active',
            deceased: false,
            dateOfDeath: '',
            middleName: '', nameSuffix: '', birthplace: '', civilStatus: 'single', numberOfDependents: '0', spouseFirstName: '', spouseMiddleName: '', motherMaidenName: '', tinNumber: '', sssNumber: '', gsisNumber: '', philhealthNumber: '', barangay: '', cityMunicipality: '', province: ''
        }
    });

    useEffect(() => {
        const fetchCollectors = async () => {
            const items = await database.collections.get<Collector>('collectors').query(
                Q.where('is_active', true)
            ).fetch();
            setCollectors(items);
        };
        fetchCollectors();
    }, []);

    const onSubmit = async (data: FormData) => {
        setSaving(true);
        try {
            await BaseModelService.create<Borrower>('borrowers', borrower => {

                borrower._raw.id = uuid.v4().toString();
                borrower.fullName = data.fullName.trim();
                borrower.address = EncryptionService.encrypt(data.address?.trim() || null);
                borrower.phone = EncryptionService.encrypt(data.phone?.trim() || null);
                borrower.gender = data.gender || null;
                borrower.notes = data.notes?.trim() || null;
                borrower.collectorId = data.collectorId || null;
                borrower.group = data.group?.trim() || null;
                borrower.firstName = data.firstName?.trim() || null;
                borrower.lastName = data.lastName?.trim() || null;
                borrower.coMakerName = data.coMakerName?.trim() || null;
                borrower.business = data.business?.trim() || null;
                borrower.bankName = data.bankName?.trim() || null;
                borrower.bankAccountName = data.bankAccountName?.trim() || data.fullName.trim();
                borrower.bankAccountNumber = data.bankAccountNumber?.trim() || null;
                borrower.bankBranch = data.bankBranch?.trim() || null;
                borrower.dateOfBirth = parseDateLocal(data.dateOfBirth) ?? null;
                borrower.createdBy = user?.id || null;
                borrower.memberId = data.memberId?.trim() || null;
                borrower.cycleId = data.cycleId ? parseInt(data.cycleId, 10) : null;
                borrower.loanCode = data.loanCode?.trim() || null;
                borrower.dateJoined = parseDateLocal(data.dateJoined) ?? null;
                borrower.membershipStatus = data.membershipStatus || null;
                (borrower as any).deceased = data.deceased || false;
                (borrower as any).dateOfDeath = data.deceased ? (parseDateLocal(data.dateOfDeath) ?? null) : null;
                borrower.middleName = data.middleName?.trim() || null;
                borrower.nameSuffix = data.nameSuffix?.trim() || null;
                borrower.birthplace = data.birthplace?.trim() || null;
                borrower.civilStatus = data.civilStatus || null;
                borrower.numberOfDependents = data.numberOfDependents ? parseInt(data.numberOfDependents, 10) : null;
                borrower.spouseFirstName = data.spouseFirstName?.trim() || null;
                borrower.spouseMiddleName = data.spouseMiddleName?.trim() || null;
                borrower.motherMaidenName = data.motherMaidenName?.trim() || null;
                borrower.tinNumber = data.tinNumber?.trim() || null;
                borrower.sssNumber = data.sssNumber?.trim() || null;
                borrower.gsisNumber = data.gsisNumber?.trim() || null;
                borrower.philhealthNumber = data.philhealthNumber?.trim() || null;
                borrower.barangay = data.barangay?.trim() || null;
                borrower.cityMunicipality = data.cityMunicipality?.trim() || null;
                borrower.province = data.province?.trim() || null;
                // dates handled by TS model / default values
            });

            safeBack(router, '/(admin)');
        } catch (error) {
            handleSaveError(error, 'Borrower', 'save');
            setSaving(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 20 }}>
            <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <Text className="text-2xl font-extrabold text-gray-900 mb-6">New Borrower</Text>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Full Name *</Text>
                    <Controller
                        control={control}
                        name="fullName"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                                testID="borrower-full-name-input"
                                className={`bg-gray-50 p-4 rounded-xl border ${errors.fullName ? 'border-red-500' : 'border-gray-200'} text-gray-900`}
                                onChangeText={onChange}
                                onBlur={onBlur}
                                value={value}
                                placeholder="Juan Dela Cruz"
                                editable={!saving}
                             placeholderTextColor="#9CA3AF"/>
                        )}
                    />
                    {errors.fullName && <Text className="text-red-500 text-xs mt-1">{errors.fullName.message}</Text>}
                </View>

                <View className="flex-row mb-4">
                    <View className="flex-1 mr-2">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">First Name</Text>
                        <Controller
                            control={control}
                            name="firstName"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <TextInput
                                    className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900"
                                    onChangeText={onChange}
                                    onBlur={onBlur}
                                    value={value || ''}
                                    placeholder="First Name"
                                    editable={!saving}
                                 placeholderTextColor="#9CA3AF"/>
                            )}
                        />
                    </View>
                    <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Last Name</Text>
                        <Controller
                            control={control}
                            name="lastName"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <TextInput
                                    className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900"
                                    onChangeText={onChange}
                                    onBlur={onBlur}
                                    value={value || ''}
                                    placeholder="Last Name"
                                    editable={!saving}
                                 placeholderTextColor="#9CA3AF"/>
                            )}
                        />
                    </View>
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Phone</Text>
                    <Controller
                        control={control}
                        name="phone"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                                className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900"
                                onChangeText={onChange}
                                onBlur={onBlur}
                                value={value || ''}
                                placeholder="09XX-XXX-XXXX"
                                keyboardType="phone-pad"
                                editable={!saving}
                             placeholderTextColor="#9CA3AF"/>
                        )}
                    />
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Address</Text>
                    <Controller
                        control={control}
                        name="address"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                                className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900"
                                onChangeText={onChange}
                                onBlur={onBlur}
                                value={value || ''}
                                placeholder="Block 1, Lot 2, Phase 3..."
                                multiline
                                editable={!saving}
                             placeholderTextColor="#9CA3AF"/>
                        )}
                    />
                </View>

                <View className="flex-row mb-4">
                    <View className="flex-1 mr-2">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Gender</Text>
                        <Controller
                            control={control}
                            name="gender"
                            render={({ field: { onChange, value } }) => (
                                <View className="flex-row items-center">
                                    {['male', 'female', 'other'].map(g => (
                                        <Pressable
                                            key={g}
                                            onPress={() => onChange(g)}
                                            disabled={saving}
                                            className={`px-3 py-3 rounded-xl border mr-2 flex-1 items-center ${value === g ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200'}`}
                                        >
                                            <Text className={`capitalize font-bold text-xs ${value === g ? 'text-blue-700' : 'text-gray-600'}`}>
                                                {g.charAt(0).toUpperCase()}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            )}
                        />
                    </View>
                    <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Date of Birth</Text>
                        <Controller
                            control={control}
                            name="dateOfBirth"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <TextInput
                                    className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900"
                                    onChangeText={onChange}
                                    onBlur={onBlur}
                                    value={value || ''}
                                    placeholder="YYYY-MM-DD"
                                    editable={!saving}
                                 placeholderTextColor="#9CA3AF"/>
                            )}
                        />
                    </View>
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Group</Text>
                    <Controller
                        control={control}
                        name="group"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                                className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900"
                                onChangeText={onChange}
                                onBlur={onBlur}
                                value={value || ''}
                                placeholder="e.g. Group A, Market Group..."
                                editable={!saving}
                             placeholderTextColor="#9CA3AF"/>
                        )}
                    />
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Co-Maker Name</Text>
                    <Controller
                        control={control}
                        name="coMakerName"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                                className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900"
                                onChangeText={onChange}
                                onBlur={onBlur}
                                value={value || ''}
                                placeholder="Co-Maker Name"
                                editable={!saving}
                             placeholderTextColor="#9CA3AF"/>
                        )}
                    />
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Business</Text>
                    <Controller
                        control={control}
                        name="business"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                                className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900"
                                onChangeText={onChange}
                                onBlur={onBlur}
                                value={value || ''}
                                placeholder="Nature of Business"
                                editable={!saving}
                             placeholderTextColor="#9CA3AF"/>
                        )}
                    />
                </View>

                <View className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
                    <Text className="text-xs font-black text-blue-900 mb-3 uppercase tracking-wider">Land Bank Submission Details</Text>
                    <View className="mb-3">
                        <Text className="text-[10px] font-bold text-blue-700 mb-1 uppercase">Bank Name</Text>
                        <Controller control={control} name="bankName" render={({ field: { onChange, value } }) => (
                            <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} />
                        )} />
                    </View>
                    <View className="mb-3">
                        <Text className="text-[10px] font-bold text-blue-700 mb-1 uppercase">Account Name</Text>
                        <Controller control={control} name="bankAccountName" render={({ field: { onChange, value } }) => (
                            <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="Defaults to borrower name"  placeholderTextColor="#9CA3AF"/>
                        )} />
                    </View>
                    <View className="flex-row">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-blue-700 mb-1 uppercase">Account No.</Text>
                            <Controller control={control} name="bankAccountNumber" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="0000-0000-00"  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-blue-700 mb-1 uppercase">Branch</Text>
                            <Controller control={control} name="bankBranch" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="LA CARLOTA"  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                    </View>
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Assign to Collector</Text>
                    <Controller
                        control={control}
                        name="collectorId"
                        render={({ field: { onChange, value } }) => (
                            <View className="border border-gray-200 rounded-xl overflow-hidden">
                                {collectors.length === 0 ? (
                                    <Text className="p-4 text-gray-700">No collectors found.</Text>
                                ) : (
                                    collectors.map((c, i) => (
                                        <Pressable
                                            key={c.id}
                                            onPress={() => onChange(value === c.id ? '' : c.id)}
                                            className={`p-4 flex-row justify-between items-center ${i < collectors.length - 1 ? 'border-b border-gray-100' : ''} ${value === c.id ? 'bg-blue-50' : 'bg-gray-50'}`}
                                        >
                                            <Text className={value === c.id ? 'text-blue-700 font-bold' : 'text-gray-700 font-medium'}>{c.fullName}</Text>
                                            {value === c.id && <MaterialIcons name="check" size={20} color="#1D4ED8" />}
                                        </Pressable>
                                    ))
                                ) || <Text>Loading...</Text>}
                            </View>
                        )}
                    />
                </View>

                <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                    <Text className="text-xs font-black text-amber-900 mb-3 uppercase tracking-wider">Membership & Loan Profile</Text>
                    <View className="mb-3">
                        <Text className="text-[10px] font-bold text-amber-800 mb-1 uppercase">Member ID</Text>
                        <Controller control={control} name="memberId" render={({ field: { onChange, value } }) => (
                            <TextInput testID="borrower-member-id-input" className="bg-white p-3 rounded-xl border border-amber-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="e.g. AG00033"  placeholderTextColor="#9CA3AF"/>
                        )} />
                    </View>
                    <View className="flex-row mb-3">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-amber-800 mb-1 uppercase">Cycle ID *</Text>
                            <Controller control={control} name="cycleId" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-amber-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} keyboardType="numeric" placeholder="1"  placeholderTextColor="#9CA3AF"/>
                            )} />
                            {errors.cycleId && <Text className="text-red-500 text-xs mt-1">{errors.cycleId.message}</Text>}
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-amber-800 mb-1 uppercase">Loan Code</Text>
                            <Controller control={control} name="loanCode" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-amber-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="e.g. LC10K"  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                    </View>
                    <View className="flex-row">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-amber-800 mb-1 uppercase">Date Joined</Text>
                            <Controller control={control} name="dateJoined" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-amber-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="YYYY-MM-DD"  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-amber-800 mb-1 uppercase">Membership Status</Text>
                            <Controller control={control} name="membershipStatus" render={({ field: { onChange, value } }) => (
                                <View className="flex-row bg-white rounded-xl border border-amber-100 overflow-hidden p-1">
                                    {['active', 'inactive'].map(status => (
                                        <Pressable key={status} onPress={() => onChange(status)} className={`flex-1 py-1.5 items-center rounded-lg ${value === status ? 'bg-amber-600' : ''}`}>
                                            <Text className={`text-[10px] font-black uppercase ${value === status ? 'text-white' : 'text-gray-600'}`}>{status}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            )} />
                        </View>
                    </View>
                    <View className="flex-row mt-3">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-red-800 mb-1 uppercase">Deceased Status</Text>
                            <Controller control={control} name="deceased" render={({ field: { onChange, value } }) => (
                                <View className="flex-row bg-white rounded-xl border border-amber-100 overflow-hidden p-1">
                                    {[{ label: 'Active', val: false }, { label: 'Deceased', val: true }].map(opt => (
                                        <Pressable key={opt.label} onPress={() => onChange(opt.val)} className={`flex-1 py-1.5 items-center rounded-lg ${value === opt.val ? 'bg-red-600' : ''}`}>
                                            <Text className={`text-[10px] font-black uppercase ${value === opt.val ? 'text-white' : 'text-gray-600'}`}>{opt.label}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-red-800 mb-1 uppercase">Date of Death</Text>
                            <Controller control={control} name="dateOfDeath" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-amber-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="YYYY-MM-DD"  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                    </View>
                </View>

                {/* --- CIC COMPLIANCE SECTION --- */}
                <View className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
                    <View className="flex-row items-center justify-between mb-4 border-b border-blue-100 pb-2">
                        <Text className="text-xs font-black text-blue-900 uppercase tracking-wider">CIC Compliance & Demographics</Text>
                        {(() => {
                            const v = watch();
                            const missing = [];
                            if (!v.middleName) missing.push('Middle Name');
                            if (!v.dateOfBirth) missing.push('Date of Birth');
                            if (!v.birthplace) missing.push('Birthplace');
                            if (!v.civilStatus) missing.push('Civil Status');
                            if (!v.tinNumber && !v.sssNumber && !v.gsisNumber) missing.push('Gov ID');
                            
                            return missing.length === 0 ? (
                                <View className="bg-green-100 px-2 py-1 rounded-full flex-row items-center">
                                    <MaterialIcons name="check-circle" size={12} color="#16A34A" style={{ marginRight: 4 }} />
                                    <Text className="text-green-700 text-[9px] font-bold uppercase">CIC Ready</Text>
                                </View>
                            ) : (
                                <View className="bg-red-100 px-2 py-1 rounded-full flex-row items-center">
                                    <MaterialIcons name="error-outline" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text className="text-red-700 text-[9px] font-bold uppercase">{missing.length} Missing</Text>
                                </View>
                            );
                        })()}
                    </View>

                    <View className="flex-row mb-3">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-blue-800 mb-1 uppercase">Middle Name <Text className="text-red-500">*</Text></Text>
                            <Controller control={control} name="middleName" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="Required for CIC" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-blue-800 mb-1 uppercase">Name Suffix</Text>
                            <Controller control={control} name="nameSuffix" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="Jr., Sr., III" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                    </View>

                    <View className="flex-row mb-3">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-blue-800 mb-1 uppercase">Birthplace <Text className="text-red-500">*</Text></Text>
                            <Controller control={control} name="birthplace" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="City, Province" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-blue-800 mb-1 uppercase">Civil Status <Text className="text-red-500">*</Text></Text>
                            <Controller control={control} name="civilStatus" render={({ field: { onChange, value } }) => (
                                <View className="bg-white rounded-xl border border-blue-100 overflow-hidden">
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 4 }}>
                                        {['single', 'married', 'widowed', 'separated', 'annulled'].map(status => (
                                            <Pressable key={status} onPress={() => onChange(status)} className={`px-3 py-2 mr-1 rounded-lg ${value === status ? 'bg-blue-600' : ''}`}>
                                                <Text className={`text-[10px] font-bold capitalize ${value === status ? 'text-white' : 'text-gray-600'}`}>{status}</Text>
                                            </Pressable>
                                        ))}
                                    </ScrollView>
                                </View>
                            )} />
                        </View>
                    </View>

                    <View className="flex-row mb-3">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-blue-800 mb-1 uppercase">No. of Dependents</Text>
                            <Controller control={control} name="numberOfDependents" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} keyboardType="numeric" placeholder="0" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-blue-800 mb-1 uppercase">Mother's Maiden Name</Text>
                            <Controller control={control} name="motherMaidenName" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="Full maiden name" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                    </View>

                    <Text className="text-[10px] font-bold text-blue-800 mb-1 uppercase mt-2 border-t border-blue-100 pt-3">Government IDs (At least 1 required)</Text>
                    <View className="flex-row mb-3 mt-1">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-gray-500 mb-1 uppercase">TIN</Text>
                            <Controller control={control} name="tinNumber" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="xxx-xxx-xxx-xxx" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-gray-500 mb-1 uppercase">SSS</Text>
                            <Controller control={control} name="sssNumber" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="xx-xxxxxxx-x" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                    </View>
                    <View className="flex-row mb-3">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-gray-500 mb-1 uppercase">GSIS</Text>
                            <Controller control={control} name="gsisNumber" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="GSIS number" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-gray-500 mb-1 uppercase">PhilHealth</Text>
                            <Controller control={control} name="philhealthNumber" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="xx-xxxxxxxxx-x" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                    </View>
                    
                    <Text className="text-[10px] font-bold text-blue-800 mb-1 uppercase mt-2 border-t border-blue-100 pt-3">Spouse Info (If married)</Text>
                    <View className="flex-row mb-1 mt-1">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-gray-500 mb-1 uppercase">Spouse First Name</Text>
                            <Controller control={control} name="spouseFirstName" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} editable={!saving} />
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-gray-500 mb-1 uppercase">Spouse Middle</Text>
                            <Controller control={control} name="spouseMiddleName" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} editable={!saving} />
                            )} />
                        </View>
                    </View>
                </View>

                <View className="mb-8">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Notes</Text>
                    <Controller
                        control={control}
                        name="notes"
                        render={({ field: { onChange, value } }) => (
                            <TextInput
                                className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 h-24 text-top"
                                onChangeText={onChange}
                                value={value || ''}
                                multiline
                                textAlignVertical="top"
                                editable={!saving}
                            />
                        )}
                    />
                </View>

                <Pressable
                    testID="save-borrower-button"
                    className={`w-full py-4 rounded-xl items-center flex-row justify-center ${saving ? 'bg-red-400' : 'bg-red-700 active:bg-red-800'}`}
                    onPress={handleSubmit(onSubmit, (errs) => handleFormValidationError(errs, 'Borrower'))}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : (
                        <>
                            <MaterialIcons name="save" size={20} color="#fff" className="mr-2" />
                            <Text className="text-white font-bold text-lg">Save Borrower</Text>
                        </>
                    )}
                </Pressable>
            </View>
        </ScrollView>
    );
}
