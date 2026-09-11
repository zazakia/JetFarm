import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ChartOfAccountsService, CoATree, CoAAccountNode, AccountType, NormalBalance } from '../../../src/services/ChartOfAccountsService';

export default function ChartOfAccounts() {
    const [tree, setTree] = useState<CoATree | null>(null);
    const [search, setSearch] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    
    // Form state
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [type, setType] = useState<AccountType>('asset');
    const [balance, setBalance] = useState<NormalBalance>('debit');
    const [parentCode, setParentCode] = useState('');
    const [isHeader, setIsHeader] = useState(false);
    const [description, setDescription] = useState('');
    const [sortOrder, setSortOrder] = useState('');

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        assets: true,
        liabilities: true,
        equity: true,
        income: true,
        expenses: true,
    });

    const loadCoA = async () => {
        try {
            const data = await ChartOfAccountsService.getTree();
            setTree(data);
        } catch (err) {
            console.error('Failed to load CoA tree:', err);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadCoA();
        }, [])
    );

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    const handleCreateAccount = async () => {
        if (!code || !name) {
            Alert.alert('Error', 'Please fill in both account code and name.');
            return;
        }

        try {
            await ChartOfAccountsService.create({
                code,
                name,
                accountType: type,
                normalBalance: balance,
                parentCode: parentCode || undefined,
                isHeader,
                description: description || undefined,
                sortOrder: sortOrder ? parseFloat(sortOrder) : undefined,
            }, 'System');

            Alert.alert('Success', `Account ${code} created successfully.`);
            setModalVisible(false);
            
            // Reset form
            setCode('');
            setName('');
            setType('asset');
            setBalance('debit');
            setParentCode('');
            setIsHeader(false);
            setDescription('');
            setSortOrder('');
            
            await loadCoA();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to create account.');
        }
    };

    const handleDeleteAccount = async (id: string, code: string, name: string) => {
        Alert.alert(
            'Confirm Delete',
            `Are you sure you want to delete ${code} — ${name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await ChartOfAccountsService.softDelete(id, 'System');
                            Alert.alert('Success', 'Account deleted.');
                            await loadCoA();
                        } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to delete account.');
                        }
                    }
                }
            ]
        );
    };

    // Filter accounts by search query recursively
    const filterNodes = (nodes: CoAAccountNode[]): CoAAccountNode[] => {
        if (!search) return nodes;
        const query = search.toLowerCase();
        
        return nodes
            .map(node => {
                const matches = node.code.toLowerCase().includes(query) || node.name.toLowerCase().includes(query);
                const filteredChildren = filterNodes(node.children);
                if (matches || filteredChildren.length > 0) {
                    return { ...node, children: filteredChildren };
                }
                return null;
            })
            .filter((node): node is CoAAccountNode => node !== null);
    };

    const renderAccountNode = (node: CoAAccountNode, depth = 0) => {
        return (
            <View key={node.code} className="border-b border-gray-50 bg-white">
                <View 
                    className="flex-row items-center justify-between py-3 px-4" 
                    style={{ paddingLeft: 16 + depth * 16 }}
                >
                    <View className="flex-row items-center flex-1">
                        <MaterialIcons 
                            name={node.isHeader ? 'folder' : 'label-important'} 
                            size={16} 
                            color={node.isHeader ? '#1E3A8A' : '#6B7280'} 
                            style={{ marginRight: 8 }}
                        />
                        <View className="flex-1 mr-4">
                            <Text className={`text-sm ${node.isHeader ? 'font-black text-gray-900' : 'font-medium text-gray-700'}`}>
                                {node.code} — {node.name}
                            </Text>
                            {node.description && (
                                <Text className="text-gray-600 text-[10px] mt-0.5" numberOfLines={1}>
                                    {node.description}
                                </Text>
                            )}
                        </View>
                    </View>

                    <View className="flex-row items-center">
                        <View className="bg-gray-100 px-2 py-0.5 rounded-full mr-3">
                            <Text className="text-gray-600 text-[9px] font-bold uppercase">{node.normalBalance}</Text>
                        </View>
                        {!node.isHeader && (
                            <Pressable 
                                testID={`delete-${node.code}`}
                                onPress={() => handleDeleteAccount(node.id, node.code, node.name)}
                                className="p-1 active:bg-gray-100 rounded-full"
                            >
                                <MaterialIcons name="delete" size={16} color="#EF4444" />
                            </Pressable>
                        )}
                    </View>
                </View>
                {node.children.map(child => renderAccountNode(child, depth + 1))}
            </View>
        );
    };

    const renderSection = (title: string, typeKey: keyof CoATree, bgClass: string, textClass: string, icon: keyof typeof MaterialIcons.glyphMap) => {
        if (!tree) return null;
        const nodes = filterNodes(tree[typeKey]);
        if (nodes.length === 0 && search) return null;

        const isExpanded = expandedGroups[typeKey];

        return (
            <View className="mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <Pressable 
                    onPress={() => toggleGroup(typeKey)}
                    className={`flex-row items-center justify-between p-4 ${bgClass}`}
                >
                    <View className="flex-row items-center">
                        <MaterialIcons name={icon} size={20} color={textClass.includes('blue') ? '#1E3A8A' : '#EF4444'} style={{ marginRight: 8 }} />
                        <Text className={`font-black text-sm uppercase tracking-wider ${textClass}`}>{title}</Text>
                    </View>
                    <MaterialIcons 
                        name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                        size={20} 
                        color="#4B5563" 
                    />
                </Pressable>
                
                {isExpanded && (
                    <View>
                        {nodes.length === 0 ? (
                            <Text className="text-gray-600 text-sm text-center py-4">No accounts under this category.</Text>
                        ) : (
                            nodes.map(node => renderAccountNode(node))
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View className="flex-1 bg-gray-50">
            {/* Toolbar */}
            <View className="flex-row p-4 items-center bg-white border-b border-gray-100">
                <View className="flex-1 flex-row bg-gray-100 rounded-xl px-3 py-2 items-center mr-3">
                    <MaterialIcons name="search" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
                    <TextInput
                        className="flex-1 text-sm text-gray-900 py-0"
                        placeholder="Search by code or name..."
                        value={search}
                        onChangeText={setSearch}
                     placeholderTextColor="#9CA3AF"/>
                </View>
                <Pressable
                    testID="add-account-btn"
                    onPress={() => setModalVisible(true)}
                    className="bg-blue-900 p-3 rounded-xl active:bg-blue-800 flex-row items-center"
                >
                    <MaterialIcons name="add" size={20} color="#FFFFFF" />
                </Pressable>
            </View>

            <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
                {renderSection('Assets (1000s)', 'assets', 'bg-blue-50/55', 'text-blue-900', 'account-balance')}
                {renderSection('Liabilities (2000s)', 'liabilities', 'bg-red-50/55', 'text-red-900', 'account-balance-wallet')}
                {renderSection('Equity (3000s)', 'equity', 'bg-purple-50/55', 'text-purple-900', 'pie-chart')}
                {renderSection('Income (4000s)', 'income', 'bg-emerald-50/55', 'text-emerald-900', 'trending-up')}
                {renderSection('Expenses (5000s)', 'expenses', 'bg-orange-50/55', 'text-orange-900', 'money-off')}
            </ScrollView>

            {/* Create Account Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl p-6 h-[85%]">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-gray-900 font-black text-lg">Add New Account</Text>
                            <Pressable onPress={() => setModalVisible(false)} className="p-1">
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                            {/* Account Code */}
                            <Text className="text-gray-600 text-xs font-bold uppercase mb-2">Account Code</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-4 text-gray-900"
                                placeholder="e.g. 1011 (Philippine Standard)"
                                value={code}
                                onChangeText={setCode}
                                keyboardType="numeric"
                             placeholderTextColor="#9CA3AF"/>

                            {/* Account Name */}
                            <Text className="text-gray-600 text-xs font-bold uppercase mb-2">Account Name</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-4 text-gray-900"
                                placeholder="e.g. Cash in Box"
                                value={name}
                                onChangeText={setName}
                             placeholderTextColor="#9CA3AF"/>

                            {/* Account Type */}
                            <Text className="text-gray-600 text-xs font-bold uppercase mb-2">Account Type</Text>
                            <View className="flex-row flex-wrap mb-4 justify-between">
                                {['asset', 'liability', 'equity', 'income', 'expense'].map((t) => (
                                    <Pressable
                                        key={t}
                                        onPress={() => setType(t as AccountType)}
                                        className={`px-3 py-2 rounded-full border border-gray-200 mb-2 ${
                                            type === t ? 'bg-blue-900 border-blue-900' : 'bg-white'
                                        }`}
                                    >
                                        <Text className={`text-xs font-bold capitalize ${type === t ? 'text-white' : 'text-gray-700'}`}>
                                            {t}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            {/* Normal Balance */}
                            <Text className="text-gray-600 text-xs font-bold uppercase mb-2">Normal Balance</Text>
                            <View className="flex-row mb-4">
                                {['debit', 'credit'].map((b) => (
                                    <Pressable
                                        key={b}
                                        onPress={() => setBalance(b as NormalBalance)}
                                        className={`px-4 py-2 rounded-full border border-gray-200 mr-2 flex-1 items-center ${
                                            balance === b ? 'bg-blue-900 border-blue-900' : 'bg-white'
                                        }`}
                                    >
                                        <Text className={`text-xs font-bold capitalize ${balance === b ? 'text-white' : 'text-gray-700'}`}>
                                            {b}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            {/* Parent Code */}
                            <Text className="text-gray-600 text-xs font-bold uppercase mb-2">Parent Account Code (Optional)</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-4 text-gray-900"
                                placeholder="e.g. 1000"
                                value={parentCode}
                                onChangeText={setParentCode}
                                keyboardType="numeric"
                             placeholderTextColor="#9CA3AF"/>

                            {/* Header Switch */}
                            <View className="flex-row items-center justify-between mb-4">
                                <View>
                                    <Text className="text-gray-900 font-bold text-sm">Is Header/Group Account?</Text>
                                    <Text className="text-gray-600 text-[10px]">Header accounts cannot accept ledger postings directly.</Text>
                                </View>
                                <Pressable
                                    onPress={() => setIsHeader(!isHeader)}
                                    className={`w-12 h-6 rounded-full p-0.5 justify-center ${
                                        isHeader ? 'bg-blue-900 items-end' : 'bg-gray-300 items-start'
                                    }`}
                                >
                                    <View className="w-5 h-5 rounded-full bg-white shadow-sm" />
                                </Pressable>
                            </View>

                            {/* Description */}
                            <Text className="text-gray-600 text-xs font-bold uppercase mb-2">Description (Optional)</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-4 text-gray-900 h-20"
                                placeholder="Provide brief notes about this account..."
                                value={description}
                                onChangeText={setDescription}
                                multiline={true}
                                style={{ textAlignVertical: 'top' }}
                             placeholderTextColor="#9CA3AF"/>

                            {/* Sort Order */}
                            <Text className="text-gray-600 text-xs font-bold uppercase mb-2">Sort Order (Optional)</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-6 text-gray-900"
                                placeholder="e.g. 5"
                                value={sortOrder}
                                onChangeText={setSortOrder}
                                keyboardType="numeric"
                             placeholderTextColor="#9CA3AF"/>
                        </ScrollView>

                        {/* Submit Button */}
                        <View className="pt-4 border-t border-gray-100 flex-row">
                            <Pressable
                                onPress={() => setModalVisible(false)}
                                className="flex-1 bg-gray-100 py-3.5 rounded-xl mr-2 items-center active:bg-gray-200"
                            >
                                <Text className="text-gray-700 font-bold text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleCreateAccount}
                                className="flex-1 bg-blue-900 py-3.5 rounded-xl ml-2 items-center active:bg-blue-800"
                            >
                                <Text className="text-white font-bold text-sm">Create Account</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
