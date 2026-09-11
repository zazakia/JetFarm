import React, { useState } from 'react';
import { View, Text, TextInput, SafeAreaView, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, DimensionValue } from 'react-native';
import { useRouter } from 'expo-router';
import { BorrowerPortalService } from '../src/services/BorrowerPortalService';
import { AppLogo } from '../src/components/AppLogo';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../src/components/AnimatedPressable';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeIn, FadeInDown } from 'react-native-reanimated';
import { COMPANY_EMAIL_PLACEHOLDER, COMPANY_NAME } from '../src/constants/brand';
import { Colors } from '../src/constants/colors';

type FormField = 'fullName' | 'phone' | 'email' | 'password' | 'confirmPassword';

export default function RegisterScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [touched, setTouched] = useState<Record<FormField, boolean>>({
        fullName: false,
        phone: false,
        email: false,
        password: false,
        confirmPassword: false,
    });
    const router = useRouter();

    const getFieldError = (field: FormField): string | null => {
        if (!touched[field]) return null;
        switch (field) {
            case 'fullName':
                return fullName.trim().length < 2 ? 'Full name must be at least 2 characters' : null;
            case 'phone':
                return phone.trim().length === 0 ? 'Phone number is required' : null;
            case 'email':
                if (!email.trim()) return 'Email is required';
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address';
                return null;
            case 'password':
                if (password.length < 8) return 'Password must be at least 8 characters';
                return null;
            case 'confirmPassword':
                if (confirmPassword !== password) return 'Passwords do not match';
                return null;
        }
    };

    const getPasswordStrength = (): { label: string; color: string; width: DimensionValue } => {
        if (password.length === 0) return { label: '', color: 'transparent', width: '0%' };
        if (password.length < 8) return { label: 'Too short', color: '#EF4444', width: '25%' };
        let score = 0;
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;
        if (score <= 1) return { label: 'Weak', color: '#F59E0B', width: '50%' };
        if (score <= 2) return { label: 'Fair', color: '#3B82F6', width: '75%' };
        return { label: 'Strong', color: '#16A34A', width: '100%' };
    };

    async function handleRegister() {
        const allTouched = { fullName: true, phone: true, email: true, password: true, confirmPassword: true };
        setTouched(allTouched);

        const errors = (Object.keys(allTouched) as FormField[]).map(getFieldError).filter(Boolean);
        if (errors.length > 0) {
            setErrorMsg('Please correct the highlighted fields.');
            return;
        }

        if (password.length < 8) {
            setErrorMsg('Password must be at least 8 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setErrorMsg('Passwords do not match.');
            return;
        }

        setLoading(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const res = await BorrowerPortalService.registerBorrower(email, password, fullName, phone);

            if (res.success) {
                setSuccessMsg(res.message);
                setEmail('');
                setPassword('');
                setConfirmPassword('');
                setFullName('');
                setPhone('');
                setTouched({ fullName: false, phone: false, email: false, password: false, confirmPassword: false });
            } else {
                setErrorMsg(res.message);
            }
        } catch (error: any) {
            setErrorMsg(error.message || 'An unexpected error occurred during registration.');
        } finally {
            setLoading(false);
        }
    }

    const pwStrength = getPasswordStrength();

    return (
        <SafeAreaView className="flex-1">
            <LinearGradient
                colors={['#0F172A', '#1E293B', '#0F172A']}
                className="flex-1"
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1"
                >
                    <ScrollView
                        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Success State - Shows after successful registration */}
                        {successMsg ? (
                            <Animated.View
                                entering={FadeInUp.duration(500).springify()}
                                className="w-full max-w-md"
                            >
                                <View className="bg-slate-800/80 rounded-3xl p-8 border border-emerald-500/20 shadow-2xl">
                                    <View className="items-center mb-6">
                                        <View className="w-20 h-20 rounded-full bg-emerald-500/20 items-center justify-center mb-4">
                                            <MaterialIcons name="check-circle" size={48} color="#10B981" />
                                        </View>
                                        <Text className="text-white font-black text-2xl text-center">
                                            Registration Submitted
                                        </Text>
                                    </View>

                                    <View className="bg-slate-900/60 rounded-2xl p-5 mb-6 border border-emerald-500/10">
                                        <View className="flex-row items-start mb-3">
                                            <MaterialIcons name="schedule" size={20} color="#F59E0B" />
                                            <Text className="text-amber-400 font-bold text-sm uppercase tracking-wider ml-2">
                                                Pending Admin Approval
                                            </Text>
                                        </View>
                                        <Text className="text-slate-300 text-sm leading-5">
                                            {successMsg}
                                        </Text>
                                    </View>

                                    <View className="bg-slate-900/40 rounded-xl p-4 mb-6">
                                        <Text className="text-slate-400 text-xs leading-4">
                                            An administrator will review your account and activate it. You will be able to sign in once your account has been approved.
                                        </Text>
                                    </View>

                                    <AnimatedPressable
                                        onPress={() => router.back()}
                                        className="w-full"
                                    >
                                        <View className="bg-red-600 h-14 rounded-2xl justify-center items-center">
                                            <Text className="text-white font-black text-base tracking-widest uppercase">
                                                Back to Sign In
                                            </Text>
                                        </View>
                                    </AnimatedPressable>
                                </View>
                            </Animated.View>
                        ) : (
                            <Animated.View
                                entering={FadeInUp.duration(600).springify()}
                                className="w-full max-w-md"
                            >
                                {/* Header */}
                                <View className="items-center mb-8">
                                    <Animated.View entering={FadeIn.duration(400)}>
                                        <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', padding: 12, borderRadius: 16, marginBottom: 12 }}>
                                            <AppLogo size="md" hideText={true} />
                                        </View>
                                    </Animated.View>
                                    <Animated.Text
                                        entering={FadeInDown.delay(200).duration(400)}
                                        className="text-white font-black text-xl tracking-tight"
                                    >
                                        Create Account
                                    </Animated.Text>
                                    <Animated.Text
                                        entering={FadeInDown.delay(300).duration(400)}
                                        className="text-slate-400 font-medium text-sm mt-1"
                                    >
                                        Join {COMPANY_NAME}
                                    </Animated.Text>
                                </View>

                                {/* Form Card */}
                                <View className="bg-slate-800/60 rounded-3xl p-6 border border-white/5 shadow-2xl">

                                    {/* Error Message */}
                                    {errorMsg ? (
                                        <Animated.View
                                            entering={FadeIn.duration(300)}
                                            className="bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 mb-5 flex-row items-start"
                                        >
                                            <MaterialIcons name="error-outline" size={20} color="#FB7185" />
                                            <Text className="text-rose-300 ml-3 flex-1 font-semibold text-sm">
                                                {errorMsg}
                                            </Text>
                                        </Animated.View>
                                    ) : null}

                                    {/* Full Name */}
                                    <View className="mb-4">
                                        <Text className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-2 ml-1">
                                            Full Name
                                        </Text>
                                        <View className={`flex-row items-center bg-slate-900/60 border rounded-xl px-4 ${touched.fullName && getFieldError('fullName') ? 'border-rose-500/50' : 'border-white/5'}`}>
                                            <MaterialIcons name="person-outline" size={20} color="#94A3B8" />
                                            <TextInput
                                                className="flex-1 p-3.5 text-base text-white font-semibold"
                                                onChangeText={(v) => { setFullName(v); if (!touched.fullName) setTouched({ ...touched, fullName: true }); }}
                                                value={fullName}
                                                placeholder="Juan Dela Cruz"
                                                editable={!loading}
                                                placeholderTextColor="#475569"
                                            />
                                        </View>
                                        {touched.fullName && getFieldError('fullName') && (
                                            <Text className="text-rose-400 text-xs font-medium mt-1 ml-1">
                                                {getFieldError('fullName')}
                                            </Text>
                                        )}
                                    </View>

                                    {/* Phone Number */}
                                    <View className="mb-4">
                                        <Text className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-2 ml-1">
                                            Phone Number
                                        </Text>
                                        <View className={`flex-row items-center bg-slate-900/60 border rounded-xl px-4 ${touched.phone && getFieldError('phone') ? 'border-rose-500/50' : 'border-white/5'}`}>
                                            <MaterialIcons name="phone" size={20} color="#94A3B8" />
                                            <TextInput
                                                className="flex-1 p-3.5 text-base text-white font-semibold"
                                                onChangeText={(v) => { setPhone(v); if (!touched.phone) setTouched({ ...touched, phone: true }); }}
                                                value={phone}
                                                placeholder="+63 912 345 6789"
                                                keyboardType="phone-pad"
                                                editable={!loading}
                                                placeholderTextColor="#475569"
                                            />
                                        </View>
                                        {touched.phone && getFieldError('phone') && (
                                            <Text className="text-rose-400 text-xs font-medium mt-1 ml-1">
                                                {getFieldError('phone')}
                                            </Text>
                                        )}
                                    </View>

                                    {/* Email Address */}
                                    <View className="mb-4">
                                        <Text className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-2 ml-1">
                                            Email Address
                                        </Text>
                                        <View className={`flex-row items-center bg-slate-900/60 border rounded-xl px-4 ${touched.email && getFieldError('email') ? 'border-rose-500/50' : 'border-white/5'}`}>
                                            <MaterialIcons name="alternate-email" size={20} color="#94A3B8" />
                                            <TextInput
                                                className="flex-1 p-3.5 text-base text-white font-semibold"
                                                onChangeText={(v) => { setEmail(v); if (!touched.email) setTouched({ ...touched, email: true }); }}
                                                value={email}
                                                placeholder={COMPANY_EMAIL_PLACEHOLDER}
                                                autoCapitalize="none"
                                                keyboardType="email-address"
                                                editable={!loading}
                                                placeholderTextColor="#475569"
                                            />
                                        </View>
                                        {touched.email && getFieldError('email') && (
                                            <Text className="text-rose-400 text-xs font-medium mt-1 ml-1">
                                                {getFieldError('email')}
                                            </Text>
                                        )}
                                    </View>

                                    {/* Password */}
                                    <View className="mb-2">
                                        <Text className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-2 ml-1">
                                            Password
                                        </Text>
                                        <View className={`flex-row items-center bg-slate-900/60 border rounded-xl px-4 ${touched.password && getFieldError('password') ? 'border-rose-500/50' : 'border-white/5'}`}>
                                            <MaterialIcons name="lock-outline" size={20} color="#94A3B8" />
                                            <TextInput
                                                className="flex-1 p-3.5 text-base text-white font-semibold"
                                                onChangeText={(v) => { setPassword(v); if (!touched.password) setTouched({ ...touched, password: true }); }}
                                                value={password}
                                                secureTextEntry={!showPassword}
                                                placeholder="Min. 8 characters"
                                                autoCapitalize="none"
                                                editable={!loading}
                                                placeholderTextColor="#475569"
                                            />
                                            <AnimatedPressable
                                                onPress={() => setShowPassword(!showPassword)}
                                                className="p-2"
                                            >
                                                <Ionicons
                                                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                                                    size={22}
                                                    color="#94A3B8"
                                                />
                                            </AnimatedPressable>
                                        </View>
                                        {touched.password && getFieldError('password') && (
                                            <Text className="text-rose-400 text-xs font-medium mt-1 ml-1">
                                                {getFieldError('password')}
                                            </Text>
                                        )}
                                        {/* Password strength indicator */}
                                        {password.length > 0 && (
                                            <View className="mt-2 ml-1">
                                                <View className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                                                    <View
                                                        className="h-full rounded-full"
                                                        style={{ backgroundColor: pwStrength.color, width: pwStrength.width }}
                                                    />
                                                </View>
                                                <Text className="text-xs font-semibold mt-1" style={{ color: pwStrength.color }}>
                                                    {pwStrength.label}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Confirm Password */}
                                    <View className="mb-2 mt-2">
                                        <Text className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-2 ml-1">
                                            Confirm Password
                                        </Text>
                                        <View className={`flex-row items-center bg-slate-900/60 border rounded-xl px-4 ${touched.confirmPassword && getFieldError('confirmPassword') ? 'border-rose-500/50' : 'border-white/5'}`}>
                                            <MaterialIcons name="lock-outline" size={20} color="#94A3B8" />
                                            <TextInput
                                                className="flex-1 p-3.5 text-base text-white font-semibold"
                                                onChangeText={(v) => { setConfirmPassword(v); if (!touched.confirmPassword) setTouched({ ...touched, confirmPassword: true }); }}
                                                value={confirmPassword}
                                                secureTextEntry={!showConfirmPassword}
                                                placeholder="Re-enter password"
                                                autoCapitalize="none"
                                                editable={!loading}
                                                placeholderTextColor="#475569"
                                            />
                                            <AnimatedPressable
                                                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="p-2"
                                            >
                                                <Ionicons
                                                    name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                                                    size={22}
                                                    color="#94A3B8"
                                                />
                                            </AnimatedPressable>
                                        </View>
                                        {touched.confirmPassword && getFieldError('confirmPassword') && (
                                            <Text className="text-rose-400 text-xs font-medium mt-1 ml-1">
                                                {getFieldError('confirmPassword')}
                                            </Text>
                                        )}
                                    </View>
                                </View>

                                {/* Submit Button */}
                                <AnimatedPressable
                                    onPress={handleRegister}
                                    disabled={loading}
                                    className="mt-5"
                                >
                                    <LinearGradient
                                        colors={loading ? ['#4B5563', '#374151'] : ['#DC2626', '#991B1B']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        className="w-full h-14 rounded-2xl justify-center items-center shadow-lg"
                                        style={loading ? {} : { shadowColor: '#DC2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="#9CA3AF" />
                                        ) : (
                                            <View className="flex-row items-center">
                                                <MaterialIcons name="how-to-reg" size={20} color="#F8FAFC" />
                                                <Text className="text-white font-black text-base tracking-widest uppercase ml-2">
                                                    Register
                                                </Text>
                                            </View>
                                        )}
                                    </LinearGradient>
                                </AnimatedPressable>

                                {/* Approval notice */}
                                <View className="mt-5 bg-slate-800/40 rounded-2xl p-4 border border-amber-500/10">
                                    <View className="flex-row items-start">
                                        <MaterialIcons name="info-outline" size={18} color="#F59E0B" />
                                        <Text className="text-slate-400 text-xs leading-4 ml-2 flex-1">
                                            No email verification required. After registration, an administrator will review and activate your account before you can sign in.
                                        </Text>
                                    </View>
                                </View>

                                {/* Sign In link */}
                                <View className="flex-row justify-center mt-6">
                                    <Text className="text-slate-500 font-semibold">Already have an account?</Text>
                                    <AnimatedPressable onPress={() => router.back()} className="ml-2">
                                        <Text className="font-black text-red-500">Sign In</Text>
                                    </AnimatedPressable>
                                </View>
                            </Animated.View>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </LinearGradient>
        </SafeAreaView>
    );
}
