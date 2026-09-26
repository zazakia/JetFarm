import React from 'react';
import { Image, Text, View } from 'react-native';
import { COMPANY_NAME } from '../constants/brand';

type Size = 'sm' | 'md' | 'lg';

interface Props {
    size?: Size;
    layout?: 'stacked' | 'horizontal';
    subtitle?: string;
    textColor?: string;
    subtitleColor?: string;
    hideText?: boolean;
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
}: Props) {
    const imageSize = sizeMap[size];
    const textSize = textMap[size];
    const isHorizontal = layout === 'horizontal';

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
