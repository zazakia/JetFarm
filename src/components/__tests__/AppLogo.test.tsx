import React from 'react';
import { render } from '@testing-library/react-native';
import { AppLogo } from '../AppLogo';
import { getAppVersion } from '../../constants/AppVersion';

describe('AppLogo Component', () => {
    it('renders company name and version badge by default', () => {
        const { getByText, getByTestId } = render(<AppLogo />);
        expect(getByText('JetFarm')).toBeTruthy();
        expect(getByTestId('app-logo-version-badge')).toBeTruthy();
        expect(getByText(`v${getAppVersion()}`)).toBeTruthy();
    });

    it('can hide version badge when showVersion is false', () => {
        const { getByText, queryByTestId } = render(<AppLogo showVersion={false} />);
        expect(getByText('JetFarm')).toBeTruthy();
        expect(queryByTestId('app-logo-version-badge')).toBeNull();
    });

    it('renders subtitle when provided', () => {
        const { getByText } = render(<AppLogo subtitle="Agri Operations" />);
        expect(getByText('Agri Operations')).toBeTruthy();
    });
});
