import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import { database } from '../../../../src/database';
import Borrower from '../../../../src/database/models/Borrower';
import { MaterialIcons } from '@expo/vector-icons';
import { COMPANY_NAME } from '../../../../src/constants/brand';
import { logoBase64 } from '../../../../src/utils/logoBase64';
import { formatDate } from '../../../../src/utils/dates';

const printHtml = async (html: string) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
        return;
    }
    await Print.printAsync({ html });
};

export default function RegistryOfMembershipScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const b = await database.collections.get<Borrower>('borrowers').find(id);
                setBorrower(b);
            } catch (e) {
                Alert.alert('Error', 'Failed to load member profile.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const buildHtml = () => {
        if (!borrower) return '';
        return `<html><head><style>
            body { font-family: Arial, sans-serif; padding: 40px; font-size: 11px; line-height: 1.5; }
            .header { text-align: center; margin-bottom: 25px; border-b: 2px solid #1E3A8A; padding-bottom: 15px; }
            .brand-logo { width: 60px; height: 60px; object-fit: contain; }
            .title { font-size: 20px; font-weight: bold; text-transform: uppercase; color: #1E3A8A; letter-spacing: 2px; }
            .subtitle { font-size: 14px; font-weight: bold; margin-top: 4px; color: #374151; letter-spacing: 1.5px; }
            .section { margin-bottom: 20px; border: 1px solid #E5E7EB; padding: 15px; border-radius: 8px; }
            .section-title { font-weight: bold; font-size: 12px; text-transform: uppercase; color: #1E3A8A; border-bottom: 1px solid #D1D5DB; padding-bottom: 5px; margin-bottom: 12px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .label { color: #6B7280; font-weight: bold; font-size: 10px; text-transform: uppercase; }
            .value { font-weight: bold; color: #111827; font-size: 12px; margin-top: 2px; }
            .full-width { grid-column: span 2; }
            .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
            .sig { text-align: center; width: 45%; }
            .sig-line { border-top: 1px solid #000; padding-top: 5px; font-weight: bold; font-size: 11px; }
        </style></head><body>
            <div class="header">
                <img class="brand-logo" src="${logoBase64}" alt="${COMPANY_NAME} logo"/>
                <div class="title">${COMPANY_NAME}</div>
                <div class="subtitle">REGISTRY OF MEMBERSHIP</div>
                <div style="font-size: 10px; color: #4B5563; margin-top: 4px;">Member ID / Ref: <strong>${borrower.memberId || borrower.id}</strong></div>
            </div>

            <div class="section">
                <div class="section-title">Personal Information</div>
                <div class="grid">
                    <div><div class="label">Full Name</div><div class="value">${borrower.fullName}</div></div>
                    <div><div class="label">Member ID</div><div class="value">${borrower.memberId || 'N/A'}</div></div>
                    <div><div class="label">Date of Birth</div><div class="value">${borrower.dateOfBirth ? formatDate(borrower.dateOfBirth) : 'N/A'}</div></div>
                    <div><div class="label">Birthplace</div><div class="value">${borrower.birthplace || 'N/A'}</div></div>
                    <div><div class="label">Civil Status</div><div class="value" style="text-transform: capitalize;">${borrower.civilStatus || 'N/A'}</div></div>
                    <div><div class="label">Phone / Mobile</div><div class="value">${borrower.phone || 'N/A'}</div></div>
                    <div class="full-width"><div class="label">Residential Address</div><div class="value">${borrower.address || 'N/A'}</div></div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Cooperative & Financial Profile</div>
                <div class="grid">
                    <div><div class="label">Date Joined</div><div class="value">${borrower.dateJoined ? formatDate(borrower.dateJoined) : 'N/A'}</div></div>
                    <div><div class="label">Membership Status</div><div class="value" style="text-transform: uppercase;">${borrower.membershipStatus || 'Active'}</div></div>
                    <div><div class="label">Assigned Group</div><div class="value">${borrower.group || 'N/A'}</div></div>
                    <div><div class="label">Nature of Business / Occupation</div><div class="value">${borrower.business || 'N/A'}</div></div>
                    <div><div class="label">Co-Maker Name</div><div class="value">${borrower.coMakerName || 'N/A'}</div></div>
                    <div><div class="label">Mother's Maiden Name</div><div class="value">${borrower.motherMaidenName || 'N/A'}</div></div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Government IDs & Compliance</div>
                <div class="grid">
                    <div><div class="label">TIN</div><div class="value">${borrower.tinNumber || 'N/A'}</div></div>
                    <div><div class="label">SSS Number</div><div class="value">${borrower.sssNumber || 'N/A'}</div></div>
                    <div><div class="label">GSIS Number</div><div class="value">${borrower.gsisNumber || 'N/A'}</div></div>
                    <div><div class="label">PhilHealth Number</div><div class="value">${borrower.philhealthNumber || 'N/A'}</div></div>
                </div>
            </div>

            <div class="signatures">
                <div class="sig">
                    <div style="height: 40px;"></div>
                    <div class="sig-line">Member Signature</div>
                </div>
                <div class="sig">
                    <div style="height: 40px;"></div>
                    <div class="sig-line">Board Secretary / Authorized Officer</div>
                </div>
            </div>
        </body></html>`;
    };

    if (loading) return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;
    if (!borrower) return <View className="flex-1 items-center justify-center bg-gray-50"><Text>Member profile not found.</Text></View>;

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                <View className="flex-row items-center mb-4">
                    <MaterialIcons name="assignment-ind" size={28} color="#1E3A8A" className="mr-3" />
                    <View>
                        <Text className="text-2xl font-black text-gray-900">Registry of Membership</Text>
                        <Text className="text-gray-500 font-bold text-xs">{borrower.fullName} • Member ID: {borrower.memberId || borrower.id}</Text>
                    </View>
                </View>

                <View className="bg-blue-50 border border-blue-100 p-4 rounded-2xl mb-6">
                    <Text className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">Member Records Summary</Text>
                    <View className="flex-row justify-between py-1 border-b border-blue-100">
                        <Text className="text-xs text-gray-600 font-bold">Address</Text>
                        <Text className="text-xs text-gray-900 font-bold">{borrower.address || 'N/A'}</Text>
                    </View>
                    <View className="flex-row justify-between py-1 border-b border-blue-100">
                        <Text className="text-xs text-gray-600 font-bold">Phone</Text>
                        <Text className="text-xs text-gray-900 font-bold">{borrower.phone || 'N/A'}</Text>
                    </View>
                    <View className="flex-row justify-between py-1">
                        <Text className="text-xs text-gray-600 font-bold">Date Joined</Text>
                        <Text className="text-xs text-gray-900 font-bold">{borrower.dateJoined ? formatDate(borrower.dateJoined) : 'N/A'}</Text>
                    </View>
                </View>

                <Pressable
                    className="w-full bg-blue-900 rounded-2xl py-4 flex-row justify-center items-center active:bg-blue-800 shadow-lg"
                    onPress={() => printHtml(buildHtml())}
                >
                    <MaterialIcons name="print" size={22} color="#FFFFFF" className="mr-2" />
                    <Text className="text-white font-black text-base uppercase tracking-wider">Print Registry of Membership</Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}
