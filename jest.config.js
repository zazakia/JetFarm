module.exports = {
    preset: "jest-expo",
    setupFilesAfterEnv: [
        "@testing-library/jest-native/extend-expect",
        "<rootDir>/src/jest-setup.ts"
    ],
    transformIgnorePatterns: [
        "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@expo/metro-runtime|react-native-toast-message|react-native-css-interop|react-native-gesture-handler|expo-file-system|expo-document-picker)",
    ],
    testMatch: [
        "**/?(*.)+(test).[tj]s?(x)"
    ],
    testPathIgnorePatterns: [
        "<rootDir>/node_modules/",
        "<rootDir>/tests/",
        "<rootDir>/src/__tests__/test-utils.ts"
    ],
    testTimeout: 15000,
    maxWorkers: 2,
    clearMocks: true,
    restoreMocks: false,
    collectCoverageFrom: [
        "src/**/*.{js,jsx,ts,tsx}",
        "!src/**/*.d.ts",
        "!src/mocks/**",
        "!src/assets/**",
        "!src/constants/generatedAppUpdates.ts"
    ],
    coverageReporters: ["text", "lcov", "json-summary"]
};
