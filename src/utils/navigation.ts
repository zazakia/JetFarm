import { Router } from 'expo-router';

/**
 * Safely navigates back if there is history, otherwise goes to a fallback route.
 * This prevents the "GO_BACK" action error in Expo Router.
 * 
 * @param router - The router instance from useRouter()
 * @param fallback - The fallback route to navigate to if no history exists (e.g., '/(collector)')
 */
export const safeBack = (router: Router, fallback: string) => {
    if (router.canGoBack()) {
        router.back();
    } else {
        console.warn(`[Navigation] No history for back action, using fallback: ${fallback}`);
        router.replace(fallback as any);
    }
};
