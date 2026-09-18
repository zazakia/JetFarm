import { isProductionSupabaseUrl } from '../supabaseSafety';

describe('Supabase production safety', () => {
    it('does not treat placeholder or empty URLs as production by default', () => {
        expect(isProductionSupabaseUrl('https://example.supabase.co')).toBe(false);
        expect(isProductionSupabaseUrl('http://127.0.0.1:45421')).toBe(false);
        expect(isProductionSupabaseUrl('http://10.0.2.2:45421')).toBe(false);
        expect(isProductionSupabaseUrl('')).toBe(false);
    });

    it('correctly identifies production Supabase URL and isolates staging URL', () => {
        expect(isProductionSupabaseUrl('https://jetfarm-placeholder-db.supabase.co')).toBe(true);
        expect(isProductionSupabaseUrl('https://jetfarm-placeholder-db.supabase.co/')).toBe(true);
        // Staging DB must not be classified as production
        expect(isProductionSupabaseUrl('https://zsrglwrscdxtyxyyyhwd.supabase.co')).toBe(false);
    });
});
