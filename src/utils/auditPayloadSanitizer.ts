/**
 * Keeps audit / sync payloads small by redacting base64 blobs and truncating
 * oversized strings before they are persisted or pushed to Supabase.
 */

export const MAX_AUDIT_STRING_CHARS = 2000;
export const MAX_AUDIT_PAYLOAD_CHARS = 8000;

const BASE64_DATA_URI = /^data:[^;]+;base64,/i;
const BULKY_SETTING_KEYS = new Set(['brand.logo_base64', 'logo_base64']);

function omittedMarker(kind: string, length: number): string {
    return `[omitted:${kind}:${length} chars]`;
}

function sanitizeString(value: string, keyHint?: string): string {
    if (BASE64_DATA_URI.test(value)) {
        return omittedMarker('base64', value.length);
    }

    const key = (keyHint || '').toLowerCase();
    if (
        (key.includes('logo') && value.length > 256) ||
        (BULKY_SETTING_KEYS.has(key) && value.length > 256)
    ) {
        return omittedMarker('large', value.length);
    }

    if (value.length > MAX_AUDIT_STRING_CHARS) {
        return `${value.slice(0, MAX_AUDIT_STRING_CHARS)}...[truncated:${value.length} chars]`;
    }

    return value;
}

function sanitizeValue(value: unknown, keyHint?: string, depth = 0): unknown {
    if (value == null) return value;
    if (depth > 6) return '[omitted:max-depth]';

    if (typeof value === 'string') {
        return sanitizeString(value, keyHint);
    }

    if (Array.isArray(value)) {
        return value.map((item, index) => sanitizeValue(item, `${keyHint || 'item'}[${index}]`, depth + 1));
    }

    if (typeof value === 'object') {
        const input = value as Record<string, unknown>;
        const output: Record<string, unknown> = {};
        const nestedKeyHint =
            typeof input.key === 'string' ? input.key : keyHint;

        for (const [key, nested] of Object.entries(input)) {
            // When sanitizing an app_settings-shaped object, prefer the setting key
            // for the `value` field so logo blobs are redacted even without a data URI.
            const childHint = key === 'value' && nestedKeyHint ? nestedKeyHint : key;
            output[key] = sanitizeValue(nested, childHint, depth + 1);
        }
        return output;
    }

    return value;
}

export function sanitizeAuditPayload(payload: unknown): unknown {
    if (payload == null) return payload;
    return sanitizeValue(payload);
}

export function sanitizeAuditJsonString(raw: unknown): string {
    if (raw == null || raw === '') return '';

    if (typeof raw !== 'string') {
        try {
            return sanitizeAuditJsonString(JSON.stringify(sanitizeAuditPayload(raw)));
        } catch {
            return omittedMarker('unserializable', 0);
        }
    }

    try {
        const parsed = JSON.parse(raw);
        const sanitized = sanitizeAuditPayload(parsed);
        let encoded = JSON.stringify(sanitized);
        if (encoded.length > MAX_AUDIT_PAYLOAD_CHARS) {
            encoded = `${encoded.slice(0, MAX_AUDIT_PAYLOAD_CHARS)}...[truncated:${encoded.length} chars]`;
        }
        return encoded;
    } catch {
        return sanitizeString(raw);
    }
}

export const LOCAL_ONLY_APP_SETTING_KEYS = new Set(['brand.logo_base64']);

export function isLocalOnlyAppSettingKey(key: string | null | undefined): boolean {
    return !!key && LOCAL_ONLY_APP_SETTING_KEYS.has(key);
}

export function stripLocalOnlySettingValue(key: string | null | undefined, value: unknown): string {
    if (isLocalOnlyAppSettingKey(key)) return '';
    if (value == null) return '';
    if (typeof value !== 'string') return String(value);
    if (BASE64_DATA_URI.test(value) && value.length > 256) return '';
    return value;
}
