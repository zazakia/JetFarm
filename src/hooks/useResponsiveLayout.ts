import { useWindowDimensions } from 'react-native';
import {
    getResponsiveTokens,
    getPageContentStyle,
    ResponsiveTokens,
} from '../utils/responsiveLayout';

/**
 * Window dimensions are already reactive in React Native, so the tokens
 * recompute on rotation and on a browser resize without extra listeners.
 */
export function useResponsiveLayout(): ResponsiveTokens {
    const { width, height } = useWindowDimensions();
    return getResponsiveTokens(width, height);
}

/**
 * contentContainerStyle for a page ScrollView, sized to the current viewport.
 * Screens use this as a prop value, so it stays in the component body scope.
 */
export function usePageContentStyle(
    extra?: Record<string, number | string>,
): Record<string, number | string> {
    return getPageContentStyle(useResponsiveLayout(), extra);
}

export default useResponsiveLayout;
