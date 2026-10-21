/**
 * Dynamic and Flexible Search Engine for Agri-One
 *
 * Provides multi-token, accent-insensitive, weighted-field searching,
 * dynamic field filtering, relevance scoring, and match highlighting.
 */

export type SearchKeyExtractor<T> = (item: T) => string | number | boolean | null | undefined | Array<string | number>;

export interface WeightedSearchKey<T> {
    key: keyof T | string | SearchKeyExtractor<T>;
    weight?: number; // Defaults to 1. Higher weight boosts relevance score.
}

export type SearchKey<T> = keyof T | string | SearchKeyExtractor<T> | WeightedSearchKey<T>;

export type FilterOperator = 'equals' | 'in' | 'contains' | 'gte' | 'lte' | 'between';

export interface FilterCondition<T = any> {
    field?: keyof T | string | ((item: T) => any);
    operator?: FilterOperator;
    value?: any;
    predicate?: (item: T) => boolean;
}

export interface FlexibleSearchOptions<T> {
    keys: SearchKey<T>[];
    matchMode?: 'all' | 'any'; // 'all' requires every query token to match; 'any' requires at least one
    threshold?: number; // Minimum relevance score to include (default: 1)
    caseSensitive?: boolean; // Default false
    filters?: FilterCondition<T>[] | Record<string, any>;
    limit?: number;
    sortBy?: 'relevance' | 'none';
}

export interface FlexibleSearchResult<T> {
    item: T;
    score: number;
    matchedTokens: string[];
}

/**
 * Normalizes text for matching: strips diacritics/accents, trims whitespace,
 * and converts to lower case if not case-sensitive.
 */
export function normalizeSearchString(text: string | null | undefined, caseSensitive = false): string {
    if (text === null || text === undefined) return '';
    const str = String(text).trim();
    // Strip diacritics (e.g., 'José' -> 'Jose')
    const unaccented = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return caseSensitive ? unaccented : unaccented.toLowerCase();
}

/**
 * Safely extracts a value from an object given a key, dot-path ('contact.phone'),
 * or extractor function.
 */
export function extractSearchValue<T>(item: T, key: keyof T | string | SearchKeyExtractor<T>): string[] {
    if (!item) return [];

    if (typeof key === 'function') {
        try {
            const result = key(item);
            if (Array.isArray(result)) {
                return result.filter(v => v !== null && v !== undefined).map(String);
            }
            return result !== null && result !== undefined ? [String(result)] : [];
        } catch {
            return [];
        }
    }

    const keyStr = String(key);
    // Handle nested dot-notation: 'contact.email'
    if (keyStr.includes('.')) {
        const parts = keyStr.split('.');
        let curr: any = item;
        for (const p of parts) {
            if (curr === null || curr === undefined) return [];
            curr = curr[p];
        }
        if (Array.isArray(curr)) {
            return curr.filter(v => v !== null && v !== undefined).map(String);
        }
        return curr !== null && curr !== undefined ? [String(curr)] : [];
    }

    const directVal = (item as any)[keyStr];
    if (Array.isArray(directVal)) {
        return directVal.filter(v => v !== null && v !== undefined).map(String);
    }
    return directVal !== null && directVal !== undefined ? [String(directVal)] : [];
}

/**
 * Escapes regex special characters in a string.
 */
export function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Evaluates whether an item satisfies all specified dynamic filters.
 */
export function evaluateFilters<T>(item: T, filters?: FilterCondition<T>[] | Record<string, any>): boolean {
    if (!filters) return true;

    // Handle plain object format: { status: 'active', department: ['Ops', 'Logistics'] }
    if (!Array.isArray(filters)) {
        for (const [key, filterVal] of Object.entries(filters)) {
            if (filterVal === undefined || filterVal === null || filterVal === 'all') continue;
            const values = extractSearchValue(item, key);
            if (Array.isArray(filterVal)) {
                // Check if any extracted value is in the filter array
                const matches = values.some(v => filterVal.map(String).includes(v));
                if (!matches) return false;
            } else {
                const strFilterVal = String(filterVal).toLowerCase();
                const matches = values.some(v => v.toLowerCase() === strFilterVal);
                if (!matches) return false;
            }
        }
        return true;
    }

    // Handle FilterCondition array
    for (const cond of filters) {
        if (cond.predicate) {
            if (!cond.predicate(item)) return false;
            continue;
        }

        if (!cond.field) continue;
        const extracted = extractSearchValue(item, cond.field as any);
        const op = cond.operator || 'equals';
        const expected = cond.value;

        if (expected === undefined || expected === null || expected === 'all') continue;

        switch (op) {
            case 'equals': {
                const expectedStr = String(expected).toLowerCase();
                if (!extracted.some(v => v.toLowerCase() === expectedStr)) return false;
                break;
            }
            case 'in': {
                const allowedList = Array.isArray(expected) ? expected.map(String) : [String(expected)];
                if (!extracted.some(v => allowedList.includes(v))) return false;
                break;
            }
            case 'contains': {
                const term = String(expected).toLowerCase();
                if (!extracted.some(v => v.toLowerCase().includes(term))) return false;
                break;
            }
            case 'gte': {
                const numExpected = Number(expected);
                const hasGte = extracted.some(v => {
                    const n = Number(v);
                    return !isNaN(n) && n >= numExpected;
                });
                if (!hasGte) return false;
                break;
            }
            case 'lte': {
                const numExpected = Number(expected);
                const hasLte = extracted.some(v => {
                    const n = Number(v);
                    return !isNaN(n) && n <= numExpected;
                });
                if (!hasLte) return false;
                break;
            }
            case 'between': {
                if (Array.isArray(expected) && expected.length === 2) {
                    const [min, max] = expected.map(Number);
                    const hasBetween = extracted.some(v => {
                        const n = Number(v);
                        return !isNaN(n) && n >= min && n <= max;
                    });
                    if (!hasBetween) return false;
                }
                break;
            }
        }
    }

    return true;
}

