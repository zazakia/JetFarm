import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingTourProvider, useOnboardingTour, ONBOARDING_STORAGE_KEY } from '../../../context/OnboardingTourContext';
import { OnboardingTourModal } from '../OnboardingTourModal';
import { Text, Pressable, View } from 'react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

jest.mock('../../../services/SampleDataService', () => ({
    SampleDataService: {
        enable: jest.fn().mockResolvedValue(undefined),
    },
}));

function TestConsumer() {
    const tour = useOnboardingTour();
    if (!tour) return <Text>No Tour Context</Text>;

    return (
        <View>
            <Text testID="tour-is-open">{tour.isOpen ? 'open' : 'closed'}</Text>
            <Text testID="tour-step">{tour.currentStepIndex + 1}</Text>
            <Text testID="tour-total">{tour.totalSteps}</Text>
            <Pressable testID="btn-start" onPress={() => tour.startTour()}><Text>Start</Text></Pressable>
            <Pressable testID="btn-next" onPress={() => tour.nextStep()}><Text>Next</Text></Pressable>
            <Pressable testID="btn-prev" onPress={() => tour.prevStep()}><Text>Prev</Text></Pressable>
            <Pressable testID="btn-skip" onPress={() => tour.skipTour()}><Text>Skip</Text></Pressable>
            <Pressable testID="btn-finish" onPress={() => tour.finishTour()}><Text>Finish</Text></Pressable>
            <Pressable testID="btn-reset" onPress={() => tour.resetTour()}><Text>Reset</Text></Pressable>
        </View>
    );
}

describe('OnboardingTour System', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');
        (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
        (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    });

    describe('OnboardingTourContext', () => {
        it('initializes and provides tour methods correctly', async () => {
            const { getByTestId } = render(
                <OnboardingTourProvider autoStartIfNew={false}>
                    <TestConsumer />
                </OnboardingTourProvider>
            );

            await waitFor(() => {
                expect(getByTestId('tour-is-open').props.children).toBe('closed');
            });
            expect(getByTestId('tour-step').props.children).toBe(1);
            expect(getByTestId('tour-total').props.children).toBe(6);

            // Start Tour
            act(() => {
                fireEvent.press(getByTestId('btn-start'));
            });
            expect(getByTestId('tour-is-open').props.children).toBe('open');

            // Next Step
            act(() => {
                fireEvent.press(getByTestId('btn-next'));
            });
            expect(getByTestId('tour-step').props.children).toBe(2);

            // Previous Step
            act(() => {
                fireEvent.press(getByTestId('btn-prev'));
            });
            expect(getByTestId('tour-step').props.children).toBe(1);

            // Skip Tour
            await act(async () => {
                fireEvent.press(getByTestId('btn-skip'));
            });
            expect(getByTestId('tour-is-open').props.children).toBe('closed');
            expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_STORAGE_KEY, 'true');

            // Reset Tour
            await act(async () => {
                fireEvent.press(getByTestId('btn-reset'));
            });
            expect(getByTestId('tour-is-open').props.children).toBe('open');
            expect(getByTestId('tour-step').props.children).toBe(1);
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith(ONBOARDING_STORAGE_KEY);
        });

        it('does not advance past the last step or before step 1', async () => {
            const { getByTestId } = render(
                <OnboardingTourProvider autoStartIfNew={false}>
                    <TestConsumer />
                </OnboardingTourProvider>
            );

            await waitFor(() => {
                expect(getByTestId('tour-step').props.children).toBe(1);
            });

            // Cannot go below step 1
            act(() => {
                fireEvent.press(getByTestId('btn-prev'));
            });
            expect(getByTestId('tour-step').props.children).toBe(1);

            // Advance through all 6 steps
            for (let i = 0; i < 10; i++) {
                act(() => {
                    fireEvent.press(getByTestId('btn-next'));
                });
            }
            expect(getByTestId('tour-step').props.children).toBe(6);
        });
    });

    describe('OnboardingTourModal UI', () => {
        it('renders modal with step 1 content when active', async () => {
            const { getByTestId, getByText, queryByText } = render(
                <OnboardingTourProvider autoStartIfNew={false}>
                    <TestConsumer />
                    <OnboardingTourModal />
                </OnboardingTourProvider>
            );

            await waitFor(() => {
                expect(getByTestId('tour-is-open').props.children).toBe('closed');
            });

            // Open tour
            act(() => {
                fireEvent.press(getByTestId('btn-start'));
            });

            expect(getByTestId('onboarding-tour-card')).toBeTruthy();
            expect(getByTestId('onboarding-step-counter')).toBeTruthy();
            expect(getByText('Welcome to Agri-One')).toBeTruthy();
            expect(queryByText(/Welcome to JetFarm/)).toBeNull();
            expect(getByTestId('onboarding-primary-button')).toBeTruthy();
            expect(getByText('Start tour')).toBeTruthy();
            expect(getByText('Skip tour')).toBeTruthy();
        });

        it('navigates through steps to completion and finishes', async () => {
            const { getByTestId, getByText, queryByTestId } = render(
                <OnboardingTourProvider autoStartIfNew={false}>
                    <TestConsumer />
                    <OnboardingTourModal />
                </OnboardingTourProvider>
            );

            await waitFor(() => {
                expect(getByTestId('tour-is-open').props.children).toBe('closed');
            });

            act(() => {
                fireEvent.press(getByTestId('btn-start'));
            });

            // Step 1: Click "Start tour" -> moves to Step 2
            act(() => {
                fireEvent.press(getByTestId('onboarding-primary-button'));
            });
            expect(getByText('Agribusiness Command Center')).toBeTruthy();
            expect(getByText('Back')).toBeTruthy();

            // Advance through remaining steps
            act(() => {
                fireEvent.press(getByTestId('onboarding-primary-button')); // Step 3
            });
            expect(getByText('Yield Analytics & Settlements')).toBeTruthy();

            act(() => {
                fireEvent.press(getByTestId('onboarding-primary-button')); // Step 4
            });
            expect(getByText('Accounting & Financial Statements')).toBeTruthy();

            act(() => {
                fireEvent.press(getByTestId('onboarding-primary-button')); // Step 5
            });
            expect(getByText('100% Offline-Ready Data Engine')).toBeTruthy();

            act(() => {
                fireEvent.press(getByTestId('onboarding-primary-button')); // Step 6
            });
            expect(getByText('Help Guides & Demo Data')).toBeTruthy();
            expect(getByText('Explore Agri-One')).toBeTruthy();
            expect(getByTestId('onboarding-load-demo-button')).toBeTruthy();

            // Finish Tour
            await act(async () => {
                fireEvent.press(getByTestId('onboarding-primary-button'));
            });

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_STORAGE_KEY, 'true');
            expect(queryByTestId('onboarding-tour-card')).toBeNull();
        });

        it('closes modal when skip or close button is clicked', async () => {
            const { getByTestId, queryByTestId } = render(
                <OnboardingTourProvider autoStartIfNew={false}>
                    <TestConsumer />
                    <OnboardingTourModal />
                </OnboardingTourProvider>
            );

            await waitFor(() => {
                expect(getByTestId('tour-is-open').props.children).toBe('closed');
            });

            act(() => {
                fireEvent.press(getByTestId('btn-start'));
            });
            expect(getByTestId('onboarding-tour-card')).toBeTruthy();

            await act(async () => {
                fireEvent.press(getByTestId('onboarding-close-button'));
            });

            expect(queryByTestId('onboarding-tour-card')).toBeNull();
            expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_STORAGE_KEY, 'true');
        });
    });
});
