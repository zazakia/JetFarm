import { getRuntimeSupabaseUrl } from '../supabaseUrl';

describe('getRuntimeSupabaseUrl', () => {
    it('routes host localhost Supabase URLs through the Android emulator gateway', () => {
        expect(getRuntimeSupabaseUrl('http://127.0.0.1:45421', 'android')).toBe('http://10.0.2.2:45421');
        expect(getRuntimeSupabaseUrl('http://localhost:45421', 'android')).toBe('http://10.0.2.2:45421');
    });

    it('leaves remote Supabase URLs unchanged on Android', () => {
        const url = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
        expect(getRuntimeSupabaseUrl(url, 'android')).toBe(url);
    });

    it('leaves local URLs unchanged outside Android', () => {
        expect(getRuntimeSupabaseUrl('http://127.0.0.1:45421', 'web')).toBe('http://127.0.0.1:45421');
        expect(getRuntimeSupabaseUrl('http://localhost:45421', 'ios')).toBe('http://localhost:45421');
    });
});
