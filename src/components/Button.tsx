import React from 'react';
import { TouchableOpacity, Text, TouchableOpacityProps, ActivityIndicator } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
    title: string;
    loading?: boolean;
    variant?: 'primary' | 'secondary' | 'danger' | 'outline';
    className?: string;
}

export function Button({ title, loading, variant = 'primary', className = '', accessibilityLabel, ...props }: ButtonProps) {
    const bgClass = variant === 'primary' 
        ? 'bg-emerald-600 active:bg-emerald-700' 
        : variant === 'danger' 
        ? 'bg-red-600 active:bg-red-700' 
        : variant === 'outline' 
        ? 'bg-transparent border border-gray-400 active:bg-gray-100' 
        : 'bg-gray-200 active:bg-gray-300';
    const textClass = variant === 'secondary' || variant === 'outline' ? 'text-gray-800' : 'text-white';

    return (
        <TouchableOpacity 
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || title}
            accessibilityState={{ disabled: !!props.disabled, busy: !!loading }}
            className={`min-h-[44px] px-4 py-2.5 rounded-xl flex-row justify-center items-center active:scale-[0.98] ${bgClass} ${props.disabled ? 'opacity-50' : ''} ${className}`}
            {...props}
        >
            {loading ? <ActivityIndicator color={variant === 'secondary' || variant === 'outline' ? '#374151' : '#FFFFFF'} className="mr-2" /> : null}
            <Text className={`font-bold text-center ${textClass}`}>{title}</Text>
        </TouchableOpacity>
    );
}
