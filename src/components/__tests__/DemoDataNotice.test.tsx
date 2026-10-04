import React from 'react';
import { render } from '@testing-library/react-native';
import { DemoDataNotice } from '../DemoDataNotice';

describe('DemoDataNotice', () => {
    it('states plainly that the console is not backed by the database', () => {
        const { getByTestId, getByText } = render(<DemoDataNotice moduleName="Agri-Store" />);

        expect(getByTestId('demo-notice')).toBeDefined();
        expect(getByText(/Agri-Store is a preview console/i)).toBeDefined();
        expect(getByText(/nothing is saved/i)).toBeDefined();
    });

    it('names what the reader should not trust', () => {
        const { getByText } = render(<DemoDataNotice moduleName="Transport Fleet" whatShowsNumbers />);

        expect(getByText(/figures on this page are sample data/i)).toBeDefined();
        expect(getByText(/not post to the ledger/i)).toBeDefined();
    });
});
