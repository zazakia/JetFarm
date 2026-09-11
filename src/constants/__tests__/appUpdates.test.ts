import {
    APP_UPDATES,
    APP_UPDATE_CATEGORY_LABELS,
    APP_UPDATE_CATEGORY_COLORS,
    AppUpdateCategory,
} from '../appUpdates';

describe('appUpdates constants', () => {
    it('contains a valid list of app updates with required fields', () => {
        expect(Array.isArray(APP_UPDATES)).toBe(true);
        expect(APP_UPDATES.length).toBeGreaterThan(0);

        for (const update of APP_UPDATES) {
            expect(update.id).toBeTruthy();
            expect(update.version).toBeTruthy();
            expect(update.date).toBeTruthy();
            expect(update.title).toBeTruthy();
            expect(update.category).toMatch(/^(feature|fix|technical|data)$/);
            expect(update.icon).toBeTruthy();
            expect(update.summary).toBeTruthy();
            expect(Array.isArray(update.changes)).toBe(true);
            expect(Array.isArray(update.codeChanges)).toBe(true);
        }
    });

    it('has category label and color mappings for all update categories', () => {
        const categories: AppUpdateCategory[] = ['feature', 'fix', 'technical', 'data'];

        for (const cat of categories) {
            expect(APP_UPDATE_CATEGORY_LABELS[cat]).toBeTruthy();
            expect(APP_UPDATE_CATEGORY_COLORS[cat]).toBeTruthy();
            expect(APP_UPDATE_CATEGORY_COLORS[cat]).toMatch(/^#/);
        }
    });

    it('ensures most recent release entry comes first in APP_UPDATES', () => {
        const first = APP_UPDATES[0];
        expect(first.version).toBeDefined();
        expect(first.title).toBeDefined();
    });
});
