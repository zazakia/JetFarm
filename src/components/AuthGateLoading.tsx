import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COMPANY_NAME } from '../constants/brand';

type AuthGateLoadingProps = {
    message?: string;
};

export function AuthGateLoading({ message = 'Checking access...' }: AuthGateLoadingProps) {
    return (
        <View
            style={styles.container}
            accessibilityRole="progressbar"
            accessibilityLabel={message}
        >
            <Text style={styles.brand}>{COMPANY_NAME}</Text>
            <ActivityIndicator color="#1E3A8A" size="small" style={styles.spinner} />
            <Text style={styles.message}>{message}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F9FAFB',
        padding: 24,
    },
    brand: {
        color: '#1E3A8A',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 2,
        marginBottom: 10,
    },
    spinner: {
        marginBottom: 10,
    },
    message: {
        color: '#4B5563',
        fontSize: 14,
        textAlign: 'center',
    },
});
