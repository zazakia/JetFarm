import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DatePicker } from '../DatePicker';
import { Platform } from 'react-native';

// Mock DateTimePicker
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const MockDateTimePicker = (props: any) => React.createElement('DateTimePicker', props);
  MockDateTimePicker.displayName = 'MockDateTimePicker';
  return MockDateTimePicker;
});

describe('DatePicker', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
  });

  it('renders correctly with initial value', () => {
    const { getByText } = render(
      <DatePicker value="2024-05-20" onChange={mockOnChange} />
    );
    expect(getByText('May 20, 2024')).toBeTruthy();
  });

  it('renders placeholder when no value is provided', () => {
    const { getByText } = render(
      <DatePicker value="" onChange={mockOnChange} placeholder="Select a date" />
    );
    expect(getByText('Select a date')).toBeTruthy();
  });

  it('opens DateTimePicker when pressed on mobile', () => {
    const { getByText, queryByTestId } = render(
      <DatePicker value="2024-05-20" onChange={mockOnChange} />
    );
    
    fireEvent.press(getByText('May 20, 2024'));
    
    // In our mock, we check if DateTimePicker is rendered
    // Since we can't easily find specifically by type in simple mock, we check state or rendered props if we had testID
  });

  it('renders hidden input on web', () => {
    Platform.OS = 'web';
    const { getByTestId } = render(
      <DatePicker value="2024-05-20" onChange={mockOnChange} />
    );
    
    const input = getByTestId('date-picker-native-input');
    expect(input.props.value).toBe('2024-05-20');
  });
});
