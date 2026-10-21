import { COMPANY_NAME, COMPANY_NAME_FULL, COMPANY_PRODUCT_NAME, COMPANY_EMAIL_PLACEHOLDER, setBrandData } from '../brand';
import { logoBase64, setLogoBase64 } from '../../utils/logoBase64';

describe('Brand Constants and Live Bindings', () => {
    it('has correct default constants', () => {
        expect(COMPANY_NAME).toBe('Agri-One');
        expect(COMPANY_NAME_FULL).toBe('Agri-One');
        expect(COMPANY_PRODUCT_NAME).toBe('Agri-One Farm Operations');
        expect(COMPANY_EMAIL_PLACEHOLDER).toBe('user@agri-one.app');
    });

    it('never defaults to the lending-coop or POS brand', () => {
        expect(COMPANY_NAME).not.toMatch(/jetfarm|crispy|pos cursor/i);
        expect(COMPANY_PRODUCT_NAME).not.toMatch(/LMS/);
    });

    it('updates brand constants dynamically', () => {
        setBrandData('TestFarm', 'Test Farm Agribusiness');
        expect(COMPANY_NAME).toBe('TestFarm');
        expect(COMPANY_NAME_FULL).toBe('Test Farm Agribusiness');
        expect(COMPANY_PRODUCT_NAME).toBe('TestFarm Farm Operations');
        expect(COMPANY_EMAIL_PLACEHOLDER).toBe('user@testfarm.app');

        // Restore default for other tests
        setBrandData('Agri-One', 'Agri-One');
    });

    it('updates logoBase64 dynamically', () => {
        const originalLogo = logoBase64;
        setLogoBase64('data:image/png;base64,newlogo');
        expect(logoBase64).toBe('data:image/png;base64,newlogo');
        
        // Restore default
        setLogoBase64(originalLogo);
    });
});
