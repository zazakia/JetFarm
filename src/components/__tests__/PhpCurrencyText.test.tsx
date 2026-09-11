import React from 'react';
import { render } from '@testing-library/react-native';
import { PhpCurrencyText } from '../PhpCurrencyText';

// Mock formatPHP from the currency util to ensure isolation
jest.mock('../../utils/currency', () => ({
  formatPHP: jest.fn().mockImplementation((val) => `PHP ${val}`)
}));

describe('PhpCurrencyText Component', () => {
  it('renders correctly with given amount', () => {
    const { getByText } = render(
      <PhpCurrencyText amount={1500} style={{ color: 'red' }} className="test-class" />
    );

    // Should call formatPHP and display the result
    expect(getByText('PHP 1500')).toBeTruthy();
  });

  it('renders correctly when amount is null', () => {
    const { getByText } = render(
      <PhpCurrencyText amount={null} />
    );

    // Should call formatPHP and display the result
    expect(getByText('PHP null')).toBeTruthy();
  });
});
