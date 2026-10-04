import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ADMIN_ONBOARDING_STEPS, OnboardingStep } from '../constants/onboardingSteps';

export const ONBOARDING_STORAGE_KEY = '@jetfarm:onboarding_tour_completed_v1';

export interface OnboardingTourContextType {
    isOpen: boolean;
    currentStepIndex: number;
    steps: OnboardingStep[];
    currentStep: OnboardingStep;
    totalSteps: number;
    hasCompletedTour: boolean;
    loading: boolean;
    startTour: () => void;
    nextStep: () => void;
    prevStep: () => void;
    skipTour: () => Promise<void>;
    finishTour: () => Promise<void>;
    resetTour: () => Promise<void>;
}

const OnboardingTourContext = createContext<OnboardingTourContextType | null>(null);

export function OnboardingTourProvider({
    children,
    steps = ADMIN_ONBOARDING_STEPS,
    autoStartIfNew = true,
}: {
    children: React.ReactNode;
    steps?: OnboardingStep[];
    autoStartIfNew?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [hasCompletedTour, setHasCompletedTour] = useState(true); // default true while checking
    const [loading, setLoading] = useState(true);

    const checkTourStatus = useCallback(async () => {
        try {
            const completed = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
            const isCompleted = completed === 'true';
            setHasCompletedTour(isCompleted);

            if (!isCompleted && autoStartIfNew) {
                // Short delay so layout finishes rendering smoothly
                setTimeout(() => {
                    setIsOpen(true);
                    setCurrentStepIndex(0);
                }, 600);
            }
        } catch (error) {
            console.warn('[OnboardingTour] Failed reading tour completion status:', error);
        } finally {
            setLoading(false);
        }
    }, [autoStartIfNew]);

    useEffect(() => {
        checkTourStatus();
    }, [checkTourStatus]);

    const startTour = useCallback(() => {
        setCurrentStepIndex(0);
        setIsOpen(true);
    }, []);

    const nextStep = useCallback(() => {
        setCurrentStepIndex(prev => {
            if (prev < steps.length - 1) {
                return prev + 1;
            }
            return prev;
        });
    }, [steps.length]);

    const prevStep = useCallback(() => {
        setCurrentStepIndex(prev => {
            if (prev > 0) {
                return prev - 1;
            }
            return prev;
        });
    }, []);

    const skipTour = useCallback(async () => {
        setIsOpen(false);
        try {
            await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
            setHasCompletedTour(true);
        } catch (error) {
            console.warn('[OnboardingTour] Failed saving skipped tour status:', error);
        }
    }, []);

    const finishTour = useCallback(async () => {
        setIsOpen(false);
        try {
            await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
            setHasCompletedTour(true);
        } catch (error) {
            console.warn('[OnboardingTour] Failed saving completed tour status:', error);
        }
    }, []);

    const resetTour = useCallback(async () => {
        try {
            await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY);
            setHasCompletedTour(false);
            setCurrentStepIndex(0);
            setIsOpen(true);
        } catch (error) {
            console.warn('[OnboardingTour] Failed resetting tour status:', error);
        }
    }, []);

    const currentStep = steps[currentStepIndex] || steps[0];

    return (
        <OnboardingTourContext.Provider
            value={{
                isOpen,
                currentStepIndex,
                steps,
                currentStep,
                totalSteps: steps.length,
                hasCompletedTour,
                loading,
                startTour,
                nextStep,
                prevStep,
                skipTour,
                finishTour,
                resetTour,
            }}
        >
            {children}
        </OnboardingTourContext.Provider>
    );
}

export function useOnboardingTour(): OnboardingTourContextType | null {
    return useContext(OnboardingTourContext);
}
