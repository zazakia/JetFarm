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

export default function MembershipAgreementScreen() {
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
            @page { size: A4; margin: 20mm; }
            body { font-family: Arial, sans-serif; font-size: 11px; line-height: 1.6; color: #1F2937; }
            .page { page-break-after: always; padding: 20px; box-sizing: border-box; min-height: 900px; position: relative; }
            .page:last-child { page-break-after: avoid; }
            .header { text-align: center; margin-bottom: 25px; border-b: 2px solid #1E3A8A; padding-bottom: 12px; }
            .brand-logo { width: 56px; height: 56px; object-fit: contain; }
            .title { font-size: 18px; font-weight: bold; text-transform: uppercase; color: #1E3A8A; letter-spacing: 2px; }
            .subtitle { font-size: 13px; font-weight: bold; margin-top: 4px; color: #4B5563; letter-spacing: 1.5px; }
            .page-number { position: absolute; bottom: 15px; right: 20px; font-size: 9px; color: #9CA3AF; font-weight: bold; }
            .section { margin-bottom: 20px; border: 1px solid #E5E7EB; padding: 15px; border-radius: 8px; }
            .section-title { font-weight: bold; font-size: 11px; text-transform: uppercase; color: #1E3A8A; border-bottom: 1px solid #E5E7EB; padding-bottom: 4px; margin-bottom: 10px; }
            .clause { margin-bottom: 12px; text-align: justify; }
            .clause-title { font-weight: bold; color: #111827; margin-bottom: 3px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .label { color: #6B7280; font-weight: bold; font-size: 9px; text-transform: uppercase; }
            .value { font-weight: bold; color: #111827; font-size: 11px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
            .sig { text-align: center; width: 45%; }
            .sig-line { border-top: 1px solid #000; padding-top: 5px; font-weight: bold; font-size: 11px; }
        </style></head><body>

            <!-- PAGE 1: MEMBERSHIP APPLICATION & AGREEMENT -->
            <div class="page">
                <div class="header">
                    <img class="brand-logo" src="${logoBase64}" alt="${COMPANY_NAME} logo"/>
                    <div class="title">${COMPANY_NAME}</div>
                    <div class="subtitle">MEMBERSHIP AND SUBSCRIPTION AGREEMENT</div>
                    <div style="font-size: 10px; color: #6B7280; margin-top: 3px;">Page 1 of 2 — Application & Personal Covenants</div>
                </div>

                <div class="section">
                    <div class="section-title">Member Details</div>
                    <div class="grid">
                        <div><div class="label">Applicant Full Name</div><div class="value">${borrower.fullName}</div></div>
                        <div><div class="label">Member ID / Reference</div><div class="value">${borrower.memberId || borrower.id}</div></div>
                        <div><div class="label">Civil Status</div><div class="value" style="text-transform: capitalize;">${borrower.civilStatus || 'N/A'}</div></div>
                        <div><div class="label">Contact Number</div><div class="value">${borrower.phone || 'N/A'}</div></div>
                        <div style="grid-column: span 2;"><div class="label">Permanent Address</div><div class="value">${borrower.address || 'N/A'}</div></div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Terms of Membership</div>
                    <div class="clause">
                        <div class="clause-title">1. Application for Membership</div>
                        I hereby apply for regular membership in <strong>${COMPANY_NAME}</strong>. I agree to abide by the Articles of Cooperation, By-Laws, policy guidelines, and lawful decisions passed by the Board of Directors and the General Assembly.
                    </div>
                    <div class="clause">
                        <div class="clause-title">2. Membership Duties & Obligations</div>
                        As a member in good standing, I pledge to attend general assembly meetings, patronize cooperative business services, participate in education seminars, and continuously promote the welfare and purpose of the cooperative.
                    </div>
                    <div class="clause">
                        <div class="clause-title">3. Share Capital Subscription & Capital Build-Up (CBU)</div>
                        I agree to subscribe to share capital units of the cooperative and regularly contribute to Capital Build-Up (CBU) through voluntary deposits or loan retention deductions in accordance with cooperative rules.
                    </div>
                </div>

                <div class="signatures">
                    <div class="sig">
                        <div style="height: 45px;"></div>
                        <div class="sig-line">Applicant / Member Signature</div>
                    </div>
                    <div class="sig">
                        <div style="height: 45px;"></div>
                        <div class="sig-line">Date Signed</div>
                    </div>
                </div>

                <div class="page-number">Page 1 of 2</div>
            </div>

            <!-- PAGE 2: SUBSCRIPTION AGREEMENT & BOARD APPROVAL -->
            <div class="page">
                <div class="header">
                    <img class="brand-logo" src="${logoBase64}" alt="${COMPANY_NAME} logo"/>
                    <div class="title">${COMPANY_NAME}</div>
                    <div class="subtitle">MEMBERSHIP AND SUBSCRIPTION AGREEMENT</div>
                    <div style="font-size: 10px; color: #6B7280; margin-top: 3px;">Page 2 of 2 — Subscription Covenants & Board Authorization</div>
                </div>

                <div class="section">
                    <div class="section-title">Share Subscription Covenant</div>
                    <div class="clause">
                        <div class="clause-title">4. Payment of Subscribed Capital</div>
                        I understand that share capital payments constitute the risk capital of the cooperative. Withdrawals of share capital are governed strictly by CDA guidelines and cooperative policy upon termination of membership.
                    </div>
                    <div class="clause">
                        <div class="clause-title">5. Dividends & Patronage Refunds</div>
                        Earnings of the cooperative shall be distributed in the form of Interest on Share Capital and Patronage Refunds after allocating reserves required by law (Reserve Fund, Education Fund, Community Development Fund, Optional Fund).
                    </div>
                    <div class="clause">
                        <div class="clause-title">6. Authorization for Set-Off & Lien</div>
                        I hereby grant the cooperative a first lien on all my shares, savings deposits, and accumulated dividends to secure any unpaid loans, interest, or financial obligations incurred with the cooperative.
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Action of the Board of Directors / Membership Committee</div>
                    <p style="margin-bottom: 15px;">
                        This Membership and Subscription Agreement of <strong>${borrower.fullName}</strong> was formally reviewed and:
                    </p>
                    <div style="display: flex; gap: 20px; font-weight: bold; margin-bottom: 20px;">
                        <div>[ X ] APPROVED</div>
                        <div>[   ] DEFERRED</div>
                        <div>[   ] DISAPPROVED</div>
                    </div>
                    <div>Date Approved / Effective: <strong>${borrower.dateJoined ? formatDate(borrower.dateJoined) : new Date().toLocaleDateString()}</strong></div>
                </div>

                <div class="signatures">
                    <div class="sig">
                        <div style="height: 45px;"></div>
                        <div class="sig-line">Membership Committee Chairperson</div>
                    </div>
                    <div class="sig">
                        <div style="height: 45px;"></div>
                        <div class="sig-line">Chairman of the Board / CEO</div>
                    </div>
                </div>

                <div class="page-number">Page 2 of 2</div>
            </div>

        </body></html>`;
    };

    if (loading) return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;
    if (!borrower) return <View className="flex-1 items-center justify-center bg-gray-50"><Text>Member profile not found.</Text></View>;

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                <View className="flex-row items-center mb-4">
                    <MaterialIcons name="description" size={28} color="#1E3A8A" className="mr-3" />
                    <View>
                        <Text className="text-xl font-black text-gray-900">Membership & Subscription Agreement</Text>
                        <Text className="text-gray-500 font-bold text-xs">{borrower.fullName} • 2-Page Official Document</Text>
                    </View>
                </View>

                <View className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl mb-6">
                    <Text className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2">Document Details</Text>
                    <Text className="text-xs text-indigo-800 font-medium leading-5">
                        This is a 2-page document containing the Member Application, Personal Covenants, Share Capital Subscription, and Board of Directors Approval.
                    </Text>
                </View>

                <Pressable
                    className="w-full bg-blue-900 rounded-2xl py-4 flex-row justify-center items-center active:bg-blue-800 shadow-lg"
                    onPress={() => printHtml(buildHtml())}
                >
                    <MaterialIcons name="print" size={22} color="#FFFFFF" className="mr-2" />
                    <Text className="text-white font-black text-base uppercase tracking-wider">Print Agreement (2 Pages)</Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}
