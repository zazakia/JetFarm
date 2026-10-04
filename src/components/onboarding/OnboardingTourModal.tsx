import React, { useEffect } from 'react';
import { View, Text, Pressable, Modal, Platform, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOnboardingTour } from '../../context/OnboardingTourContext';
import { SampleDataService } from '../../services/SampleDataService';
import { database } from '../../database';

export function OnboardingTourModal() {
    const router = useRouter();
    const tour = useOnboardingTour();

    const isOpen = tour?.isOpen ?? false;
    const currentStepIndex = tour?.currentStepIndex ?? 0;
    const totalSteps = tour?.totalSteps ?? 0;
    const currentStep = tour?.currentStep;
    const nextStep = tour?.nextStep ?? (() => {});
    const prevStep = tour?.prevStep ?? (() => {});
    const skipTour = tour?.skipTour ?? (async () => {});
    const finishTour = tour?.finishTour ?? (async () => {});

    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex === totalSteps - 1;

    // Web keyboard shortcuts (ArrowLeft, ArrowRight, Escape)
    useEffect(() => {
        if (!isOpen || Platform.OS !== 'web') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                skipTour();
            } else if (e.key === 'ArrowRight') {
                if (isLastStep) {
                    finishTour();
                } else {
                    nextStep();
                }
            } else if (e.key === 'ArrowLeft') {
                if (!isFirstStep) {
                    prevStep();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isFirstStep, isLastStep, nextStep, prevStep, skipTour, finishTour]);

    if (!isOpen || !currentStep) return null;

    const handlePrimaryAction = () => {
        if (isLastStep) {
            finishTour();
            if (currentStep.targetRoute) {
                router.push(currentStep.targetRoute as any);
            }
        } else {
            nextStep();
        }
    };

    const handleLoadDemoData = async () => {
        try {
            await SampleDataService.enable(database);
            Alert.alert(
                'Demo Data Ready',
                'Sample agribusiness parcels, crop cycles, and POS items have been populated successfully!'
            );
            finishTour();
            router.push('/(admin)/agribusiness' as any);
        } catch (error: any) {
            Alert.alert('Notice', error?.message || 'Could not load demo data at this time.');
        }
    };

    return (
        <Modal
            visible={isOpen}
            transparent={true}
            animationType="fade"
            onRequestClose={skipTour}
        >
            {/* Dark Spotlight Backdrop */}
            <View className="flex-1 bg-black/70 justify-center items-center p-4">
                {/* Floating Tour Popover Card */}
                <View
                    testID="onboarding-tour-card"
                    className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-3xl p-6 shadow-2xl"
                >
                    {/* Top Row: Step Counter & Close */}
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center">
                            <Text
                                testID="onboarding-step-counter"
                                className="text-gray-400 font-mono font-bold text-xs tracking-wider"
                            >
                                {currentStepIndex + 1} / {totalSteps}
                            </Text>
                            {currentStep.badgeText && (
                                <View
                                    className={`ml-2 px-2 py-0.5 rounded-full ${
                                        currentStep.badgeColor || 'bg-blue-600'
                                    }`}
                                >
                                    <Text className="text-white text-[10px] font-bold uppercase tracking-wider">
                                        {currentStep.badgeText}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Pressable
                            testID="onboarding-close-button"
                            onPress={skipTour}
                            className="w-8 h-8 rounded-full bg-gray-800 items-center justify-center active:bg-gray-700"
                            hitSlop={8}
                        >
                            <MaterialIcons name="close" size={18} color="#9CA3AF" />
                        </Pressable>
                    </View>

                    {/* Step Icon & Title */}
                    <View className="flex-row items-center mb-2">
                        <View className="w-10 h-10 rounded-2xl bg-gray-800 items-center justify-center mr-3 border border-gray-700">
                            <MaterialIcons
                                name={currentStep.icon}
                                size={22}
                                color="#FFFFFF"
                            />
                        </View>
                        <Text
                            testID="onboarding-step-title"
                            className="text-white font-extrabold text-xl flex-1"
                        >
                            {currentStep.title}
                        </Text>
                    </View>

                    {/* Step Description */}
                    <Text className="text-gray-300 text-sm leading-6 mb-6">
                        {currentStep.description}
                    </Text>

                    {/* Highlighted Module Indicator (if any) */}
                    {currentStep.highlightLabel && (
                        <View className="bg-gray-800/80 border border-gray-700 rounded-2xl p-3 mb-5 flex-row items-center">
                            <MaterialIcons name="location-searching" size={18} color="#60A5FA" />
                            <Text className="text-blue-300 text-xs font-semibold ml-2">
                                Highlighted: {currentStep.highlightLabel}
                            </Text>
                        </View>
                    )}

                    {/* Extra Action on Final Step: Demo Data Load */}
                    {isLastStep && (
                        <Pressable
                            testID="onboarding-load-demo-button"
                            onPress={handleLoadDemoData}
                            className="mb-4 bg-purple-900/40 border border-purple-600/50 rounded-2xl p-3 flex-row items-center justify-between active:bg-purple-900/60"
                        >
                            <View className="flex-row items-center flex-1 mr-2">
                                <MaterialIcons name="auto-fix-high" size={20} color="#C084FC" />
                                <View className="ml-2.5">
                                    <Text className="text-purple-200 font-bold text-xs">
                                        Populate Demo Data
                                    </Text>
                                    <Text className="text-purple-300/80 text-[11px]">
                                        Test farm parcels, crop cycles & POS risk-free
                                    </Text>
                                </View>
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color="#C084FC" />
                        </Pressable>
                    )}

                    {/* Bottom Action Footer */}
                    <View className="flex-row items-center justify-between pt-2 border-t border-gray-800">
                        {isFirstStep ? (
                            <Pressable
                                testID="onboarding-skip-button"
                                onPress={skipTour}
                                className="py-2.5 px-3 rounded-xl active:bg-gray-800"
                            >
                                <Text className="text-gray-400 font-bold text-sm">
                                    Skip tour
                                </Text>
                            </Pressable>
                        ) : (
                            <Pressable
                                testID="onboarding-back-button"
                                onPress={prevStep}
                                className="py-2.5 px-3 rounded-xl active:bg-gray-800 flex-row items-center"
                            >
                                <MaterialIcons name="arrow-back" size={16} color="#9CA3AF" />
                                <Text className="text-gray-300 font-bold text-sm ml-1">
                                    Back
                                </Text>
                            </Pressable>
                        )}

                        <View className="flex-row items-center gap-2">
                            {!isFirstStep && !isLastStep && (
                                <Pressable
                                    onPress={skipTour}
                                    className="py-2.5 px-2 rounded-xl active:bg-gray-800 mr-1"
                                >
                                    <Text className="text-gray-500 font-semibold text-xs">
                                        Exit
                                    </Text>
                                </Pressable>
                            )}

                            <Pressable
                                testID="onboarding-primary-button"
                                onPress={handlePrimaryAction}
                                className={`py-2.5 px-5 rounded-2xl active:opacity-90 flex-row items-center ${
                                    isLastStep
                                        ? 'bg-emerald-500 active:bg-emerald-600'
                                        : 'bg-white active:bg-gray-200'
                                }`}
                            >
                                <Text
                                    className={`font-black text-sm mr-1 ${
                                        isLastStep ? 'text-white' : 'text-gray-900'
                                    }`}
                                >
                                    {isFirstStep
                                        ? 'Start tour'
                                        : isLastStep
                                        ? 'Explore JetFarm'
                                        : 'Next'}
                                </Text>
                                <MaterialIcons
                                    name={isLastStep ? 'check' : 'arrow-forward'}
                                    size={16}
                                    color={isLastStep ? '#FFFFFF' : '#111827'}
                                />
                            </Pressable>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export default OnboardingTourModal;
