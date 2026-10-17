import React from 'react';
import { render } from '@testing-library/react-native';
import { ParcelMap } from '../ParcelMap';

// The WebView is a native module with no Jest harness; the container sizing is
// what is under test here.
jest.mock('react-native-webview', () => {
    const ReactNative = require('react-native');
    const ReactLib = require('react');
    return {
        WebView: (props: any) =>
            ReactLib.createElement(ReactNative.View, { testID: props.testID }),
    };
});

const mockTokens = {
    pagePadding: 12,
    contentMaxWidth: Number.POSITIVE_INFINITY,
    bodyColumns: 1 as const,
    mapHeight: 288,
    kpiCardMinWidth: 140,
    isTabletOrLarger: false,
    isDesktopOrLarger: false,
};

jest.mock('../../../hooks/useResponsiveLayout', () => ({
    useResponsiveLayout: () => mockTokens,
}));

describe('ParcelMap sizing', () => {
    it('sizes the map from the viewport when no height is given', () => {
        const { getByTestId } = render(
            <ParcelMap coordinates={[]} onChange={() => {}} />
        );
        expect(getByTestId('parcel-map-container')).toHaveStyle({ height: 288 });
    });

    it('still honours an explicit height override', () => {
        const { getByTestId } = render(
            <ParcelMap coordinates={[]} onChange={() => {}} height={400} />
        );
        expect(getByTestId('parcel-map-container')).toHaveStyle({ height: 400 });
    });

    it('fills the width of its container', () => {
        const { getByTestId } = render(
            <ParcelMap coordinates={[]} onChange={() => {}} />
        );
        expect(getByTestId('parcel-map-container')).toHaveStyle({ width: '100%' });
    });
});
