export const PRODUCTION_SUPABASE_URLS = new Set<string>([
    'https://jetfarm-placeholder-db.supabase.co',
]);

export const normalizeSupabaseUrl = (url: string | undefined | null): string =>
    (url || '').trim().toLowerCase().replace(/\/$/, '');

export const isProductionSupabaseUrl = (url: string | undefined | null): boolean =>
    PRODUCTION_SUPABASE_URLS.has(normalizeSupabaseUrl(url));
