import { format } from 'date-fns';
import { formatPHP } from '../utils/currency';

export const escapeHtml = (value: string | number | undefined | null) =>
    String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[char] || char));

export const reportDate = (value: Date | number | undefined | null) => {
    if (!value) return '';
    return format(new Date(value), 'd-MMM-yyyy');
};

export const money = (value: number | undefined | null) => formatPHP(value || 0);

export function simpleReportHtml(title: string, subtitle: string, tableHtml: string, totalsHtml = '') {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
@page { size: A4 landscape; margin: 10mm; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111827; }
h1 { margin: 0; font-size: 18px; text-align: center; }
.subtitle { text-align: center; margin: 4px 0 12px; color: #475569; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #cbd5e1; padding: 5px 6px; vertical-align: top; }
th { background: #e2e8f0; text-transform: uppercase; font-size: 8px; letter-spacing: .4px; }
td.amount, th.amount { text-align: right; white-space: nowrap; }
tfoot td { font-weight: 800; background: #f8fafc; }
.totals { margin-top: 10px; font-weight: 800; }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<div class="subtitle">${escapeHtml(subtitle)}</div>
${tableHtml}
${totalsHtml ? `<div class="totals">${totalsHtml}</div>` : ''}
</body></html>`;
}

