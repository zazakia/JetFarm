import React from 'react';
import { Image, Text, View } from 'react-native';
import { COMPANY_NAME } from '../constants/brand';
import { getAppVersion } from '../constants/AppVersion';

type Size = 'sm' | 'md' | 'lg';

interface Props {
    size?: Size;
    layout?: 'stacked' | 'horizontal';
    subtitle?: string;
    textColor?: string;
    subtitleColor?: string;
    hideText?: boolean;
    showVersion?: boolean;
}

const sizeMap = {
    sm: 34,
    md: 56,
    lg: 96,
};

const textMap = {
    sm: 13,
    md: 18,
    lg: 24,
};

const logoSource = require('../../assets/agri_one_logo.png');

export function AppLogo({
    size = 'md',
    layout = 'stacked',
    subtitle,
    textColor = '#0F172A',
    subtitleColor = '#64748B',
    hideText = false,
    showVersion = true,
}: Props) {
    const imageSize = sizeMap[size];
    const textSize = textMap[size];
    const isHorizontal = layout === 'horizontal';
    const currentVersion = getAppVersion();

    const isDarkText = textColor === '#0F172A' || textColor === '#000000' || textColor === '#1E293B';
    const badgeBg = isDarkText ? 'rgba(22, 163, 74, 0.12)' : 'rgba(16, 185, 129, 0.2)';
    const badgeBorder = isDarkText ? 'rgba(22, 163, 74, 0.25)' : 'rgba(52, 211, 153, 0.35)';
    const badgeText = isDarkText ? '#15803D' : '#34D399';

    return (
        <View
            style={{
                flexDirection: isHorizontal ? 'row' : 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Image
                source={logoSource}
                resizeMode="contain"
                style={{
                    width: imageSize,
                    height: imageSize,
                    borderRadius: size === 'sm' ? 6 : 10,
                    marginRight: isHorizontal && !hideText ? 10 : 0,
                    marginBottom: !isHorizontal && !hideText ? 8 : 0,
                }}
            />
            {!hideText && (
                <View style={{ alignItems: isHorizontal ? 'flex-start' : 'center', flexShrink: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text
                            style={{
                                color: textColor,
                                fontSize: textSize,
                                fontWeight: '900',
                                letterSpacing: 0,
                                textAlign: isHorizontal ? 'left' : 'center',
                            }}
                        >
                            {COMPANY_NAME}
                        </Text>
                        {showVersion && (
                            <View
                                testID="app-logo-version-badge"
                                style={{
                                    marginLeft: 6,
                                    paddingHorizontal: size === 'sm' ? 5 : 7,
                                    paddingVertical: size === 'sm' ? 1 : 2,
                                    borderRadius: 6,
                                    backgroundColor: badgeBg,
                                    borderWidth: 1,
                                    borderColor: badgeBorder,
                                }}
                            >
                                <Text
                                    style={{
                                        color: badgeText,
                                        fontSize: size === 'sm' ? 9 : size === 'md' ? 11 : 13,
                                        fontWeight: '800',
                                        letterSpacing: 0.5,
                                    }}
                                >
                                    v{currentVersion}
                                </Text>
                            </View>
                        )}
                    </View>
                    {subtitle ? (
                        <Text
                            style={{
                                color: subtitleColor,
                                fontSize: size === 'sm' ? 10 : 12,
                                fontWeight: '700',
                                marginTop: 2,
                                textAlign: isHorizontal ? 'left' : 'center',
                                textTransform: 'uppercase',
                            }}
                        >
                            {subtitle}
                        </Text>
                    ) : null}
                </View>
            )}
        </View>
    );
}
