/**
 * Detect local/preview web E2E hosts where mock auth + mock sync are allowed.
 * Playwright exports set EXPO_PUBLIC_E2E_MODE=1 so detection is not tied to a single port.
 */
export function isLocalWebE2E(): boolean {
    if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_E2E_MODE === '1') {
        return true;
    }
    if (typeof window === 'undefined') return false;

    const hostname = window.location?.hostname?.toLowerCase() || '';
    const port = window.location?.port || '';
    const isE2EPort = port === '19009' || port === '19119';
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isJetfarmPagesHost = hostname === 'jetfarm.pages.dev' || hostname.endsWith('.jetfarm.pages.dev');
    const isJetfarmNetlifyHost = hostname === 'jetfarm.netlify.app' || hostname.endsWith('.jetfarm.netlify.app');
    const isPagesDev = hostname.endsWith('.pages.dev') && !isJetfarmPagesHost;
    const isNetlify = hostname.endsWith('.netlify.app') && !isJetfarmNetlifyHost;

    return (isLocalhost && isE2EPort) || isPagesDev || isNetlify;
}
