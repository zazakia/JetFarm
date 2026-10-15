import { flexibleSearch, highlightMatches } from '../flexibleSearch';

describe('flexibleSearch utility', () => {
    interface SamplePerson {
        id: string;
        name: string;
        role: string;
        department: string;
        salary: number;
        status: 'active' | 'inactive';
        contact?: {
            email: string;
            phone: string;
        };
        tags?: string[];
    }

    const testData: SamplePerson[] = [
        {
            id: '1',
            name: 'Maria Santos',
            role: 'Farm Manager',
            department: 'Operations',
            salary: 35000,
            status: 'active',
            contact: { email: 'maria@jetfarm.ph', phone: '09171234567' },
            tags: ['cassava', 'harvest', 'lead'],
        },
        {
            id: '2',
            name: 'Juan Dela Cruz',
            role: 'Agronomist',
            department: 'Research',
            salary: 42000,
            status: 'active',
            contact: { email: 'juan@jetfarm.ph', phone: '09189876543' },
            tags: ['soil', 'crop', 'expert'],
        },
        {
            id: '3',
            name: 'José Peña',
            role: 'Field Worker',
            department: 'Operations',
            salary: 18000,
            status: 'inactive',
            contact: { email: 'jose@jetfarm.ph', phone: '09205556677' },
            tags: ['labor', 'planting'],
        },
        {
            id: '4',
            name: 'Mariano Rivera',
            role: 'Warehouse Officer',
            department: 'Logistics',
            salary: 28000,
            status: 'active',
            tags: ['inventory', 'dispatch'],
        },
    ];

    describe('Multi-token matching', () => {
        it('matches items across different fields with multiple tokens', () => {
            const results = flexibleSearch(testData, 'maria operations', {
                keys: ['name', 'role', 'department'],
            });
            expect(results.length).toBe(1);
            expect(results[0].item.id).toBe('1');
        });

        it('is order-independent for search tokens', () => {
            const results = flexibleSearch(testData, 'operations maria', {
                keys: ['name', 'department'],
            });
            expect(results.length).toBe(1);
            expect(results[0].item.name).toBe('Maria Santos');
        });

        it('supports any-token matching mode when configured', () => {
            const results = flexibleSearch(testData, 'maria juan', {
                keys: ['name'],
                matchMode: 'any',
            });
            expect(results.length).toBe(3); // Maria Santos, Juan Dela Cruz, Mariano Rivera
        });
    });

    describe('Search keys & property extraction', () => {
        it('supports nested dot-notation paths', () => {
            const results = flexibleSearch(testData, '09189876543', {
                keys: ['name', 'contact.phone'],
            });
            expect(results.length).toBe(1);
            expect(results[0].item.name).toBe('Juan Dela Cruz');
        });

        it('supports custom extractor functions', () => {
            const results = flexibleSearch(testData, 'harvest', {
                keys: [
                    'name',
                    (item: SamplePerson) => item.tags?.join(' ') ?? '',
                ],
            });
            expect(results.length).toBe(1);
            expect(results[0].item.id).toBe('1');
        });

        it('supports weighted keys for ranking', () => {
            const results = flexibleSearch(testData, 'maria', {
                keys: [
                    { key: 'name', weight: 10 },
                    { key: 'contact.email', weight: 1 },
                ],
            });
            // Maria Santos (exact prefix in name with weight 10) > Mariano Rivera (prefix with weight 10)
            expect(results.length).toBeGreaterThanOrEqual(2);
            expect(results[0].item.name).toBe('Maria Santos');
        });
    });

    describe('Accent and Diacritic Normalization', () => {
        it('matches accented names without typing accents', () => {
            const results = flexibleSearch(testData, 'jose pena', {
                keys: ['name'],
            });
            expect(results.length).toBe(1);
            expect(results[0].item.id).toBe('3');
        });

        it('matches unaccented query against accented source and vice versa', () => {
            const results = flexibleSearch(testData, 'José Peña', {
                keys: ['name'],
            });
            expect(results.length).toBe(1);
            expect(results[0].item.name).toBe('José Peña');
        });
    });

    describe('Dynamic Filtering', () => {
        it('filters by key-value object condition', () => {
            const results = flexibleSearch(testData, '', {
                keys: ['name'],
                filters: { status: 'active', department: 'Operations' },
            });
            expect(results.length).toBe(1);
            expect(results[0].item.name).toBe('Maria Santos');
        });

        it('filters by array inclusion', () => {
            const results = flexibleSearch(testData, '', {
                keys: ['name'],
                filters: { department: ['Operations', 'Logistics'] },
            });
            expect(results.length).toBe(3);
        });

        it('filters by FilterCondition with operator and ranges', () => {
            const results = flexibleSearch(testData, '', {
                keys: ['name'],
                filters: [
                    { field: 'salary', operator: 'gte', value: 30000 },
                    { field: 'status', operator: 'equals', value: 'active' },
                ],
            });
            expect(results.length).toBe(2); // Maria (35000), Juan (42000)
            expect(results.map(r => r.item.id)).toEqual(['1', '2']);
        });

        it('combines text query with dynamic filters', () => {
            const results = flexibleSearch(testData, 'operations', {
                keys: ['department'],
                filters: { status: 'inactive' },
            });
            expect(results.length).toBe(1);
            expect(results[0].item.name).toBe('José Peña');
        });
    });

    describe('Scoring and Limits', () => {
        it('scores exact matches higher than substring matches', () => {
            const data = [
                { id: '1', title: 'Loans' },
                { id: '2', title: 'Personal Loans Registry' },
                { id: '3', title: 'Micro Loans' },
            ];
            const results = flexibleSearch(data, 'loans', { keys: ['title'] });
            expect(results[0].item.title).toBe('Loans');
        });

        it('respects limit parameter', () => {
            const results = flexibleSearch(testData, '', {
                keys: ['name'],
                limit: 2,
            });
            expect(results.length).toBe(2);
        });

        it('returns empty array when query does not match', () => {
            const results = flexibleSearch(testData, 'NonExistentTermXYZ', {
                keys: ['name'],
            });
            expect(results.length).toBe(0);
        });

        it('handles special characters and regex symbols safely', () => {
            const specialData = [
                { id: '1', text: 'Cassava Seedlings [Batch #4] (₱25,000.00) + Fertilizer*' },
            ];
            const results = flexibleSearch(specialData, '[Batch #4] (₱25,000.00)', {
                keys: ['text'],
            });
            expect(results.length).toBe(1);
        });
    });

    describe('highlightMatches helper', () => {
        it('splits string into matched and unmatched segments', () => {
            const text = 'Cassava Harvest Terminal';
            const query = 'harvest';
            const segments = highlightMatches(text, query);

            expect(segments).toEqual([
                { text: 'Cassava ', isMatch: false },
                { text: 'Harvest', isMatch: true },
                { text: ' Terminal', isMatch: false },
            ]);
        });

        it('handles multiple tokens in highlightMatches', () => {
            const text = 'Maria Santos Operations Manager';
            const query = 'maria operations';
            const segments = highlightMatches(text, query);

            const matchedTexts = segments.filter(s => s.isMatch).map(s => s.text.toLowerCase());
            expect(matchedTexts).toContain('maria');
            expect(matchedTexts).toContain('operations');
        });
    });
});
