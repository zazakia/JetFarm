const fs = require('fs');
const path = require('path');

const mdPath = path.join(__dirname, '../docs/user_manual.md');
const htmlPath = path.join(__dirname, '../docs/user_manual.html');

if (!fs.existsSync(mdPath)) {
    console.error('Source markdown file does not exist at ' + mdPath);
    process.exit(1);
}

const mdContent = fs.readFileSync(mdPath, 'utf8');
const lines = mdContent.split(/\r?\n/);

let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>POS Cursor-CCF Savings and Credit Cooperative LMS User Manual</title>
<style>
    body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 40px;
    }
    h1 {
        color: #1e3a8a;
        border-bottom: 2px solid #1e3a8a;
        padding-bottom: 10px;
        margin-top: 30px;
    }
    h2 {
        color: #0d9488;
        border-bottom: 1px solid #ddd;
        padding-bottom: 5px;
        margin-top: 25px;
    }
    h3 {
        color: #b45309;
        margin-top: 20px;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
    }
    th, td {
        border: 1px solid #ddd;
        padding: 10px;
        text-align: left;
    }
    th {
        background-color: #f3f4f6;
        font-weight: bold;
    }
    code {
        font-family: Consolas, monospace;
        background-color: #f3f4f6;
        padding: 2px 4px;
        border-radius: 4px;
        font-size: 0.9em;
    }
    pre {
        background-color: #f3f4f6;
        padding: 15px;
        border-left: 4px solid #1e3a8a;
        overflow-x: auto;
    }
    pre code {
        padding: 0;
        background-color: transparent;
        font-size: 1em;
    }
    blockquote {
        border-left: 4px solid #d97706;
        background-color: #fffbeb;
        padding: 15px;
        margin: 20px 0;
    }
    ul, ol {
        margin-bottom: 20px;
        padding-left: 25px;
    }
    li {
        margin-bottom: 5px;
    }
    hr {
        border: 0;
        border-top: 1px solid #ccc;
        margin: 30px 0;
    }
</style>
</head>
<body>
`;

let inList = false;
let inTable = false;
let inPre = false;
let listType = ''; // 'ul' or 'ol'
let tableHeaderSeen = false;

function parseInline(text) {
    // Escape simple HTML chars first (except we might generate some tags)
    let safe = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Restoring some elements or handling tags
    // Bold: **text**
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Inline code: `code`
    safe = safe.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Links: [text](link)
    safe = safe.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

    // PHP symbol formatting
    safe = safe.replace(/₱/g, '&#8369;');

    return safe;
}

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Preformatted blocks
    if (line.trim().startsWith('```')) {
        if (inPre) {
            html += '</code></pre>\n';
            inPre = false;
        } else {
            html += '<pre><code>';
            inPre = true;
        }
        continue;
    }

    if (inPre) {
        // Escape inside code block
        html += line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;') + '\n';
        continue;
    }

    // Tables
    if (line.trim().startsWith('|')) {
        if (line.includes('---')) {
            // divider line, skip
            continue;
        }
        if (!inTable) {
            html += '<table border="1" style="border-collapse: collapse; width: 100%;">\n';
            inTable = true;
            tableHeaderSeen = false;
        }
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        html += '  <tr>\n';
        for (const cell of cells) {
            const tag = (!tableHeaderSeen) ? 'th' : 'td';
            html += `    <${tag}>${parseInline(cell)}</${tag}>\n`;
        }
        html += '  </tr>\n';
        if (!tableHeaderSeen) {
            tableHeaderSeen = true;
        }
        continue;
    } else if (inTable) {
        html += '</table>\n';
        inTable = false;
    }

    // Blockquotes
    if (line.trim().startsWith('>')) {
        const quoteText = line.replace(/^\s*>\s*/, '');
        html += `<blockquote>${parseInline(quoteText)}</blockquote>\n`;
        continue;
    }

    // Headings
    if (line.startsWith('# ')) {
        html += `<h1>${parseInline(line.substring(2))}</h1>\n`;
        continue;
    }
    if (line.startsWith('## ')) {
        html += `<h2>${parseInline(line.substring(3))}</h2>\n`;
        continue;
    }
    if (line.startsWith('### ')) {
        html += `<h3>${parseInline(line.substring(4))}</h3>\n`;
        continue;
    }

    // Horizontal Rule
    if (line.trim() === '---') {
        html += '<hr />\n';
        continue;
    }

    // Unordered Lists
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        if (!inList || listType !== 'ul') {
            if (inList) html += `</${listType}>\n`;
            html += '<ul>\n';
            inList = true;
            listType = 'ul';
        }
        const itemText = line.replace(/^\s*[-*]\s+/, '');
        html += `  <li>${parseInline(itemText)}</li>\n`;
        continue;
    }

    // Ordered Lists
    const olMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (olMatch) {
        if (!inList || listType !== 'ol') {
            if (inList) html += `</${listType}>\n`;
            html += '<ol>\n';
            inList = true;
            listType = 'ol';
        }
        html += `  <li>${parseInline(olMatch[2])}</li>\n`;
        continue;
    }

    // Close lists if we hit an empty line or non-list line
    if (line.trim() === '' || (!line.trim().startsWith('- ') && !line.trim().startsWith('* ') && !line.trim().match(/^\d+\.\s+/))) {
        if (inList) {
            html += `</${listType}>\n`;
            inList = false;
        }
    }

    // Empty lines
    if (line.trim() === '') {
        continue;
    }

    // Regular paragraphs
    html += `<p>${parseInline(line)}</p>\n`;
}

// Clean up any unclosed structures
if (inPre) html += '</code></pre>\n';
if (inTable) html += '</table>\n';
if (inList) html += `</${listType}>\n`;

html += `</body>
</html>`;

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('HTML generated successfully at: ' + htmlPath);
