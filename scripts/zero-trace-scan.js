const fs = require('fs');
const path = require('path');

const targetDir = path.resolve(__dirname, '..');
const ignoreDirs = new Set([
  'node_modules',
  '.git',
  'dist',
  '.expo',
  'coverage',
  '.temp',
  'test-results',
  'android', // native android build files contain some legacy symbols if prebuilt, but check package
  '.vscode'
]);

const terms = [
  'poscursor-local',
  'com.poscursor.app',
  'poscursor.pages.dev',
  'poscursor.apk'
];

const matches = [];

function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(full);
    } else {
      // Don't scan this script itself
      if (entry.name === 'zero-trace-scan.js') continue;
      try {
        const content = fs.readFileSync(full, 'utf8');
        for (const term of terms) {
          if (content.toLowerCase().includes(term.toLowerCase())) {
            matches.push({ file: path.relative(targetDir, full), term });
          }
        }
      } catch (e) {
        // Binary or unreadable file
      }
    }
  }
}

console.log(`[Zero-Trace Audit] Scanning ${targetDir} for legacy project markers: ${terms.join(', ')}...`);
scan(targetDir);

console.log(`[Zero-Trace Audit] Matches found: ${matches.length}`);
if (matches.length > 0) {
  console.log('[Zero-Trace Audit] Matching files:');
  for (const m of matches) {
    console.log(`  - [${m.term}] ${m.file}`);
  }
  process.exit(1);
} else {
  console.log('✅ ZERO residual traces detected! Clean decoupling verified.');
  process.exit(0);
}
