import React from 'react';
import { render } from '@testing-library/react-native';
import { CalculationBasisCard } from '../CalculationBasisCard';

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

describe('CalculationBasisCard', () => {
    it('renders with default flat interest formulas', () => {
        const { getByText } = render(<CalculationBasisCard interestType="flat" />);

        expect(getByText('Calculation Basis')).toBeTruthy();
        expect(getByText('Principal × (Rate / 100)')).toBeTruthy(); // flat interest formula
        expect(getByText('Principal + Total Interest + Total Savings + Total Insurance')).toBeTruthy(); // total loan
        expect(getByText('Total Loan / Number of Payments')).toBeTruthy(); // installment
        expect(getByText('Principal - Previous Loan Balance (if renewal)')).toBeTruthy(); // net release
    });

    it('renders with diminishing interest formulas', () => {
        const { getByText } = render(<CalculationBasisCard interestType="diminishing" />);

        expect(getByText('Calculation Basis')).toBeTruthy();
        expect(getByText('Reducing Balance Calculation based on Annual Rate')).toBeTruthy(); // diminishing interest formula
    });

    it('allows customizing the title', () => {
        const { getByText } = render(<CalculationBasisCard title="Custom Formula Title" />);
        expect(getByText('Custom Formula Title')).toBeTruthy();
    });
});

