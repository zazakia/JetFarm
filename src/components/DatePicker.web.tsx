import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';

interface DatePickerProps {
    value: string; // YYYY-MM-DD
    onChange: (date: string) => void;
    placeholder?: string;
    onClear?: () => void;
}

const containerStyle: React.CSSProperties = {
    alignItems: 'center',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
    display: 'flex',
    flexDirection: 'row',
    padding: '10px 12px',
};

const inputStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#111827',
    flex: 1,
    fontFamily: 'inherit',
    fontSize: 14,
    marginLeft: 8,
    minWidth: 0,
    outline: 'none',
};

const clearButtonStyle: React.CSSProperties = {
    alignItems: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    marginLeft: 6,
    padding: 2,
};

export const DatePicker: React.FC<DatePickerProps> = ({
    value,
    onChange,
    placeholder = 'Select Date',
    onClear,
}) => {
    return React.createElement(
        'div',
        { style: containerStyle },
        React.createElement(MaterialIcons, { name: 'calendar-today', size: 18, color: '#64748b' }),
        React.createElement('input', {
            'aria-label': placeholder,
            type: 'date',
            value: value || '',
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
            style: inputStyle,
        }),
        value && onClear
            ? React.createElement(
                'button',
                {
                    'aria-label': 'Clear date',
                    type: 'button',
                    onClick: onClear,
                    style: clearButtonStyle,
                },
                React.createElement(MaterialIcons, { name: 'close', size: 18, color: '#94a3b8' })
            )
            : null
    );
};

export default DatePicker;