/**
 * Checks if query characters appear in target in sequence (fuzzy match).
 */
function isSubsequenceMatch(target: string, query: string): boolean {
    if (query.length > target.length) return false;
    let tIdx = 0;
    let qIdx = 0;
    while (tIdx < target.length && qIdx < query.length) {
        if (target[tIdx] === query[qIdx]) {
            qIdx++;
        }
        tIdx++;
    }
    return qIdx === query.length;
}

/**
 * Main flexible search function.
 */
export function flexibleSearch<T>(
    items: T[],
    query: string,
    options: FlexibleSearchOptions<T>
): FlexibleSearchResult<T>[] {
    if (!items || items.length === 0) return [];

    const {
        keys,
        matchMode = 'all',
        threshold = 1,
        caseSensitive = false,
        filters,
        limit,
        sortBy = 'relevance',
    } = options;

    // Normalize weighted search keys
    const normalizedKeys: WeightedSearchKey<T>[] = keys.map(k => {
        if (typeof k === 'object' && k !== null && 'key' in k) {
            return { key: (k as WeightedSearchKey<T>).key, weight: (k as WeightedSearchKey<T>).weight ?? 1 };
        }
        return { key: k as keyof T | string | SearchKeyExtractor<T>, weight: 1 };
    });

    // Clean & normalize query
    const normQuery = normalizeSearchString(query, caseSensitive);
    const tokens = normQuery
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t.length > 0);

    const isQueryEmpty = tokens.length === 0;

    const results: FlexibleSearchResult<T>[] = [];

    for (const item of items) {
        if (!item) continue;

        // Apply dynamic field filters
        if (!evaluateFilters(item, filters)) {
            continue;
        }

        // If query is empty, all filtered items pass with base score
        if (isQueryEmpty) {
            results.push({
                item,
                score: 1,
                matchedTokens: [],
            });
            if (limit && results.length >= limit) {
                break;
            }
            continue;
        }

        // Extract and normalize values for all keys
        const extractedFields: Array<{ raw: string; normalized: string; weight: number }> = [];
        for (const k of normalizedKeys) {
            const values = extractSearchValue(item, k.key);
            for (const v of values) {
                extractedFields.push({
                    raw: v,
                    normalized: normalizeSearchString(v, caseSensitive),
                    weight: k.weight || 1,
                });
            }
        }

        let totalScore = 0;
        const matchedTokens = new Set<string>();

        // 1. Whole Query Scoring bonus
        for (const field of extractedFields) {
            const fNorm = field.normalized;
            if (fNorm === normQuery) {
                totalScore += 100 * field.weight;
            } else if (fNorm.startsWith(normQuery)) {
                totalScore += 70 * field.weight;
            } else if (new RegExp(`(^|\\b)${escapeRegex(normQuery)}`, 'i').test(fNorm)) {
                totalScore += 50 * field.weight;
            } else if (fNorm.includes(normQuery)) {
                totalScore += 30 * field.weight;
            }
        }

        // 2. Token-level matching & scoring
        for (const token of tokens) {
            let tokenMatched = false;
            let bestTokenScore = 0;

            for (const field of extractedFields) {
                const fNorm = field.normalized;
                let tokenFieldScore = 0;

                if (fNorm === token) {
                    tokenFieldScore = 50 * field.weight;
                } else if (fNorm.startsWith(token)) {
                    tokenFieldScore = 35 * field.weight;
                } else if (new RegExp(`(^|\\b)${escapeRegex(token)}`, 'i').test(fNorm)) {
                    tokenFieldScore = 25 * field.weight;
                } else if (fNorm.includes(token)) {
                    tokenFieldScore = 15 * field.weight;
                } else if (isSubsequenceMatch(fNorm, token)) {
                    tokenFieldScore = 5 * field.weight;
                }

                if (tokenFieldScore > 0) {
                    tokenMatched = true;
                    if (tokenFieldScore > bestTokenScore) {
                        bestTokenScore = tokenFieldScore;
                    }
                }
            }

            if (tokenMatched) {
                matchedTokens.add(token);
                totalScore += bestTokenScore;
            }
        }

        // Determine inclusion based on matchMode
        const isMatch =
            matchMode === 'all'
                ? matchedTokens.size === tokens.length
                : matchedTokens.size > 0;

        if (isMatch && totalScore >= threshold) {
            results.push({
                item,
                score: totalScore,
                matchedTokens: Array.from(matchedTokens),
            });
        }
    }

    // Sort by relevance score descending if requested
    if (sortBy === 'relevance' && !isQueryEmpty) {
        results.sort((a, b) => b.score - a.score);
    }

    if (limit && results.length > limit) {
        return results.slice(0, limit);
    }

    return results;
}

/**
 * Splits text into segments indicating whether each part matches the search query.
 * Useful for bolding or highlighting matches in search result items.
 */
export function highlightMatches(
    text: string | null | undefined,
    query: string
): Array<{ text: string; isMatch: boolean }> {
    if (!text) return [];
    if (!query || !query.trim()) {
        return [{ text, isMatch: false }];
    }

    const tokens = query
        .trim()
        .split(/\s+/)
        .map(t => escapeRegex(t.trim()))
        .filter(t => t.length > 0);

    if (tokens.length === 0) {
        return [{ text, isMatch: false }];
    }

    const regex = new RegExp(`(${tokens.join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts
        .filter(part => part.length > 0)
        .map(part => ({
            text: part,
            isMatch: regex.test(part),
        }));
}
