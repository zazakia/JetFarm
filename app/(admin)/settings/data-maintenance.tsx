import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    TextInput,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    Switch,
    Modal,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { safeBack } from '../../../src/utils/navigation';
import { formatPHP } from '../../../src/utils/currency';
import {
    LookupDataService,
    LookupCategory,
    LookupItem,
    LOOKUP_CATEGORIES_CATALOG,
} from '../../../src/services/LookupDataService';
import { MasterDataService } from '../../../src/services/MasterDataService';
import Branch from '../../../src/database/models/Branch';
import Warehouse from '../../../src/database/models/Warehouse';
import MarketplaceCategory from '../../../src/database/models/MarketplaceCategory';
import StatutoryRate from '../../../src/database/models/StatutoryRate';
import Supplier from '../../../src/database/models/Supplier';

type MainTab = 'lookups' | 'locations' | 'categories' | 'suppliers' | 'statutory' | 'directories';

export default function DataMaintenanceScreen() {
    const router = useRouter();
    const [currentTab, setCurrentTab] = useState<MainTab>('lookups');
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // --- LOOKUPS STATE ---
    const [selectedCategory, setSelectedCategory] = useState<LookupCategory>('uom');
    const [lookupItems, setLookupItems] = useState<LookupItem[]>([]);
    const [lookupModalVisible, setLookupModalVisible] = useState(false);
    const [editingLookupItem, setEditingLookupItem] = useState<LookupItem | null>(null);
    const [lookupName, setLookupName] = useState('');
    const [lookupCode, setLookupCode] = useState('');
    const [lookupDesc, setLookupDesc] = useState('');
    const [lookupSaving, setLookupSaving] = useState(false);

    // --- BRANCHES & WAREHOUSES STATE ---
    const [branches, setBranches] = useState<Branch[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [locationSubTab, setLocationSubTab] = useState<'branches' | 'warehouses'>('branches');
    const [branchModalVisible, setBranchModalVisible] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [branchName, setBranchName] = useState('');
    const [branchCode, setBranchCode] = useState('');
    const [branchIsHq, setBranchIsHq] = useState(false);
    const [warehouseModalVisible, setWarehouseModalVisible] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
    const [warehouseBranchId, setWarehouseBranchId] = useState('');
    const [warehouseName, setWarehouseName] = useState('');
    const [warehouseType, setWarehouseType] = useState('store');

    // --- PRODUCT CATEGORIES STATE ---
    const [prodCategories, setProdCategories] = useState<MarketplaceCategory[]>([]);
    const [categoryModalVisible, setCategoryModalVisible] = useState(false);
    const [editingCategory, setEditingCategory] = useState<MarketplaceCategory | null>(null);
    const [categoryName, setCategoryName] = useState('');
    const [categorySlug, setCategorySlug] = useState('');
    const [categoryIcon, setCategoryIcon] = useState('category');

    // --- SUPPLIERS STATE ---
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [supplierModalVisible, setSupplierModalVisible] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [supplierName, setSupplierName] = useState('');
    const [supplierContact, setSupplierContact] = useState('');
    const [supplierPhone, setSupplierPhone] = useState('');
    const [supplierEmail, setSupplierEmail] = useState('');
    const [supplierAddress, setSupplierAddress] = useState('');
    const [supplierTin, setSupplierTin] = useState('');
    const [supplierTerms, setSupplierTerms] = useState('30');

    // --- STATUTORY RATES STATE ---
    const [statutoryRates, setStatutoryRates] = useState<StatutoryRate[]>([]);
    const [statutoryFilter, setStatutoryFilter] = useState<string>('all');
    const [statutoryModalVisible, setStatutoryModalVisible] = useState(false);
    const [rateType, setRateType] = useState<'sss' | 'philhealth' | 'pagibig'>('sss');
    const [bracketMin, setBracketMin] = useState('');
    const [bracketMax, setBracketMax] = useState('');
    const [employeeShare, setEmployeeShare] = useState('');
    const [employerShare, setEmployerShare] = useState('');
    const [rateDescription, setRateDescription] = useState('');

    // =========================================================================
    // DATA LOADERS
    // =========================================================================
    const loadLookups = useCallback(async () => {
        setLoading(true);
        try {
            const items = await LookupDataService.getLookupItems(selectedCategory);
            setLookupItems(items);
        } catch (e) {
            console.error('Failed to load lookup items', e);
        } finally {
            setLoading(false);
        }
    }, [selectedCategory]);

    const loadLocations = useCallback(async () => {
        setLoading(true);
        try {
            const [bList, wList] = await Promise.all([
                MasterDataService.getBranches(true),
                MasterDataService.getWarehouses(undefined, true),
            ]);
            setBranches(bList);
            setWarehouses(wList);
            if (bList.length > 0 && !warehouseBranchId) {
                setWarehouseBranchId(bList[0].id);
            }
        } catch (e) {
            console.error('Failed to load locations', e);
        } finally {
            setLoading(false);
        }
    }, [warehouseBranchId]);

    const loadProdCategories = useCallback(async () => {
        setLoading(true);
        try {
            const list = await MasterDataService.getCategories(true);
            setProdCategories(list);
        } catch (e) {
            console.error('Failed to load product categories', e);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadSuppliers = useCallback(async () => {
        setLoading(true);
        try {
            const list = await MasterDataService.getSuppliers(true);
            setSuppliers(list);
        } catch (e) {
            console.error('Failed to load suppliers', e);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadStatutoryRates = useCallback(async () => {
        setLoading(true);
        try {
            const list = await MasterDataService.getStatutoryRates(
                statutoryFilter === 'all' ? undefined : statutoryFilter
            );
            setStatutoryRates(list);
        } catch (e) {
            console.error('Failed to load statutory rates', e);
        } finally {
            setLoading(false);
        }
    }, [statutoryFilter]);

    useEffect(() => {
        if (currentTab === 'lookups') loadLookups();
        else if (currentTab === 'locations') loadLocations();
        else if (currentTab === 'categories') loadProdCategories();
        else if (currentTab === 'suppliers') loadSuppliers();
        else if (currentTab === 'statutory') loadStatutoryRates();
    }, [currentTab, loadLookups, loadLocations, loadProdCategories, loadSuppliers, loadStatutoryRates]);

    // =========================================================================
    // LOOKUP ACTIONS
    // =========================================================================
    const handleOpenAddLookup = () => {
        setEditingLookupItem(null);
        setLookupName('');
        setLookupCode('');
        setLookupDesc('');
        setLookupModalVisible(true);
    };

    const handleOpenEditLookup = (item: LookupItem) => {
        setEditingLookupItem(item);
        setLookupName(item.name);
        setLookupCode(item.code || '');
        setLookupDesc(item.description || '');
        setLookupModalVisible(true);
    };

    const handleSaveLookup = async () => {
        if (!lookupName.trim()) {
            Alert.alert('Required Field', 'Please enter a name for this lookup item.');
            return;
        }
        setLookupSaving(true);
        try {
            await LookupDataService.saveLookupItem(selectedCategory, {
                id: editingLookupItem?.id,
                name: lookupName.trim(),
                code: lookupCode.trim() || undefined,
                description: lookupDesc.trim() || undefined,
            });
            setLookupModalVisible(false);
            loadLookups();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to save lookup item.');
        } finally {
            setLookupSaving(false);
        }
    };

    const handleToggleLookupActive = async (item: LookupItem) => {
        try {
            await LookupDataService.toggleLookupItemStatus(selectedCategory, item.id);
            loadLookups();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to update status.');
        }
    };

    const handleDeleteLookup = (item: LookupItem) => {
        const confirmMsg = `Are you sure you want to remove "${item.name}" from ${selectedCategory} selections?`;
        const execute = async () => {
            await LookupDataService.deleteLookupItem(selectedCategory, item.id);
            loadLookups();
        };

        if (Platform.OS === 'web') {
            if (window.confirm(confirmMsg)) execute();
        } else {
            Alert.alert('Remove Option', confirmMsg, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: execute },
            ]);
        }
    };

    const handleResetCategoryDefaults = () => {
        const confirmMsg = `Reset "${selectedCategory}" back to default options? Custom additions will be overwritten.`;
        const execute = async () => {
            await LookupDataService.resetCategoryToDefaults(selectedCategory);
            loadLookups();
        };

        if (Platform.OS === 'web') {
            if (window.confirm(confirmMsg)) execute();
        } else {
            Alert.alert('Reset to Defaults', confirmMsg, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reset', style: 'destructive', onPress: execute },
            ]);
        }
    };

    // =========================================================================
    // BRANCH ACTIONS
    // =========================================================================
    const handleSaveBranch = async () => {
        if (!branchName.trim()) {
            Alert.alert('Required Field', 'Please enter a branch name.');
            return;
        }
        try {
            if (editingBranch) {
                await MasterDataService.updateBranch(editingBranch.id, {
                    name: branchName.trim(),
                    code: branchCode.trim() || undefined,
                    isHq: branchIsHq,
                });
            } else {
                await MasterDataService.createBranch({
                    name: branchName.trim(),
                    code: branchCode.trim() || undefined,
                    isHq: branchIsHq,
                    isActive: true,
                });
            }
            setBranchModalVisible(false);
            loadLocations();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to save branch.');
        }
    };

    const handleToggleBranch = async (b: Branch) => {
        try {
            await MasterDataService.toggleBranchActive(b.id);
            loadLocations();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to update branch.');
        }
    };

    // =========================================================================
    // WAREHOUSE ACTIONS
    // =========================================================================
    const handleSaveWarehouse = async () => {
        if (!warehouseName.trim() || !warehouseBranchId) {
            Alert.alert('Required Fields', 'Please select a branch and enter a warehouse location name.');
            return;
        }
        try {
            if (editingWarehouse) {
                await MasterDataService.updateWarehouse(editingWarehouse.id, {
                    branchId: warehouseBranchId,
                    name: warehouseName.trim(),
                    type: warehouseType,
                });
            } else {
                await MasterDataService.createWarehouse({
                    branchId: warehouseBranchId,
                    name: warehouseName.trim(),
                    type: warehouseType,
                    isActive: true,
                });
            }
            setWarehouseModalVisible(false);
            loadLocations();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to save warehouse.');
        }
    };

    const handleToggleWarehouse = async (w: Warehouse) => {
        try {
            await MasterDataService.toggleWarehouseActive(w.id);
            loadLocations();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to update warehouse.');
        }
    };

    // =========================================================================
    // PRODUCT CATEGORY ACTIONS
    // =========================================================================
    const handleSaveCategory = async () => {
        if (!categoryName.trim()) {
            Alert.alert('Required Field', 'Please enter a category name.');
            return;
        }
        try {
            if (editingCategory) {
                await MasterDataService.updateCategory(editingCategory.id, {
                    name: categoryName.trim(),
                    slug: categorySlug.trim() || undefined,
                    icon: categoryIcon.trim() || 'category',
                });
            } else {
                await MasterDataService.createCategory({
                    name: categoryName.trim(),
                    slug: categorySlug.trim() || undefined,
                    icon: categoryIcon.trim() || 'category',
                    isActive: true,
                });
            }
            setCategoryModalVisible(false);
            loadProdCategories();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to save category.');
        }
    };

    const handleToggleCategory = async (cat: MarketplaceCategory) => {
        try {
            await MasterDataService.toggleCategoryActive(cat.id);
            loadProdCategories();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to update category.');
        }
    };

    // =========================================================================
    // SUPPLIER ACTIONS
    // =========================================================================
    const handleSaveSupplier = async () => {
        if (!supplierName.trim()) {
            Alert.alert('Required Field', 'Please enter a supplier or vendor name.');
            return;
        }
        try {
            const days = parseInt(supplierTerms, 10) || 30;
            if (editingSupplier) {
                await MasterDataService.updateSupplier(editingSupplier.id, {
                    name: supplierName.trim(),
                    contactPerson: supplierContact.trim() || undefined,
                    phone: supplierPhone.trim() || undefined,
                    email: supplierEmail.trim() || undefined,
                    address: supplierAddress.trim() || undefined,
                    tin: supplierTin.trim() || undefined,
                    paymentTermsDays: days,
                });
            } else {
                await MasterDataService.createSupplier({
                    name: supplierName.trim(),
                    contactPerson: supplierContact.trim() || undefined,
                    phone: supplierPhone.trim() || undefined,
                    email: supplierEmail.trim() || undefined,
                    address: supplierAddress.trim() || undefined,
                    tin: supplierTin.trim() || undefined,
                    paymentTermsDays: days,
                });
            }
            setSupplierModalVisible(false);
            loadSuppliers();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to save supplier.');
        }
    };

    const handleToggleSupplier = async (s: Supplier) => {
        try {
            await MasterDataService.toggleSupplierActive(s.id);
            loadSuppliers();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to update supplier.');
        }
    };

    // =========================================================================
    // STATUTORY RATE ACTIONS
    // =========================================================================
    const handleSaveStatutoryRate = async () => {
        const minVal = parseFloat(bracketMin);
        const eeVal = parseFloat(employeeShare);
        const erVal = parseFloat(employerShare);

        if (isNaN(minVal) || isNaN(eeVal) || isNaN(erVal)) {
            Alert.alert('Validation Error', 'Please enter valid numerical amounts for brackets and shares.');
            return;
        }

        const maxVal = bracketMax.trim() ? parseFloat(bracketMax) : null;

        try {
            await MasterDataService.createStatutoryRate({
                rateType,
                bracketMin: minVal,
                bracketMax: maxVal,
                employeeShare: eeVal,
                employerShare: erVal,
                effectiveFrom: new Date(),
                description: rateDescription.trim() || undefined,
            });
            setStatutoryModalVisible(false);
            loadStatutoryRates();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to save statutory rate.');
        }
    };

    const handleDeleteStatutoryRate = async (id: string) => {
        const confirmMsg = 'Are you sure you want to archive this rate bracket?';
        const execute = async () => {
            await MasterDataService.deleteStatutoryRate(id);
            loadStatutoryRates();
        };

        if (Platform.OS === 'web') {
            if (window.confirm(confirmMsg)) execute();
        } else {
            Alert.alert('Delete Rate', confirmMsg, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: execute },
            ]);
        }
    };

    // Filter lookups by search query
    const filteredLookupItems = lookupItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const activeLookupsCount = lookupItems.filter(i => i.isActive).length;

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-100">
                <View className="flex-row items-center">
                    <Pressable
                        testID="data-maintenance-back-btn"
                        onPress={() => safeBack(router, '/(admin)/settings')}
                        className="p-2 -ml-2 rounded-xl active:bg-gray-100"
                    >
                        <MaterialIcons name="arrow-back" size={24} color="#1E3A8A" />
                    </Pressable>
                    <View className="ml-2">
                        <Text className="text-xl font-black text-gray-900">Data Maintenance</Text>
                        <Text className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                            Master tables & dropdown selection lookups
                        </Text>
                    </View>
                </View>
            </View>

            {/* Main Tabs Navigation Bar */}
            <View className="bg-white border-b border-gray-200">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row px-4 py-2">
                    <TabButton
                        label="Dropdown Lookups"
                        icon="list-alt"
                        active={currentTab === 'lookups'}
                        onPress={() => setCurrentTab('lookups')}
                    />
                    <TabButton
                        label="Branches & Locations"
                        icon="store"
                        active={currentTab === 'locations'}
                        onPress={() => setCurrentTab('locations')}
                    />
                    <TabButton
                        label="Product Categories"
                        icon="category"
                        active={currentTab === 'categories'}
                        onPress={() => setCurrentTab('categories')}
                    />
                    <TabButton
                        label="Suppliers"
                        icon="local-shipping"
                        active={currentTab === 'suppliers'}
                        onPress={() => setCurrentTab('suppliers')}
                    />
                    <TabButton
                        label="Statutory Rates"
                        icon="receipt-long"
                        active={currentTab === 'statutory'}
                        onPress={() => setCurrentTab('statutory')}
                    />
                    <TabButton
                        label="Directories"
                        icon="folder-shared"
                        active={currentTab === 'directories'}
                        onPress={() => setCurrentTab('directories')}
                    />
                </ScrollView>
            </View>

            {/* TAB CONTENT */}
            {currentTab === 'lookups' && (
                <View className="flex-1">
                    {/* Category Selector Chips */}
                    <View className="bg-white border-b border-gray-100 py-2.5 px-4">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                            {LOOKUP_CATEGORIES_CATALOG.map(cat => {
                                const isSelected = selectedCategory === cat.key;
                                return (
                                    <Pressable
                                        key={cat.key}
                                        onPress={() => {
                                            setSelectedCategory(cat.key);
                                            setSearchQuery('');
                                        }}
                                        className={`px-3 py-2 rounded-xl flex-row items-center border ${
                                            isSelected ? 'bg-blue-900 border-blue-900' : 'bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        <MaterialIcons
                                            name={cat.icon as any}
                                            size={16}
                                            color={isSelected ? '#FFFFFF' : '#4B5563'}
                                            style={{ marginRight: 6 }}
                                        />
                                        <Text
                                            className={`text-xs font-bold ${
                                                isSelected ? 'text-white' : 'text-gray-700'
                                            }`}
                                        >
                                            {cat.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Category Subtitle & Action Bar */}
                    <View className="p-4 bg-white border-b border-gray-100 flex-row justify-between items-center">
                        <View className="flex-1 pr-3">
                            <Text className="text-sm font-black text-gray-900">
                                {LOOKUP_CATEGORIES_CATALOG.find(c => c.key === selectedCategory)?.label}
                            </Text>
                            <Text className="text-xs text-gray-500 mt-0.5">
                                {LOOKUP_CATEGORIES_CATALOG.find(c => c.key === selectedCategory)?.description} • {activeLookupsCount} active
                            </Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                            <Pressable
                                onPress={handleResetCategoryDefaults}
                                className="px-3 py-2 rounded-xl bg-gray-100 border border-gray-200"
                            >
                                <Text className="text-gray-700 text-xs font-bold">Reset</Text>
                            </Pressable>
                            <Pressable
                                testID="add-lookup-item-btn"
                                onPress={handleOpenAddLookup}
                                className="px-3.5 py-2 rounded-xl bg-blue-900 flex-row items-center active:bg-blue-800"
                            >
                                <MaterialIcons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                                <Text className="text-white text-xs font-bold">Add Option</Text>
                            </Pressable>
                        </View>
                    </View>

                    {/* Search Bar */}
                    <View className="p-4">
                        <View className="bg-white rounded-2xl px-3.5 py-2 border border-gray-200 flex-row items-center">
                            <MaterialIcons name="search" size={20} color="#9CA3AF" />
                            <TextInput
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="Search by name, code, or description..."
                                placeholderTextColor="#9CA3AF"
                                className="flex-1 ml-2 text-sm text-gray-900"
                            />
                            {searchQuery.length > 0 && (
                                <Pressable onPress={() => setSearchQuery('')}>
                                    <MaterialIcons name="close" size={18} color="#9CA3AF" />
                                </Pressable>
                            )}
                        </View>
                    </View>

                    {/* Items List */}
                    <ScrollView className="flex-1 px-4 pb-8">
                        {loading ? (
                            <View className="py-20 items-center">
                                <ActivityIndicator color="#1E3A8A" />
                                <Text className="text-gray-500 font-bold mt-2 text-xs">Loading selection catalog...</Text>
                            </View>
                        ) : filteredLookupItems.length === 0 ? (
                            <View className="p-8 items-center bg-white rounded-3xl border border-gray-100">
                                <MaterialIcons name="filter-list" size={40} color="#CBD5E1" />
                                <Text className="text-gray-700 font-bold mt-2">No matching options</Text>
                                <Text className="text-gray-400 text-xs mt-1">Tap "Add Option" above to create one</Text>
                            </View>
                        ) : (
                            <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                                {filteredLookupItems.map((item, index) => (
                                    <View
                                        key={item.id}
                                        className={`p-4 flex-row items-center justify-between ${
                                            index < filteredLookupItems.length - 1 ? 'border-b border-gray-50' : ''
                                        }`}
                                    >
                                        <View className="flex-1 pr-3">
                                            <View className="flex-row items-center gap-2">
                                                <Text className="text-sm font-extrabold text-gray-900">{item.name}</Text>
                                                {item.code && (
                                                    <View className="bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                                                        <Text className="text-[10px] font-mono text-gray-700">{item.code}</Text>
                                                    </View>
                                                )}
                                                {item.isSystemDefault && (
                                                    <View className="bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100">
                                                        <Text className="text-[9px] font-bold text-blue-900 uppercase">Default</Text>
                                                    </View>
                                                )}
                                            </View>
                                            {item.description && (
                                                <Text className="text-xs text-gray-500 mt-1">{item.description}</Text>
                                            )}
                                        </View>

                                        <View className="flex-row items-center gap-3">
                                            <Switch
                                                value={item.isActive}
                                                onValueChange={() => handleToggleLookupActive(item)}
                                                trackColor={{ true: '#1E3A8A', false: '#D1D5DB' }}
                                            />
                                            <Pressable
                                                onPress={() => handleOpenEditLookup(item)}
                                                className="p-2 rounded-lg bg-gray-50 active:bg-gray-100"
                                            >
                                                <MaterialIcons name="edit" size={18} color="#4B5563" />
                                            </Pressable>
                                            {!item.isSystemDefault && (
                                                <Pressable
                                                    onPress={() => handleDeleteLookup(item)}
                                                    className="p-2 rounded-lg bg-red-50 active:bg-red-100"
                                                >
                                                    <MaterialIcons name="delete-outline" size={18} color="#B91C1C" />
                                                </Pressable>
                                            )}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </ScrollView>
                </View>
            )}

            {/* TAB: BRANCHES & WAREHOUSES */}
            {currentTab === 'locations' && (
                <View className="flex-1">
                    <View className="bg-white border-b border-gray-100 p-3 flex-row gap-2">
                        <Pressable
                            onPress={() => setLocationSubTab('branches')}
                            className={`flex-1 py-2.5 rounded-xl items-center border ${
                                locationSubTab === 'branches' ? 'bg-blue-900 border-blue-900' : 'bg-gray-50 border-gray-200'
                            }`}
                        >
                            <Text className={`text-xs font-bold ${locationSubTab === 'branches' ? 'text-white' : 'text-gray-700'}`}>
                                Operational Branches ({branches.length})
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setLocationSubTab('warehouses')}
                            className={`flex-1 py-2.5 rounded-xl items-center border ${
                                locationSubTab === 'warehouses' ? 'bg-blue-900 border-blue-900' : 'bg-gray-50 border-gray-200'
                            }`}
                        >
                            <Text className={`text-xs font-bold ${locationSubTab === 'warehouses' ? 'text-white' : 'text-gray-700'}`}>
                                Warehouses & Storage ({warehouses.length})
                            </Text>
                        </Pressable>
                    </View>

                    {locationSubTab === 'branches' ? (
                        <View className="flex-1 p-4">
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-sm font-bold text-gray-900">Registered Branches</Text>
                                <Pressable
                                    onPress={() => {
                                        setEditingBranch(null);
                                        setBranchName('');
                                        setBranchCode('');
                                        setBranchIsHq(false);
                                        setBranchModalVisible(true);
                                    }}
                                    className="bg-blue-900 px-3.5 py-2 rounded-xl flex-row items-center active:bg-blue-800"
                                >
                                    <MaterialIcons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                                    <Text className="text-white text-xs font-bold">New Branch</Text>
                                </Pressable>
                            </View>

                            <ScrollView className="flex-1">
                                <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                                    {branches.map((b, idx) => (
                                        <View
                                            key={b.id}
                                            className={`p-4 flex-row items-center justify-between ${
                                                idx < branches.length - 1 ? 'border-b border-gray-50' : ''
                                            }`}
                                        >
                                            <View className="flex-1 pr-3">
                                                <View className="flex-row items-center gap-2">
                                                    <Text className="text-sm font-extrabold text-gray-900">{b.name}</Text>
                                                    {b.code && (
                                                        <View className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                                            <Text className="text-[10px] font-mono text-gray-700">{b.code}</Text>
                                                        </View>
                                                    )}
                                                    {b.isHq && (
                                                        <View className="bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                                                            <Text className="text-[10px] font-bold text-emerald-800">HQ</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                            <View className="flex-row items-center gap-3">
                                                <Switch
                                                    value={b.isActive ?? true}
                                                    onValueChange={() => handleToggleBranch(b)}
                                                    trackColor={{ true: '#1E3A8A', false: '#D1D5DB' }}
                                                />
                                                <Pressable
                                                    onPress={() => {
                                                        setEditingBranch(b);
                                                        setBranchName(b.name);
                                                        setBranchCode(b.code || '');
                                                        setBranchIsHq(b.isHq ?? false);
                                                        setBranchModalVisible(true);
                                                    }}
                                                    className="p-2 rounded-lg bg-gray-50"
                                                >
                                                    <MaterialIcons name="edit" size={18} color="#4B5563" />
                                                </Pressable>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>
                    ) : (
                        <View className="flex-1 p-4">
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-sm font-bold text-gray-900">Storage Locations</Text>
                                <Pressable
                                    onPress={() => {
                                        setEditingWarehouse(null);
                                        setWarehouseName('');
                                        setWarehouseType('store');
                                        setWarehouseModalVisible(true);
                                    }}
                                    className="bg-blue-900 px-3.5 py-2 rounded-xl flex-row items-center active:bg-blue-800"
                                >
                                    <MaterialIcons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                                    <Text className="text-white text-xs font-bold">New Warehouse</Text>
                                </Pressable>
                            </View>

                            <ScrollView className="flex-1">
                                <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                                    {warehouses.map((w, idx) => {
                                        const branchMatch = branches.find(b => b.id === w.branchId);
                                        return (
                                            <View
                                                key={w.id}
                                                className={`p-4 flex-row items-center justify-between ${
                                                    idx < warehouses.length - 1 ? 'border-b border-gray-50' : ''
                                                }`}
                                            >
                                                <View className="flex-1 pr-3">
                                                    <View className="flex-row items-center gap-2">
                                                        <Text className="text-sm font-extrabold text-gray-900">{w.name}</Text>
                                                        <View className="bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                            <Text className="text-[10px] font-bold text-blue-900 uppercase">
                                                                {w.type || 'store'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <Text className="text-xs text-gray-500 mt-0.5">
                                                        Branch: {branchMatch ? branchMatch.name : w.branchId}
                                                    </Text>
                                                </View>
                                                <View className="flex-row items-center gap-3">
                                                    <Switch
                                                        value={w.isActive ?? true}
                                                        onValueChange={() => handleToggleWarehouse(w)}
                                                        trackColor={{ true: '#1E3A8A', false: '#D1D5DB' }}
                                                    />
                                                    <Pressable
                                                        onPress={() => {
                                                            setEditingWarehouse(w);
                                                            setWarehouseBranchId(w.branchId);
                                                            setWarehouseName(w.name);
                                                            setWarehouseType(w.type || 'store');
                                                            setWarehouseModalVisible(true);
                                                        }}
                                                        className="p-2 rounded-lg bg-gray-50"
                                                    >
                                                        <MaterialIcons name="edit" size={18} color="#4B5563" />
                                                    </Pressable>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        </View>
                    )}
                </View>
            )}

            {/* TAB: PRODUCT CATEGORIES */}
            {currentTab === 'categories' && (
                <View className="flex-1 p-4">
                    <View className="flex-row justify-between items-center mb-4">
                        <View>
                            <Text className="text-sm font-bold text-gray-900">Product & POS Categories</Text>
                            <Text className="text-xs text-gray-500">Classifies inventory products, touch POS, and marketplace</Text>
                        </View>
                        <Pressable
                            onPress={() => {
                                setEditingCategory(null);
                                setCategoryName('');
                                setCategorySlug('');
                                setCategoryIcon('category');
                                setCategoryModalVisible(true);
                            }}
                            className="bg-blue-900 px-3.5 py-2 rounded-xl flex-row items-center active:bg-blue-800"
                        >
                            <MaterialIcons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text className="text-white text-xs font-bold">New Category</Text>
                        </Pressable>
                    </View>

                    <ScrollView className="flex-1">
                        <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                            {prodCategories.length === 0 ? (
                                <View className="p-8 items-center">
                                    <MaterialIcons name="category" size={40} color="#CBD5E1" />
                                    <Text className="text-gray-700 font-bold mt-2">No product categories yet</Text>
                                </View>
                            ) : (
                                prodCategories.map((c, idx) => (
                                    <View
                                        key={c.id}
                                        className={`p-4 flex-row items-center justify-between ${
                                            idx < prodCategories.length - 1 ? 'border-b border-gray-50' : ''
                                        }`}
                                    >
                                        <View className="flex-row items-center flex-1 pr-3">
                                            <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center mr-3 border border-blue-100">
                                                <MaterialIcons name={(c.icon as any) || 'category'} size={20} color="#1E3A8A" />
                                            </View>
                                            <View>
                                                <Text className="text-sm font-extrabold text-gray-900">{c.name}</Text>
                                                <Text className="text-xs text-gray-500 font-mono">slug: {c.slug}</Text>
                                            </View>
                                        </View>
                                        <View className="flex-row items-center gap-3">
                                            <Switch
                                                value={c.isActive}
                                                onValueChange={() => handleToggleCategory(c)}
                                                trackColor={{ true: '#1E3A8A', false: '#D1D5DB' }}
                                            />
                                            <Pressable
                                                onPress={() => {
                                                    setEditingCategory(c);
                                                    setCategoryName(c.name);
                                                    setCategorySlug(c.slug);
                                                    setCategoryIcon(c.icon || 'category');
                                                    setCategoryModalVisible(true);
                                                }}
                                                className="p-2 rounded-lg bg-gray-50"
                                            >
                                                <MaterialIcons name="edit" size={18} color="#4B5563" />
                                            </Pressable>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* TAB: SUPPLIERS */}
            {currentTab === 'suppliers' && (
                <View className="flex-1 p-4">
                    <View className="flex-row justify-between items-center mb-4">
                        <View>
                            <Text className="text-sm font-bold text-gray-900">Suppliers & Vendors Masterlist</Text>
                            <Text className="text-xs text-gray-500">Used in Accounts Payable, stock procurement, and intake</Text>
                        </View>
                        <Pressable
                            onPress={() => {
                                setEditingSupplier(null);
                                setSupplierName('');
                                setSupplierContact('');
                                setSupplierPhone('');
                                setSupplierEmail('');
                                setSupplierAddress('');
                                setSupplierTin('');
                                setSupplierTerms('30');
                                setSupplierModalVisible(true);
                            }}
                            className="bg-blue-900 px-3.5 py-2 rounded-xl flex-row items-center active:bg-blue-800"
                        >
                            <MaterialIcons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text className="text-white text-xs font-bold">New Supplier</Text>
                        </Pressable>
                    </View>

                    <ScrollView className="flex-1">
                        <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                            {suppliers.length === 0 ? (
                                <View className="p-8 items-center">
                                    <MaterialIcons name="business" size={40} color="#CBD5E1" />
                                    <Text className="text-gray-700 font-bold mt-2">No suppliers registered</Text>
                                </View>
                            ) : (
                                suppliers.map((s, idx) => (
                                    <View
                                        key={s.id}
                                        className={`p-4 flex-row items-center justify-between ${
                                            idx < suppliers.length - 1 ? 'border-b border-gray-50' : ''
                                        }`}
                                    >
                                        <View className="flex-1 pr-3">
                                            <Text className="text-sm font-extrabold text-gray-900">{s.name}</Text>
                                            <Text className="text-xs text-gray-500 mt-0.5">
                                                Contact: {s.contactPerson || 'N/A'} • Phone: {s.phone || 'N/A'}
                                            </Text>
                                            <Text className="text-xs text-gray-400 mt-0.5">
                                                Terms: {s.paymentTermsDays || 30} days • TIN: {s.tin || 'N/A'}
                                            </Text>
                                        </View>
                                        <View className="flex-row items-center gap-3">
                                            <Switch
                                                value={s.isActive ?? true}
                                                onValueChange={() => handleToggleSupplier(s)}
                                                trackColor={{ true: '#1E3A8A', false: '#D1D5DB' }}
                                            />
                                            <Pressable
                                                onPress={() => {
                                                    setEditingSupplier(s);
                                                    setSupplierName(s.name);
                                                    setSupplierContact(s.contactPerson || '');
                                                    setSupplierPhone(s.phone || '');
                                                    setSupplierEmail(s.email || '');
                                                    setSupplierAddress(s.address || '');
                                                    setSupplierTin(s.tin || '');
                                                    setSupplierTerms(s.paymentTermsDays ? s.paymentTermsDays.toString() : '30');
                                                    setSupplierModalVisible(true);
                                                }}
                                                className="p-2 rounded-lg bg-gray-50"
                                            >
                                                <MaterialIcons name="edit" size={18} color="#4B5563" />
                                            </Pressable>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* TAB: STATUTORY RATES */}
            {currentTab === 'statutory' && (
                <View className="flex-1 p-4">
                    <View className="flex-row justify-between items-center mb-3">
                        <View>
                            <Text className="text-sm font-bold text-gray-900">Statutory Contribution Tables</Text>
                            <Text className="text-xs text-gray-500">Government contribution brackets (SSS, PhilHealth, Pag-IBIG)</Text>
                        </View>
                        <Pressable
                            onPress={() => {
                                setRateType('sss');
                                setBracketMin('');
                                setBracketMax('');
                                setEmployeeShare('');
                                setEmployerShare('');
                                setRateDescription('');
                                setStatutoryModalVisible(true);
                            }}
                            className="bg-blue-900 px-3.5 py-2 rounded-xl flex-row items-center active:bg-blue-800"
                        >
                            <MaterialIcons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text className="text-white text-xs font-bold">New Bracket</Text>
                        </Pressable>
                    </View>

                    {/* Statutory Filter Tabs */}
                    <View className="flex-row gap-2 mb-4">
                        {['all', 'sss', 'philhealth', 'pagibig'].map(type => (
                            <Pressable
                                key={type}
                                onPress={() => setStatutoryFilter(type)}
                                className={`px-3 py-1.5 rounded-xl border ${
                                    statutoryFilter === type
                                        ? 'bg-blue-900 border-blue-900'
                                        : 'bg-white border-gray-200'
                                }`}
                            >
                                <Text
                                    className={`text-xs font-bold uppercase ${
                                        statutoryFilter === type ? 'text-white' : 'text-gray-700'
                                    }`}
                                >
                                    {type}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <ScrollView className="flex-1">
                        <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                            {statutoryRates.length === 0 ? (
                                <View className="p-8 items-center">
                                    <MaterialIcons name="receipt-long" size={40} color="#CBD5E1" />
                                    <Text className="text-gray-700 font-bold mt-2">No statutory rate brackets defined</Text>
                                </View>
                            ) : (
                                statutoryRates.map((r, idx) => (
                                    <View
                                        key={r.id}
                                        className={`p-4 flex-row items-center justify-between ${
                                            idx < statutoryRates.length - 1 ? 'border-b border-gray-50' : ''
                                        }`}
                                    >
                                        <View className="flex-1 pr-3">
                                            <View className="flex-row items-center gap-2">
                                                <View className="bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                    <Text className="text-[10px] font-bold text-blue-900 uppercase">
                                                        {r.rateType}
                                                    </Text>
                                                </View>
                                                <Text className="text-sm font-extrabold text-gray-900">
                                                    {formatPHP(r.bracketMin)} {r.bracketMax ? `- ${formatPHP(r.bracketMax)}` : 'and above'}
                                                </Text>
                                            </View>
                                            <Text className="text-xs text-gray-500 mt-1">
                                                EE Share: <Text className="font-bold text-gray-800">{formatPHP(r.employeeShare)}</Text> • ER Share: <Text className="font-bold text-gray-800">{formatPHP(r.employerShare)}</Text>
                                            </Text>
                                            {r.description && (
                                                <Text className="text-xs text-gray-400 mt-0.5">{r.description}</Text>
                                            )}
                                        </View>
                                        <Pressable
                                            onPress={() => handleDeleteStatutoryRate(r.id)}
                                            className="p-2 rounded-lg bg-red-50"
                                        >
                                            <MaterialIcons name="delete-outline" size={18} color="#B91C1C" />
                                        </Pressable>
                                    </View>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* TAB: QUICK MASTER DIRECTORIES */}
            {currentTab === 'directories' && (
                <ScrollView className="flex-1 p-4">
                    <Text className="text-sm font-bold text-gray-900 mb-2">Connected Master Directories</Text>
                    <Text className="text-xs text-gray-500 mb-4">
                        Access and manage operational reference datasets across all application business units
                    </Text>

                    <View className="gap-y-3 mb-8">
                        <DirectoryCard
                            title="Expense Categories"
                            subtitle="Chart of operational and farm expense classifications"
                            icon="category"
                            onPress={() => router.push('/(admin)/settings/expense-categories')}
                        />
                        <DirectoryCard
                            title="Chart of Accounts"
                            subtitle="General Ledger account tree, assets, liabilities, and revenues"
                            icon="format-list-numbered"
                            onPress={() => router.push('/(admin)/accounting/chart-of-accounts')}
                        />
                        <DirectoryCard
                            title="Company Bank Accounts"
                            subtitle="Disbursement, deposit, and reconciliation accounts"
                            icon="account-balance"
                            onPress={() => router.push('/(admin)/bank-accounts')}
                        />
                        <DirectoryCard
                            title="Loan Products & Plans"
                            subtitle="Configured loan terms, interest calculation formulas, and fees"
                            icon="receipt-long"
                            onPress={() => router.push('/(admin)/settings/loan-products')}
                        />
                        <DirectoryCard
                            title="Collection Groups & Centers"
                            subtitle="Field routing, center meeting schedules, and collector assignments"
                            icon="group-work"
                            onPress={() => router.push('/(admin)/settings/collection-groups')}
                        />
                        <DirectoryCard
                            title="Geographic Areas & Zones"
                            subtitle="Barangay, municipal clusters, and area supervisor zones"
                            icon="map"
                            onPress={() => router.push('/(admin)/areas')}
                        />
                        <DirectoryCard
                            title="Employees Directory"
                            subtitle="Staff master profiles, positions, and base salary records"
                            icon="assignment-ind"
                            onPress={() => router.push('/(admin)/settings/employees')}
                        />
                    </View>
                </ScrollView>
            )}

            {/* ================================================================= */}
            {/* MODALS */}
            {/* ================================================================= */}

            {/* Add / Edit Lookup Item Modal */}
            <Modal visible={lookupModalVisible} transparent animationType="fade" onRequestClose={() => setLookupModalVisible(false)}>
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-black text-gray-900">
                                {editingLookupItem ? 'Edit Option' : 'Add New Option'}
                            </Text>
                            <Pressable onPress={() => setLookupModalVisible(false)}>
                                <MaterialIcons name="close" size={20} color="#6B7280" />
                            </Pressable>
                        </View>

                        <Text className="text-xs font-bold text-gray-700 mb-1">Option Name *</Text>
                        <TextInput
                            testID="lookup-name-input"
                            value={lookupName}
                            onChangeText={setLookupName}
                            placeholder="e.g. Metric Ton (MT)"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                        />

                        <Text className="text-xs font-bold text-gray-700 mb-1">Code / Short Form</Text>
                        <TextInput
                            testID="lookup-code-input"
                            value={lookupCode}
                            onChangeText={setLookupCode}
                            placeholder="e.g. MT"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3 font-mono"
                        />

                        <Text className="text-xs font-bold text-gray-700 mb-1">Description (Optional)</Text>
                        <TextInput
                            value={lookupDesc}
                            onChangeText={setLookupDesc}
                            placeholder="Additional context or notes..."
                            placeholderTextColor="#9CA3AF"
                            multiline
                            numberOfLines={2}
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-5"
                        />

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={() => setLookupModalVisible(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                testID="save-lookup-button"
                                onPress={handleSaveLookup}
                                disabled={lookupSaving}
                                className="flex-1 py-3 bg-blue-900 rounded-xl items-center active:bg-blue-800"
                            >
                                {lookupSaving ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text className="font-bold text-white text-sm">Save Option</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add / Edit Branch Modal */}
            <Modal visible={branchModalVisible} transparent animationType="fade" onRequestClose={() => setBranchModalVisible(false)}>
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-black text-gray-900">
                                {editingBranch ? 'Edit Branch' : 'Add New Branch'}
                            </Text>
                            <Pressable onPress={() => setBranchModalVisible(false)}>
                                <MaterialIcons name="close" size={20} color="#6B7280" />
                            </Pressable>
                        </View>

                        <Text className="text-xs font-bold text-gray-700 mb-1">Branch Name *</Text>
                        <TextInput
                            value={branchName}
                            onChangeText={setBranchName}
                            placeholder="e.g. Crispy King - Tubigon"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                        />

                        <Text className="text-xs font-bold text-gray-700 mb-1">Branch Code</Text>
                        <TextInput
                            value={branchCode}
                            onChangeText={setBranchCode}
                            placeholder="e.g. CK-TUB-01"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3 font-mono"
                        />

                        <View className="flex-row justify-between items-center py-2 mb-4 border-t border-b border-gray-100">
                            <Text className="text-sm font-bold text-gray-800">Headquarters / Main Office?</Text>
                            <Switch
                                value={branchIsHq}
                                onValueChange={setBranchIsHq}
                                trackColor={{ true: '#1E3A8A', false: '#D1D5DB' }}
                            />
                        </View>

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={() => setBranchModalVisible(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSaveBranch}
                                className="flex-1 py-3 bg-blue-900 rounded-xl items-center active:bg-blue-800"
                            >
                                <Text className="font-bold text-white text-sm">Save Branch</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add / Edit Warehouse Modal */}
            <Modal visible={warehouseModalVisible} transparent animationType="fade" onRequestClose={() => setWarehouseModalVisible(false)}>
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-black text-gray-900">
                                {editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse Location'}
                            </Text>
                            <Pressable onPress={() => setWarehouseModalVisible(false)}>
                                <MaterialIcons name="close" size={20} color="#6B7280" />
                            </Pressable>
                        </View>

                        <Text className="text-xs font-bold text-gray-700 mb-1">Assign to Branch *</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mb-3">
                            {branches.map(b => (
                                <Pressable
                                    key={b.id}
                                    onPress={() => setWarehouseBranchId(b.id)}
                                    className={`px-3 py-1.5 rounded-lg border ${
                                        warehouseBranchId === b.id
                                            ? 'bg-blue-900 border-blue-900'
                                            : 'bg-gray-50 border-gray-200'
                                    }`}
                                >
                                    <Text
                                        className={`text-xs font-bold ${
                                            warehouseBranchId === b.id ? 'text-white' : 'text-gray-700'
                                        }`}
                                    >
                                        {b.name}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>

                        <Text className="text-xs font-bold text-gray-700 mb-1">Warehouse / Area Name *</Text>
                        <TextInput
                            value={warehouseName}
                            onChangeText={setWarehouseName}
                            placeholder="e.g. Main Kitchen Freezer"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                        />

                        <Text className="text-xs font-bold text-gray-700 mb-1">Location Type</Text>
                        <View className="flex-row gap-2 mb-5">
                            {['store', 'transit', 'commissary', 'quarantine'].map(t => (
                                <Pressable
                                    key={t}
                                    onPress={() => setWarehouseType(t)}
                                    className={`px-2.5 py-1.5 rounded-lg border ${
                                        warehouseType === t
                                            ? 'bg-blue-900 border-blue-900'
                                            : 'bg-gray-50 border-gray-200'
                                    }`}
                                >
                                    <Text
                                        className={`text-xs font-bold uppercase ${
                                            warehouseType === t ? 'text-white' : 'text-gray-700'
                                        }`}
                                    >
                                        {t}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={() => setWarehouseModalVisible(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSaveWarehouse}
                                className="flex-1 py-3 bg-blue-900 rounded-xl items-center active:bg-blue-800"
                            >
                                <Text className="font-bold text-white text-sm">Save Location</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add / Edit Category Modal */}
            <Modal visible={categoryModalVisible} transparent animationType="fade" onRequestClose={() => setCategoryModalVisible(false)}>
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-black text-gray-900">
                                {editingCategory ? 'Edit Product Category' : 'New Product Category'}
                            </Text>
                            <Pressable onPress={() => setCategoryModalVisible(false)}>
                                <MaterialIcons name="close" size={20} color="#6B7280" />
                            </Pressable>
                        </View>

                        <Text className="text-xs font-bold text-gray-700 mb-1">Category Name *</Text>
                        <TextInput
                            value={categoryName}
                            onChangeText={setCategoryName}
                            placeholder="e.g. Side Dishes & Drinks"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                        />

                        <Text className="text-xs font-bold text-gray-700 mb-1">Slug (URL / Key)</Text>
                        <TextInput
                            value={categorySlug}
                            onChangeText={setCategorySlug}
                            placeholder="e.g. side-dishes-drinks"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3 font-mono"
                        />

                        <Text className="text-xs font-bold text-gray-700 mb-1">Icon Name (Material Icons)</Text>
                        <TextInput
                            value={categoryIcon}
                            onChangeText={setCategoryIcon}
                            placeholder="e.g. fastfood, local-drink, restaurant"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-5 font-mono"
                        />

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={() => setCategoryModalVisible(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSaveCategory}
                                className="flex-1 py-3 bg-blue-900 rounded-xl items-center active:bg-blue-800"
                            >
                                <Text className="font-bold text-white text-sm">Save Category</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add / Edit Supplier Modal */}
            <Modal visible={supplierModalVisible} transparent animationType="fade" onRequestClose={() => setSupplierModalVisible(false)}>
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[85vh]">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-black text-gray-900">
                                {editingSupplier ? 'Edit Supplier' : 'Register Supplier'}
                            </Text>
                            <Pressable onPress={() => setSupplierModalVisible(false)}>
                                <MaterialIcons name="close" size={20} color="#6B7280" />
                            </Pressable>
                        </View>

                        <ScrollView className="max-h-[60vh]">
                            <Text className="text-xs font-bold text-gray-700 mb-1">Supplier Company Name *</Text>
                            <TextInput
                                value={supplierName}
                                onChangeText={setSupplierName}
                                placeholder="e.g. Magnolia Chicken Wholesale"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Contact Person</Text>
                            <TextInput
                                value={supplierContact}
                                onChangeText={setSupplierContact}
                                placeholder="Account representative name"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Contact Phone</Text>
                            <TextInput
                                value={supplierPhone}
                                onChangeText={setSupplierPhone}
                                placeholder="0917-XXX-XXXX"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Email Address</Text>
                            <TextInput
                                value={supplierEmail}
                                onChangeText={setSupplierEmail}
                                placeholder="orders@supplier.ph"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Tax Identification Number (TIN)</Text>
                            <TextInput
                                value={supplierTin}
                                onChangeText={setSupplierTin}
                                placeholder="000-000-000-000"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Payment Terms (Days)</Text>
                            <TextInput
                                value={supplierTerms}
                                onChangeText={setSupplierTerms}
                                placeholder="e.g. 30"
                                keyboardType="numeric"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-5"
                            />
                        </ScrollView>

                        <View className="flex-row gap-3 mt-3">
                            <Pressable
                                onPress={() => setSupplierModalVisible(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSaveSupplier}
                                className="flex-1 py-3 bg-blue-900 rounded-xl items-center active:bg-blue-800"
                            >
                                <Text className="font-bold text-white text-sm">Save Supplier</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add Statutory Rate Modal */}
            <Modal visible={statutoryModalVisible} transparent animationType="fade" onRequestClose={() => setStatutoryModalVisible(false)}>
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-black text-gray-900">Add Statutory Rate Bracket</Text>
                            <Pressable onPress={() => setStatutoryModalVisible(false)}>
                                <MaterialIcons name="close" size={20} color="#6B7280" />
                            </Pressable>
                        </View>

                        <Text className="text-xs font-bold text-gray-700 mb-1">Contribution Type *</Text>
                        <View className="flex-row gap-2 mb-3">
                            {(['sss', 'philhealth', 'pagibig'] as const).map(t => (
                                <Pressable
                                    key={t}
                                    onPress={() => setRateType(t)}
                                    className={`flex-1 py-2 rounded-lg border items-center ${
                                        rateType === t ? 'bg-blue-900 border-blue-900' : 'bg-gray-50 border-gray-200'
                                    }`}
                                >
                                    <Text className={`text-xs font-bold uppercase ${rateType === t ? 'text-white' : 'text-gray-700'}`}>
                                        {t}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>

                        <View className="flex-row gap-3 mb-3">
                            <View className="flex-1">
                                <Text className="text-xs font-bold text-gray-700 mb-1">Min Salary (₱) *</Text>
                                <TextInput
                                    value={bracketMin}
                                    onChangeText={setBracketMin}
                                    placeholder="0.00"
                                    keyboardType="numeric"
                                    placeholderTextColor="#9CA3AF"
                                    className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900"
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-xs font-bold text-gray-700 mb-1">Max Salary (₱)</Text>
                                <TextInput
                                    value={bracketMax}
                                    onChangeText={setBracketMax}
                                    placeholder="Leave empty if none"
                                    keyboardType="numeric"
                                    placeholderTextColor="#9CA3AF"
                                    className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900"
                                />
                            </View>
                        </View>

                        <View className="flex-row gap-3 mb-3">
                            <View className="flex-1">
                                <Text className="text-xs font-bold text-gray-700 mb-1">EE Share (₱) *</Text>
                                <TextInput
                                    value={employeeShare}
                                    onChangeText={setEmployeeShare}
                                    placeholder="0.00"
                                    keyboardType="numeric"
                                    placeholderTextColor="#9CA3AF"
                                    className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900"
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-xs font-bold text-gray-700 mb-1">ER Share (₱) *</Text>
                                <TextInput
                                    value={employerShare}
                                    onChangeText={setEmployerShare}
                                    placeholder="0.00"
                                    keyboardType="numeric"
                                    placeholderTextColor="#9CA3AF"
                                    className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900"
                                />
                            </View>
                        </View>

                        <Text className="text-xs font-bold text-gray-700 mb-1">Description</Text>
                        <TextInput
                            value={rateDescription}
                            onChangeText={setRateDescription}
                            placeholder="e.g. 2026 Updated Bracket"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-5"
                        />

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={() => setStatutoryModalVisible(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSaveStatutoryRate}
                                className="flex-1 py-3 bg-blue-900 rounded-xl items-center active:bg-blue-800"
                            >
                                <Text className="font-bold text-white text-sm">Save Bracket</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function TabButton({
    label,
    icon,
    active,
    onPress,
}: {
    label: string;
    icon: any;
    active: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            className={`flex-row items-center px-4 py-2 mr-2 rounded-xl border ${
                active ? 'bg-blue-900 border-blue-900' : 'bg-gray-50 border-gray-200'
            }`}
        >
            <MaterialIcons
                name={icon}
                size={16}
                color={active ? '#FFFFFF' : '#4B5563'}
                style={{ marginRight: 6 }}
            />
            <Text className={`text-xs font-extrabold ${active ? 'text-white' : 'text-gray-700'}`}>
                {label}
            </Text>
        </Pressable>
    );
}

function DirectoryCard({
    title,
    subtitle,
    icon,
    onPress,
}: {
    title: string;
    subtitle: string;
    icon: any;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm flex-row items-center justify-between active:bg-gray-50"
        >
            <View className="flex-row items-center flex-1 pr-3">
                <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center mr-3 border border-blue-100">
                    <MaterialIcons name={icon} size={20} color="#1E3A8A" />
                </View>
                <View className="flex-1">
                    <Text className="text-sm font-extrabold text-gray-900">{title}</Text>
                    <Text className="text-xs text-gray-500 mt-0.5">{subtitle}</Text>
                </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
        </Pressable>
    );
}
