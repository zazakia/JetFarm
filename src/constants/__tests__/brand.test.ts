import { COMPANY_NAME, COMPANY_NAME_FULL, COMPANY_PRODUCT_NAME, COMPANY_EMAIL_PLACEHOLDER, setBrandData } from '../brand';
import { logoBase64, setLogoBase64 } from '../../utils/logoBase64';

describe('Brand Constants and Live Bindings', () => {
    it('has correct default constants', () => {
        expect(COMPANY_NAME).toBe('JetFarm');
        expect(COMPANY_NAME_FULL).toBe('JetFarm');
        expect(COMPANY_PRODUCT_NAME).toBe('JetFarm LMS');
        expect(COMPANY_EMAIL_PLACEHOLDER).toBe('user@jetfarm.com');
    });

    it('updates brand constants dynamically', () => {
        setBrandData('TestCoop', 'TestCoop Multi-Purpose Cooperative');
        expect(COMPANY_NAME).toBe('TestCoop');
        expect(COMPANY_NAME_FULL).toBe('TestCoop Multi-Purpose Cooperative');
        expect(COMPANY_PRODUCT_NAME).toBe('TestCoop LMS');
        expect(COMPANY_EMAIL_PLACEHOLDER).toBe('user@testcoop.com');

        // Restore default for other tests
        setBrandData('JetFarm', 'JetFarm');
    });

    it('updates logoBase64 dynamically', () => {
        const originalLogo = logoBase64;
        setLogoBase64('data:image/png;base64,newlogo');
        expect(logoBase64).toBe('data:image/png;base64,newlogo');
        
        // Restore default
        setLogoBase64(originalLogo);
    });
});
