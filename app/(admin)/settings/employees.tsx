import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, Pressable, TextInput,
    ActivityIndicator, Alert, SafeAreaView, Modal
} from 'react-native';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import Employee from '../../../src/database/models/Employee';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PayrollService } from '../../../src/services/PayrollService';
import { safeBack } from '../../../src/utils/navigation';

export default function EmployeesScreen() {
    const router = useRouter();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

    // Form states
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [baseSalary, setBaseSalary] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const list = await PayrollService.getEmployees();
            setEmployees(list);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const openAddModal = () => {
        setEditingEmployee(null);
        setName('');
        setRole('');
        setBaseSalary('');
        setShowModal(true);
    };

    const openEditModal = (employee: Employee) => {
        setEditingEmployee(employee);
        setName(employee.name);
        setRole(employee.role);
        setBaseSalary(employee.baseSalary.toString());
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!name.trim() || !role.trim() || !baseSalary.trim()) {
            Alert.alert("Validation Error", "All fields are required.");
            return;
        }

        const salaryValue = parseFloat(baseSalary);
        if (isNaN(salaryValue) || salaryValue <= 0) {
            Alert.alert("Validation Error", "Please enter a valid base salary.");
            return;
        }

        setSaving(true);
        try {
            if (editingEmployee) {
                await PayrollService.updateEmployee(editingEmployee, {
                    name: name.trim(),
                    role: role.trim(),
                    baseSalary: salaryValue,
                });
            } else {
                await PayrollService.createEmployee({
                    name: name.trim(),
                    role: role.trim(),
                    baseSalary: salaryValue,
                });
            }
            setShowModal(false);
            fetchEmployees();
        } catch (error) {
            Alert.alert("Error", "Failed to save employee");
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (employee: Employee) => {
        try {
            await PayrollService.updateEmployee(employee, {
                isActive: !employee.isActive,
            });
            fetchEmployees();
        } catch (error) {
            Alert.alert("Error", "Failed to update employee status");
        }
    };

    const handleDelete = (employee: Employee) => {
        Alert.alert(
            "Delete Employee",
            `Are you sure you want to remove "${employee.name}"? This soft-deletes the record.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await PayrollService.softDelete(employee);
                            fetchEmployees();
                        } catch (error) {
                            Alert.alert("Error", "Failed to delete employee");
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="flex-row items-center p-4 bg-white border-b border-gray-100">
                <Pressable onPress={() => safeBack(router, '/(admin)')} className="p-2 -ml-2">
                    <MaterialIcons name="arrow-back" size={24} color="#1E3A8A" />
                </Pressable>
                <Text className="text-xl font-black text-gray-900 ml-2">Employee Management</Text>
            </View>

            <ScrollView className="flex-1 p-4">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Active Staff</Text>
                    <Pressable
                        onPress={openAddModal}
                        className="bg-blue-900 px-4 py-2 rounded-2xl flex-row items-center active:bg-green-900"
                    >
                        <MaterialIcons name="add" size={16} color="white" className="mr-1" />
                        <Text className="text-white font-bold text-sm">Add Employee</Text>
                    </Pressable>
                </View>

                {loading ? (
                    <View className="py-20 items-center">
                        <ActivityIndicator color="#1E3A8A" />
                        <Text className="text-gray-700 font-bold mt-4">Loading employees...</Text>
                    </View>
                ) : (
                    <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-8">
                        {employees.length === 0 ? (
                            <View className="p-10 items-center">
                                <MaterialIcons name="assignment-ind" size={48} color="#E5E7EB" />
                                <Text className="text-gray-700 font-bold mt-2">No employees registered yet</Text>
                            </View>
                        ) : (
                            employees.map((item, index) => (
                                <View key={item.id} className={`flex-row items-center p-4 ${index < employees.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                    <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-4 ${item.isActive ? 'bg-green-50' : 'bg-gray-100'}`}>
                                        <MaterialIcons name="person" size={20} color={item.isActive ? '#1E3A8A' : '#9CA3AF'} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`font-bold text-base ${item.isActive ? 'text-gray-900' : 'text-gray-700'}`}>{item.name}</Text>
                                        <Text className="text-xs text-gray-700 font-medium">{item.role} · <Text className="font-bold text-gray-900">₱{item.baseSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text></Text>
                                    </View>
                                    <Pressable 
                                        onPress={() => toggleStatus(item)}
                                        className="p-2"
                                    >
                                        <MaterialIcons 
                                            name={item.isActive ? "toggle-on" : "toggle-off"} 
                                            size={28} 
                                            color={item.isActive ? "#1E3A8A" : "#9CA3AF"} 
                                        />
                                    </Pressable>
                                    <Pressable 
                                        onPress={() => openEditModal(item)}
                                        className="p-2"
                                    >
                                        <MaterialIcons name="edit" size={20} color="#1E3A8A" />
                                    </Pressable>
                                    <Pressable 
                                        onPress={() => handleDelete(item)}
                                        className="p-2"
                                    >
                                        <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                                    </Pressable>
                                </View>
                            ))
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Add/Edit Modal */}
            <Modal
                visible={showModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowModal(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl p-6 min-h-[400px]">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-lg font-black text-gray-900">{editingEmployee ? 'Edit Employee' : 'Add Employee'}</Text>
                            <Pressable onPress={() => setShowModal(false)} className="p-1">
                                <MaterialIcons name="close" size={24} color="#9CA3AF" />
                            </Pressable>
                        </View>

                        <Text className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-1">Employee Name</Text>
                        <TextInput
                            className="bg-gray-50 px-4 py-3 rounded-2xl border border-gray-100 text-gray-900 font-bold mb-4"
                            placeholder="Full Name"
                            value={name}
                            onChangeText={setName}
                            editable={!saving}
                         placeholderTextColor="#9CA3AF"/>

                        <Text className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-1">Role / Designation</Text>
                        <TextInput
                            className="bg-gray-50 px-4 py-3 rounded-2xl border border-gray-100 text-gray-900 font-bold mb-4"
                            placeholder="Role (e.g. Loan Encoder, Collector)"
                            value={role}
                            onChangeText={setRole}
                            editable={!saving}
                         placeholderTextColor="#9CA3AF"/>

                        <Text className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-1">Base Salary (₱)</Text>
                        <TextInput
                            className="bg-gray-50 px-4 py-3 rounded-2xl border border-gray-100 text-gray-900 font-bold mb-6"
                            placeholder="Base Salary in PHP"
                            value={baseSalary}
                            onChangeText={setBaseSalary}
                            keyboardType="numeric"
                            editable={!saving}
                         placeholderTextColor="#9CA3AF"/>

                        <Pressable
                            onPress={handleSave}
                            disabled={saving}
                            className={`w-full py-4 rounded-2xl items-center justify-center ${saving ? 'bg-gray-200' : 'bg-blue-900 active:bg-green-900'}`}
                        >
                            {saving ? (
                                <ActivityIndicator color="white" size="small" />
                            ) : (
                                <Text className="text-white font-bold text-base">Save Staff</Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
