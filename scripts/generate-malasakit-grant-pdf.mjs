import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pdfOutputDir = path.join(rootDir, 'docs', 'pdf');
if (!fs.existsSync(pdfOutputDir)) {
    fs.mkdirSync(pdfOutputDir, { recursive: true });
}

const outputPath = path.join(pdfOutputDir, 'Malasakit_Grant_Accounting_User_Guide.pdf');

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Malasakit Grant Accounting & User Guide Manual</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        @page {
            size: A4;
            margin: 20mm 15mm 20mm 15mm;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            color: #1e293b;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 11pt;
            line-height: 1.6;
        }

        /* Header / Banner */
        .header-container {
            border-bottom: 3px solid #1e3a8a;
            padding-bottom: 15px;
            margin-bottom: 25px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }

        .header-title-area h1 {
            color: #1e3a8a;
            font-size: 22pt;
            font-weight: 800;
            margin: 0 0 6px 0;
            letter-spacing: -0.5px;
            text-transform: uppercase;
        }

        .header-title-area p {
            color: #0284c7;
            font-size: 11pt;
            font-weight: 600;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .meta-badge {
            background-color: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 8px 14px;
            font-size: 9pt;
            color: #475569;
            text-align: right;
            line-height: 1.4;
        }

        .meta-badge strong {
            color: #0f172a;
        }

        h2 {
            color: #1e3a8a;
            font-size: 14pt;
            font-weight: 700;
            border-left: 4px solid #0284c7;
            padding-left: 10px;
            margin-top: 25px;
            margin-bottom: 12px;
            page-break-after: avoid;
        }

        h3 {
            color: #0f172a;
            font-size: 12pt;
            font-weight: 600;
            margin-top: 18px;
            margin-bottom: 8px;
            page-break-after: avoid;
        }

        p, li {
            color: #334155;
            font-size: 10.5pt;
        }

        ul, ol {
            margin-top: 6px;
            margin-bottom: 12px;
            padding-left: 22px;
        }

        li {
            margin-bottom: 4px;
        }

        /* Financial Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 14px 0;
            font-size: 9.5pt;
            page-break-inside: avoid;
        }

        th {
            background-color: #1e3a8a;
            color: #ffffff;
            font-weight: 600;
            text-align: left;
            padding: 8px 12px;
            text-transform: uppercase;
            font-size: 8.5pt;
            letter-spacing: 0.5px;
        }

        td {
            padding: 8px 12px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
        }

        tr:nth-child(even) td {
            background-color: #f8fafc;
        }

        .text-right {
            text-align: right;
        }

        .text-center {
            text-align: center;
        }

        .font-mono {
            font-family: 'Courier New', Courier, monospace;
            font-weight: 600;
        }

        /* Callout Box */
        .callout-box {
            background-color: #f0f9ff;
            border: 1px solid #bae6fd;
            border-left: 4px solid #0284c7;
            border-radius: 6px;
            padding: 12px 16px;
            margin: 16px 0;
            page-break-inside: avoid;
        }

        .callout-title {
            font-weight: 700;
            color: #0369a1;
            font-size: 10.5pt;
            margin-bottom: 4px;
        }

        .callout-body {
            color: #0c4a6e;
            font-size: 9.5pt;
            margin: 0;
        }

        /* Entry Summary Card */
        .journal-card {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            background-color: #ffffff;
            margin: 16px 0;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            page-break-inside: avoid;
        }

        .journal-card-header {
            background-color: #f1f5f9;
            padding: 10px 14px;
            border-bottom: 1px solid #cbd5e1;
            display: flex;
            justify-content: space-between;
            font-weight: 700;
            font-size: 10pt;
            color: #1e3a8a;
        }

        /* Badges */
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 8pt;
            font-weight: 700;
            text-transform: uppercase;
        }

        .badge-asset { background-color: #dcfce7; color: #166534; }
        .badge-income { background-color: #e0f2fe; color: #075985; }
        .badge-equity { background-color: #fef3c7; color: #92400e; }

        .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            font-size: 8pt;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 6px;
            display: flex;
            justify-content: space-between;
        }
    </style>
</head>
<body>

    <div class="header-container">
        <div class="header-title-area">
            <h1>Malasakit Grant Manual</h1>
            <p>POS Cursor / POSCursor Accounting System Guide</p>
        </div>
        <div class="meta-badge">
            <strong>System:</strong> POS Cursor ERP<br>
            <strong>Module:</strong> General Ledger & COA<br>
            <strong>Grant Amount:</strong> ₱100,000.00<br>
            <strong>Date:</strong> August 2026
        </div>
    </div>

    <h2>1. Executive Summary & Purpose</h2>
    <p>
        This user manual provides detailed operational and accounting instructions for encoding a <strong>₱100,000.00 Malasakit Grant / Subsidy</strong> in the <strong>POS Cursor / POSCursor Management System</strong>.
    </p>
    <p>
        The <strong>Malasakit Grant</strong> represents financial aid received from government agencies (e.g., DSWD, DTI, LGU, or CDA) intended for cooperative development, member assistance, or livelihood enhancement. Encoding this transaction correctly ensures full compliance with standard <strong>Cooperative Development Authority (CDA)</strong> financial framework standards.
    </p>

    <h2>2. Accounting Framework & Linking</h2>
    <p>
        Under CDA guidelines for cooperatives (aligned with PFRS for SMEs), grant transactions are recorded using double-entry bookkeeping:
    </p>

    <div class="journal-card">
        <div class="journal-card-header">
            <span>METHOD A: Revenue Recognition (Operational Grant) — Recommended</span>
            <span>Ref: JE-2026-MALASAKIT</span>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Account Title</th>
                    <th>Category</th>
                    <th class="text-right">Debit (₱)</th>
                    <th class="text-right">Credit (₱)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="font-mono">1020</td>
                    <td>Cash in Bank — BDO</td>
                    <td><span class="badge badge-asset">Asset</span></td>
                    <td class="text-right font-mono">100,000.00</td>
                    <td class="text-right font-mono">—</td>
                </tr>
                <tr>
                    <td class="font-mono">4080</td>
                    <td>Grants & Subsidies Income</td>
                    <td><span class="badge badge-income">Income</span></td>
                    <td class="text-right font-mono">—</td>
                    <td class="text-right font-mono">100,000.00</td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="journal-card">
        <div class="journal-card-header">
            <span>METHOD B: Donated Equity / Capital Method (Restricted Fund)</span>
            <span>Ref: JE-2026-MALASAKIT-EQ</span>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Account Title</th>
                    <th>Category</th>
                    <th class="text-right">Debit (₱)</th>
                    <th class="text-right">Credit (₱)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="font-mono">1020</td>
                    <td>Cash in Bank — BDO</td>
                    <td><span class="badge badge-asset">Asset</span></td>
                    <td class="text-right font-mono">100,000.00</td>
                    <td class="text-right font-mono">—</td>
                </tr>
                <tr>
                    <td class="font-mono">3050</td>
                    <td>Optional Fund — Malasakit Grant</td>
                    <td><span class="badge badge-equity">Equity</span></td>
                    <td class="text-right font-mono">—</td>
                    <td class="text-right font-mono">100,000.00</td>
                </tr>
            </tbody>
        </table>
    </div>

    <h2>3. Chart of Accounts (COA) Structure</h2>
    <p>
        The POS Cursor accounting system follows the 4-digit CDA standard account coding structure:
    </p>
    <ul>
        <li><strong>1000–1999 ASSETS:</strong> Debit balance. Account <span class="font-mono">1020</span> (Cash in Bank) or <span class="font-mono">1010</span> (Cash on Hand).</li>
        <li><strong>2000–2999 LIABILITIES:</strong> Credit balance. Payables and member deposits.</li>
        <li><strong>3000–3999 EQUITY:</strong> Credit balance. Share capital, statutory reserves, and optional funds.</li>
        <li><strong>4000–4999 INCOME:</strong> Credit balance. Interest income, service fees, and account <span class="font-mono">4080</span> (Grants & Subsidies Income).</li>
        <li><strong>5000–5999 EXPENSES:</strong> Debit balance. Operating expenses and administrative costs.</li>
    </ul>

    <h2>4. Step-by-Step Encoding Instructions</h2>

    <h3>Step 4.1: Verify & Create Required Account</h3>
    <ol>
        <li>Open POS Cursor app and navigate to <strong>Accounting &rarr; Chart of Accounts</strong> (<span class="font-mono">/accounting/chart-of-accounts</span>).</li>
        <li>Check if account code <span class="font-mono">4080</span> exists. If missing, tap <strong>+ Add Account</strong>.</li>
        <li>Enter details: Code: <span class="font-mono">4080</span>, Name: <span class="font-mono">Grants & Subsidies Income</span>, Type: <span class="font-mono">Income</span>, Normal Balance: <span class="font-mono">Credit</span>, Parent Code: <span class="font-mono">4000</span>.</li>
        <li>Tap <strong>Create Account</strong> to save.</li>
    </ol>

    <h3>Step 4.2: Encode Journal Entry</h3>
    <ol>
        <li>Navigate to <strong>Accounting &rarr; Journal Entries</strong> (<span class="font-mono">/accounting/journal-entries</span>).</li>
        <li>Tap <strong>+ New Journal Entry</strong>.</li>
        <li>Enter Description: <em>"Receipt of Malasakit Grant Funds worth ₱100,000.00 for Cooperative Operations"</em>.</li>
        <li>Add Line 1: Select <span class="font-mono">1020 Cash in Bank — BDO</span> &rarr; Debit: <span class="font-mono">₱100,000.00</span>.</li>
        <li>Add Line 2: Select <span class="font-mono">4080 Grants & Subsidies Income</span> &rarr; Credit: <span class="font-mono">₱100,000.00</span>.</li>
        <li>Confirm Total Debits (₱100,000.00) = Total Credits (₱100,000.00).</li>
        <li>Tap <strong>Post Journal Entry</strong>.</li>
    </ol>

    <div class="callout-box">
        <div class="callout-title">System Rule: Double-Entry Enforcement</div>
        <div class="callout-body">
            The POS Cursor system blocks any journal entry posting where Total Debits do not equal Total Credits exactly. A green balance check banner will confirm when your journal entry is balanced.
        </div>
    </div>

    <h3>Step 4.3: Verify Ledger & Trial Balance</h3>
    <ol>
        <li>Check <strong>General Ledger</strong> (<span class="font-mono">/accounting/general-ledger</span>) for Account 1020 and Account 4080.</li>
        <li>Check <strong>Trial Balance</strong> (<span class="font-mono">/accounting/trial-balance</span>) to confirm balanced trial balance.</li>
        <li>On Accounting Overview, tap <strong>Reconcile DB</strong> to sync WatermelonDB local database with Supabase cloud database.</li>
    </ol>

    <h2>5. System Architecture & Safety Features</h2>
    <ul>
        <li><strong>Immutable Journal Entries:</strong> Posted entries cannot be edited. Corrections require tapping <strong>Post Reversal</strong> in the journal entry view.</li>
        <li><strong>Offline-First Architecture:</strong> Full WatermelonDB offline persistence ensures financial entries can be created without internet connection and automatically synced to Supabase when connected.</li>
        <li><strong>Deterministic UUIDs:</strong> Chart of Accounts IDs are deterministically generated to prevent duplication across distributed offline devices.</li>
    </ul>

</body>
</html>
`;

async function main() {
    console.log('Launching browser to render PDF...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setContent(htmlContent, { waitUntil: 'networkidle' });
    
    console.log(`Generating PDF at ${outputPath}...`);
    await page.pdf({
        path: outputPath,
        format: 'A4',
        margin: {
            top: '15mm',
            bottom: '15mm',
            left: '15mm',
            right: '15mm',
        },
        printBackground: true,
    });

    await browser.close();
    console.log('PDF generation complete!');
}

main().catch(err => {
    console.error('Failed to generate PDF:', err);
    process.exit(1);
});
