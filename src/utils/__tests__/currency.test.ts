import { formatPHP, parsePHP, formatPHPCompact, coerceMoneyAmount } from '../currency';

describe('currency utility', () => {
  describe('coerceMoneyAmount', () => {
    it('handles numbers', () => {
      expect(coerceMoneyAmount(123.45)).toBe(123.45);
    });
    it('handles numeric strings', () => {
      expect(coerceMoneyAmount('123.45')).toBe(123.45);
    });
    it('handles null and undefined', () => {
      expect(coerceMoneyAmount(null)).toBe(0);
      expect(coerceMoneyAmount(undefined)).toBe(0);
    });
    it('handles invalid strings and objects', () => {
      expect(coerceMoneyAmount('invalid')).toBe(0);
      expect(coerceMoneyAmount({})).toBe(0);
    });
  });

  describe('formatPHP', () => {
    it('formats a number as PHP currency', () => {
      const result = formatPHP(1500);
      expect(result).toContain('1,500.00');
      expect(result).toMatch(/[PH]/);
    });

    it('handles null, undefined, NaN', () => {
      expect(formatPHP(null)).toBe('PHP 0.00');
      expect(formatPHP(undefined)).toBe('PHP 0.00');
      expect(formatPHP(NaN)).toBe('PHP 0.00');
    });
  });

  describe('parsePHP', () => {
    it('parses currency string to number', () => {
      expect(parsePHP('PHP 1,500.00')).toBe(1500);
      expect(parsePHP('1500')).toBe(1500);
      expect(parsePHP('PHP 1,234.56')).toBe(1234.56);
    });

    it('handles empty or invalid strings', () => {
      expect(parsePHP('')).toBe(0);
      expect(parsePHP('invalid')).toBe(0);
    });
  });

  describe('formatPHPCompact', () => {
    it('formats millions', () => {
      expect(formatPHPCompact(1500000)).toBe('PHP 1.5M');
    });

    it('formats numbers in the thousands with K suffix', () => {
      expect(formatPHPCompact(15000)).toBe('PHP 15.0K');
    });
    it('formats small numbers normally', () => {
      expect(formatPHPCompact(500)).toContain('500.00');
    });
  });

  describe('Gate G-10: 10,000 Iteration Math Precision & Fuzzing Invariant', () => {
    it('passes 10,000 random currency calculations without NaN, Infinity, or rounding drift', () => {
      for (let i = 0; i < 10_000; i++) {
        const a = Math.random() * 10_000;
        const b = Math.random() * 10_000;
        const sum = a + b;
        const formatted = formatPHP(sum);
        expect(formatted).toMatch(/^PHP\s+[\d,]+\.\d{2}$/);
        expect(formatted).not.toContain('NaN');
        expect(formatted).not.toContain('Infinity');

        // Verify parse round-trip within floating-point tolerance
        const parsed = parsePHP(formatted);
        expect(Math.abs(parsed - Math.round(sum * 100) / 100)).toBeLessThanOrEqual(0.01);
      }
    });

    it('guards against float addition drift e.g. 0.1 + 0.2', () => {
      const result = formatPHP(0.1 + 0.2);
      expect(result).toBe('PHP 0.30');
    });

    it('handles extreme edge values without crashing', () => {
      expect(formatPHP(0)).toBe('PHP 0.00');
      expect(formatPHP(-0)).toBe('PHP 0.00');
      expect(formatPHP(Number.MAX_SAFE_INTEGER)).not.toContain('NaN');
      expect(formatPHP(-1234.56)).toContain('1,234.56');
    });
  });
});
