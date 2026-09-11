import React, { useEffect } from 'react';
import { View, Text, Pressable, SafeAreaView } from 'react-native';
import { ErrorBoundaryProps, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    const router = useRouter();

    useEffect(() => {
        // Log the error securely before rendering
        console.error('[RouteErrorBoundary] Uncaught route error:', error);
    }, [error]);

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="flex-1 items-center justify-center p-6">
                <View className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 items-center w-full max-w-md">
                    <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-6">
                        <MaterialIcons name="error-outline" size={36} color="#DC2626" />
                    </View>
                    
                    <Text className="text-2xl font-bold text-gray-900 text-center mb-3">
                        Something Went Wrong
                    </Text>
                    
                    <Text className="text-base text-gray-600 text-center mb-8 leading-6">
                        We've encountered an unexpected issue while loading this screen. Our team has been notified.
                    </Text>
                    
                    <View className="w-full gap-3">
                        <Pressable 
                            onPress={retry}
                            className="w-full py-4 rounded-xl bg-blue-900 active:bg-blue-800 items-center justify-center"
                        >
                            <Text className="text-base font-semibold text-white">
                                Try Again
                            </Text>
                        </Pressable>
                        
                        <Pressable 
                            onPress={() => router.replace('/')}
                            className="w-full py-4 rounded-xl bg-gray-100 active:bg-gray-200 items-center justify-center"
                        >
                            <Text className="text-base font-semibold text-gray-800">
                                Go to Home
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}
