const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const exclusionList = require("metro-config/private/defaults/exclusionList").default;

// Re-implementing withNativeWind to fix the ERR_UNSUPPORTED_DIR_IMPORT bug in nativewind@4
const { withCssInterop } = require("react-native-css-interop/metro");
const { cssToReactNativeRuntimeOptions } = require("nativewind/dist/metro/common.js");
const { tailwindConfig, tailwindCli } = require("nativewind/dist/metro/tailwind/index.js");

function withNativeWindFixed(config, { input, ...options } = {}) {
    if (input) input = path.resolve(input);
    const cli = tailwindCli((...args) => console.log("[NativeWind]", ...args));

    return withCssInterop(config, {
        ...cssToReactNativeRuntimeOptions,
        ...options,
        input,
        getCSSForPlatform: (platform, onChange) => {
            return cli.getCSSForPlatform({
                platform,
                input,
                onChange: (...args) => {
                    try {
                        if (onChange) onChange(...args);
                    } catch (e) {
                        console.warn("[NativeWind] Suppressed Metro cache crash:", e.message);
                    }
                },
                browserslist: "last 1 version",
                browserslistEnv: "native",
            });
        },
    });
}

const config = getDefaultConfig(__dirname);

config.resolver.blockList = exclusionList([
    /test-results.+/,
    /playwright-report.+/,
    /coverage.+/,
    new RegExp(path.join(__dirname, 'dist').replace(/[/\\]/g, '[/\\\\]') + '.*'),
    new RegExp(path.join(__dirname, 'tmp').replace(/[/\\]/g, '[/\\\\]') + '.*'),
]);

const nativeWindConfig = withNativeWindFixed(config, { input: "./global.css" });
const defaultResolveRequest = nativeWindConfig.resolver.resolveRequest;

nativeWindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === '@supabase/supabase-js' && platform !== 'web') {
        moduleName = '@supabase/supabase-js/dist/index.cjs';
    }
    
    if (defaultResolveRequest) {
        return defaultResolveRequest(context, moduleName, platform);
    }
    
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = nativeWindConfig;
