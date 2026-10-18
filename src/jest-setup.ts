import 'reflect-metadata';

// Mock Gesture Handler. Newer package builds no longer ship the legacy
// RNGestureHandlerModule path used by their jestSetup helper.
jest.mock('react-native-gesture-handler', () => ({
    __esModule: true,
    default: { install: () => {} },
    GestureHandlerRootView: ({ children }: any) => children,
    Swipeable: ({ children }: any) => children,
    DrawerLayout: ({ children }: any) => children,
    State: {},
    PanGestureHandler: ({ children }: any) => children,
    TapGestureHandler: ({ children }: any) => children,
}));

// Mock Expo Blur
jest.mock('expo-blur', () => {
    const React = require('react');
    const View = require('react-native').View;
    return {
        BlurView: (props: any) => React.createElement(View, props, props.children),
    };
});

// Set dummy env variables for Supabase
const { isProductionSupabaseUrl } = require('./database/supabaseSafety');
const currentUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

if (isProductionSupabaseUrl(currentUrl)) {
    throw new Error(
        `\n❌ SAFETY BREACH: Tests are attempting to use the PRODUCTION database!\n` +
        `Current URL: ${currentUrl}\n` +
        `Please ensure you are using .env.test or a local environment.\n`
    );
}

process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'dummy-key';

// Mock Safe Area Context for NativeWind v4 compatibility
jest.mock('react-native-safe-area-context', () => {
    const React = require('react');
    const View = require('react-native').View;
    const mockComponent = (props: Record<string, unknown>) => React.createElement(View, props, props.children);
    mockComponent.displayName = 'SafeAreaProvider';
    return {
        __esModule: true,
        SafeAreaProvider: mockComponent,
        SafeAreaView: mockComponent,
        useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
        useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
        SafeAreaConsumer: (props: { children: (insets: { top: number; right: number; bottom: number; left: number }) => unknown }) => props.children({ top: 0, right: 0, bottom: 0, left: 0 }),
        SafeAreaContext: React.createContext({ top: 0, right: 0, bottom: 0, left: 0 }),
    };
});

// Mock NativeWind
jest.mock('nativewind', () => ({
    cssInterop: jest.fn(),
    remapProps: jest.fn(),
    styled: (c: any) => c,
    withNativeWind: (c: any) => c,
}));

// Mock Vector Icons
jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    const View = require('react-native').View;
    const mockIcon = (props: Record<string, unknown>) => React.createElement(View, props);
    return {
        __esModule: true,
        Ionicons: mockIcon,
        MaterialIcons: mockIcon,
        MaterialCommunityIcons: mockIcon,
        Feather: mockIcon,
        FontAwesome: mockIcon,
        Octicons: mockIcon,
        FontAwesome6: mockIcon,
    };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Reanimated with a manual implementation to prevent native module errors in Jest
jest.mock('react-native-reanimated', () => {
    const React = require('react');
    const { View, Text } = require('react-native');
    
    const mockLayoutAnim = {
        duration: () => mockLayoutAnim,
        springify: () => mockLayoutAnim,
        delay: () => mockLayoutAnim,
        withCallback: () => mockLayoutAnim,
        build: () => () => ({ initialValues: {}, animations: {} }),
        randomDelay: () => mockLayoutAnim,
        damping: () => mockLayoutAnim,
        stiffness: () => mockLayoutAnim,
    };

    return {
        __esModule: true,
        default: {
            View: View,
            Text: Text,
            ScrollView: View,
            Image: View,
            createAnimatedComponent: (c: any) => c,
        },
        useSharedValue: (init: any) => ({ value: init }),
        useAnimatedStyle: (fn: any) => fn(),
        useAnimatedProps: (fn: any) => fn(),
        useDerivedValue: (fn: any) => ({ value: fn(), get: fn }),
        useAnimatedRef: () => ({ current: null }),
        useAnimatedScrollHandler: () => () => {},
        useAnimatedReaction: () => {},
        useEvent: () => () => {},
        withTiming: (to: any, _: any, cb: any) => { cb?.(true); return to; },
        withSpring: (to: any, _: any, cb: any) => { cb?.(true); return to; },
        withDelay: (_: any, anim: any) => anim,
        runOnJS: (fn: any) => fn,
        runOnUI: (fn: any) => fn,
        makeMutable: (init: any) => ({ value: init }),
        FadeIn: mockLayoutAnim,
        FadeInUp: mockLayoutAnim,
        FadeInDown: mockLayoutAnim,
        FadeOut: mockLayoutAnim,
        Layout: mockLayoutAnim,
        LinearTransition: mockLayoutAnim,
        BaseAnimationBuilder: mockLayoutAnim,
        ComplexAnimationBuilder: mockLayoutAnim,
    };
});

// Mock Worklets libraries to prevent native module errors in Jest
jest.mock('react-native-worklets', () => ({
    Worklets: {
        createRunOnJS: (fn: any) => fn,
        createRunOnUI: (fn: any) => fn,
        default: {
            createRunOnJS: (fn: any) => fn,
            createRunOnUI: (fn: any) => fn,
        }
    },
}));

jest.mock('react-native-worklets-core', () => ({
    Worklets: {
        createRunOnJS: (fn: any) => fn,
        createRunOnUI: (fn: any) => fn,
        default: {
            createRunOnJS: (fn: any) => fn,
            createRunOnUI: (fn: any) => fn,
        }
    },
}));

// Mock Expo Modules to prevent Babel transformation errors in node_modules
jest.mock('expo-file-system', () => ({
    cacheDirectory: 'file:///cache/',
    documentDirectory: 'file:///doc/',
    writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
    readAsStringAsync: jest.fn().mockResolvedValue(''),
    deleteAsync: jest.fn().mockResolvedValue(undefined),
    moveAsync: jest.fn().mockResolvedValue(undefined),
    copyAsync: jest.fn().mockResolvedValue(undefined),
    makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
    getInfoAsync: jest.fn().mockResolvedValue({ exists: true, isDirectory: false }),
}), { virtual: true });

jest.mock('expo-crypto', () => ({
    digestStringAsync: jest.fn(async (_algorithm, value) => `mock-digest-${value}`),
    getRandomBytesAsync: jest.fn(async (length: number) => new Uint8Array(length).fill(1)),
    randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
    CryptoDigestAlgorithm: {
        SHA256: 'SHA-256',
        SHA512: 'SHA-512',
        MD5: 'MD5',
    },
}), { virtual: true });

jest.mock('expo-sharing', () => ({
    isAvailableAsync: jest.fn().mockResolvedValue(true),
    shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-document-picker', () => ({
    getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

jest.mock('expo-print', () => ({
    printToFileAsync: jest.fn().mockResolvedValue({ uri: 'mock-uri' }),
    printAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
        canGoBack: jest.fn().mockReturnValue(true),
    }),
    useLocalSearchParams: () => ({}),
    useSegments: () => [],
    usePathname: () => '',
    Link: 'Link',
    Redirect: 'Redirect',
    Stack: 'Stack',
}));

process.env.EXPO_PUBLIC_ENCRYPTION_KEY = process.env.EXPO_PUBLIC_ENCRYPTION_KEY || 'mock-primary-key';
process.env.EXPO_PUBLIC_LEGACY_ENCRYPTION_KEY = process.env.EXPO_PUBLIC_LEGACY_ENCRYPTION_KEY || 'POSCursor_Sec_2024_Ph';

