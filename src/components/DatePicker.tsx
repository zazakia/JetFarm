import React, { useState, useRef } from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { format, isValid, parseISO } from 'date-fns';

interface DatePickerProps {
    value: string; // YYYY-MM-DD
    onChange: (date: string) => void;
    placeholder?: string;
    onClear?: () => void;
}

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, placeholder = "Select Date", onClear }) => {
    const [show, setShow] = useState(false);
    const webInputRef = useRef<any>(null);
    
    // Parse the value carefully
    let dateValue = new Date();
    if (value) {
        const parsed = parseISO(value);
        if (isValid(parsed)) {
            dateValue = parsed;
        }
    }

    const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShow(false);
        }
        
        if (event.type === 'set' && selectedDate) {
            onChange(format(selectedDate, 'yyyy-MM-dd'));
        } else if (event.type === 'dismissed') {
            setShow(false);
        }
    };

    const handlePress = () => {
        if (Platform.OS === 'web') {
            // On web, we use the hidden native input
            if (webInputRef.current) {
                webInputRef.current.showPicker?.() || webInputRef.current.click();
            }
        } else {
            setShow(true);
        }
    };

    const containerStyle = {};
    
    return (
        <View style={containerStyle} testID="date-picker-container">
            <Pressable
                onPress={handlePress}
                testID="date-picker-button"
                className="flex-row items-center bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm active:bg-gray-50"
            >
                <MaterialIcons name="calendar-today" size={18} color="#64748b" />
                <Text 
                    testID="date-picker-display-text"
                    className={`flex-1 ml-2 text-sm font-medium ${value ? 'text-gray-900' : 'text-gray-700'}`}
                >
                    {value && isValid(parseISO(value)) ? format(parseISO(value), 'MMM d, yyyy') : placeholder}
                </Text>
                {value && onClear && (
                    <Pressable onPress={(e) => {
                        e.stopPropagation();
                        onClear();
                    }}>
                        <MaterialIcons name="close" size={18} color="#94a3b8" />
                    </Pressable>
                )}
            </Pressable>
            
            {Platform.OS === 'web' && (
                <input
                    type="date"
                    {...({ testID: 'date-picker-native-input' } as any)}
                    ref={webInputRef}
                    value={value || ''}
                    onChange={(e) => {
                        onChange(e.target.value);
                    }}
                    style={webInputStyle as any}
                />
            )}

            {show && Platform.OS !== 'web' && (
                <DateTimePicker
                    value={dateValue}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    webInput: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity: 0,
        cursor: 'pointer',
        zIndex: 1,
        borderWidth: 0,
        padding: 0,
        margin: 0,
    }
});

// For native HTML tags on web, we need a plain object
const webInputStyle = Platform.OS === 'web' ? {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
    zIndex: 1,
    borderWidth: 0,
    padding: 0,
    margin: 0,
} : {};

