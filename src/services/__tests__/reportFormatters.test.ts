import { escapeHtml, reportDate, money, simpleReportHtml } from '../reportFormatters';

jest.mock('../../utils/currency', () => ({
    formatPHP: jest.fn((value) => `PHP ${value}`),
}));

describe('reportFormatters', () => {
    describe('escapeHtml', () => {
        it('escapes special HTML characters', () => {
            expect(escapeHtml('Hello & <World> "World" \'World\'')).toBe('Hello &amp; &lt;World&gt; &quot;World&quot; &#39;World&#39;');
        });

        it('returns empty string for null or undefined', () => {
            expect(escapeHtml(null)).toBe('');
            expect(escapeHtml(undefined)).toBe('');
        });

        it('handles numbers correctly', () => {
            expect(escapeHtml(123)).toBe('123');
        });
    });

    describe('reportDate', () => {
        it('formats Date or timestamp correctly', () => {
            const date = new Date('2026-03-20');
            expect(reportDate(date)).toBe('20-Mar-2026');
            expect(reportDate(date.getTime())).toBe('20-Mar-2026');
        });

        it('returns empty string for null or undefined', () => {
            expect(reportDate(null)).toBe('');
            expect(reportDate(undefined)).toBe('');
        });
    });

    describe('money', () => {
        it('formats money correctly', () => {
            expect(money(1500)).toBe('PHP 1500');
        });

        it('defaults to 0 if falsy', () => {
            expect(money(undefined)).toBe('PHP 0');
            expect(money(null)).toBe('PHP 0');
        });
    });

    describe('simpleReportHtml', () => {
        it('builds basic html document without totals', () => {
            const html = simpleReportHtml('My Title', 'My Subtitle', '<table></table>');
            expect(html).toContain('<h1>My Title</h1>');
            expect(html).toContain('My Subtitle');
            expect(html).toContain('<table></table>');
            expect(html).not.toContain('class="totals"');
        });

        it('builds html document with totals if provided', () => {
            const html = simpleReportHtml('My Title', 'My Subtitle', '<table></table>', 'Total: 100');
            expect(html).toContain('class="totals"');
            expect(html).toContain('Total: 100');
        });
    });
});
