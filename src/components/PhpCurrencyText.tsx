import React from 'react';
import { Text, TextProps } from 'react-native';
import { formatPHP } from '../utils/currency';

interface Props extends TextProps {
    amount: number | null | undefined;
}

export function PhpCurrencyText({ amount, style, className, ...props }: Props) {
    return (
        <Text style={style} className={className} {...props}>
            {formatPHP(amount)}
        </Text>
    );
}
