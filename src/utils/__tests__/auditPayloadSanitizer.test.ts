import {
    sanitizeAuditPayload,
    sanitizeAuditJsonString,
    MAX_AUDIT_STRING_CHARS,
} from '../auditPayloadSanitizer';

describe('auditPayloadSanitizer', () => {
    it('redacts data-URI / base64 blobs', () => {
        const logo = `data:image/png;base64,${'A'.repeat(5000)}`;
        const result = sanitizeAuditPayload({
            key: 'brand.logo_base64',
            value: logo,
            amount: 100,
        }) as Record<string, unknown>;

        expect(result.amount).toBe(100);
        expect(String(result.value)).toMatch(/^\[omitted:base64:/);
        expect(String(result.value).length).toBeLessThan(80);
    });

    it('redacts known bulky setting keys even without a data URI prefix', () => {
        const result = sanitizeAuditPayload({
            key: 'brand.logo_base64',
            value: 'x'.repeat(10_000),
        }) as Record<string, unknown>;

        expect(String(result.value)).toMatch(/^\[omitted:large:/);
    });

    it('truncates oversized plain strings', () => {
        const result = sanitizeAuditPayload({
            note: 'n'.repeat(MAX_AUDIT_STRING_CHARS + 500),
        }) as Record<string, unknown>;

        const note = String(result.note);
        expect(note.startsWith('n'.repeat(32))).toBe(true);
        expect(note).toContain('...[truncated:');
        expect(note.length).toBeLessThan(MAX_AUDIT_STRING_CHARS + 40);
    });

    it('sanitizes already-stringified JSON payloads', () => {
        const raw = JSON.stringify({
            key: 'brand.logo_base64',
            value: `data:image/png;base64,${'B'.repeat(8000)}`,
        });
        const sanitized = sanitizeAuditJsonString(raw);
        expect(sanitized).not.toContain('data:image/png;base64,BBB');
        expect(sanitized).toContain('[omitted:base64:');
        expect(sanitized.length).toBeLessThan(raw.length / 10);
    });

    it('returns empty string for nullish input', () => {
        expect(sanitizeAuditJsonString(null)).toBe('');
        expect(sanitizeAuditJsonString(undefined)).toBe('');
        expect(sanitizeAuditPayload(null)).toBeNull();
    });
});
