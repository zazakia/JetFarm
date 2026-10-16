import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Animated, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export interface ToastOptions {
    type?: 'success' | 'error' | 'info';
    text1?: string;
    text2?: string;
    visibilityTime?: number;
    autoHide?: boolean;
}

type ToastListener = (options: ToastOptions | null) => void;
const listeners = new Set<ToastListener>();

export const WebToastEmitter = {
    show(options: ToastOptions) {
        listeners.forEach(fn => fn(options));
    },
    hide() {
        listeners.forEach(fn => fn(null));
    },
    subscribe(fn: ToastListener) {
        listeners.add(fn);
        return () => {
            listeners.delete(fn);
        };
    },
};

const Toast = () => {
    const [toast, setToast] = useState<ToastOptions | null>(null);

    useEffect(() => {
        const unsubscribe = WebToastEmitter.subscribe(next => {
            setToast(next);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!toast || toast.autoHide === false) return;
        const duration = toast.visibilityTime || 4500;
        const timer = setTimeout(() => {
            setToast(null);
        }, duration);
        return () => clearTimeout(timer);
    }, [toast]);

    if (!toast) return null;

    const type = toast.type || 'success';
    const isSuccess = type === 'success';
    const isError = type === 'error';

    const borderColor = isSuccess
        ? 'border-emerald-500'
        : isError
        ? 'border-rose-500'
        : 'border-blue-500';

    const iconName: keyof typeof MaterialIcons.glyphMap = isSuccess
        ? 'check-circle'
        : isError
        ? 'error'
        : 'info';

    const iconColor = isSuccess
        ? '#047857'
        : isError
        ? '#DC2626'
        : '#2563EB';

    const badgeBg = isSuccess
        ? 'bg-emerald-100'
        : isError
        ? 'bg-rose-100'
        : 'bg-blue-100';

    return (
        <View
            testID="web-toast-container"
            style={{
                position: 'fixed' as any,
                top: 20,
                left: 0,
                right: 0,
                alignItems: 'center',
                zIndex: 99999,
                pointerEvents: 'box-none',
            }}
        >
            <View
                className={`bg-white border-2 ${borderColor} shadow-2xl rounded-2xl p-4 flex-row items-center max-w-lg w-[92%] gap-3`}
                style={{
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                }}
            >
                <View className={`w-10 h-10 rounded-full ${badgeBg} items-center justify-center`}>
                    <MaterialIcons name={iconName} size={24} color={iconColor} />
                </View>

                <View className="flex-1">
                    {toast.text1 ? (
                        <Text className="text-gray-900 font-black text-sm">{toast.text1}</Text>
                    ) : null}
                    {toast.text2 ? (
                        <Text className="text-gray-600 font-medium text-xs mt-0.5">{toast.text2}</Text>
                    ) : null}
                </View>

                <Pressable
                    testID="web-toast-dismiss-button"
                    onPress={() => setToast(null)}
                    className="p-1.5 rounded-full hover:bg-gray-100 active:bg-gray-200"
                >
                    <MaterialIcons name="close" size={18} color="#6B7280" />
                </Pressable>
            </View>
        </View>
    );
};

export interface ToastComponentType extends React.FC {
    show: (options: ToastOptions) => void;
    hide: () => void;
}

// Static methods for triggering toast
(Toast as any).show = (options: ToastOptions) => {
    WebToastEmitter.show(options);
};

(Toast as any).hide = () => {
    WebToastEmitter.hide();
};

export default Toast as unknown as ToastComponentType;
