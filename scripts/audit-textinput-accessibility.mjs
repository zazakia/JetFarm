import fs from 'fs';
import path from 'path';

function scanDir(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.expo') {
      files.push(...scanDir(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = [...scanDir('app'), ...scanDir('src')];
let issues = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  const tagMatches = content.matchAll(/<TextInput\b([^>]*?)(?:\/>|>)/gs);
  for (const match of tagMatches) {
    const attrs = match[1];
    const hasPlaceholder = attrs.includes('placeholder=');
    const hasPlaceholderColor = attrs.includes('placeholderTextColor=');
    const hasTextColor = /className=["'][^"']*?text-(gray|slate|black|white|blue|red|green|neutral|zinc|stone)/.test(attrs);
    
    if (hasPlaceholder && !hasPlaceholderColor) {
      issues.push({ file, type: 'MISSING_PLACEHOLDER_COLOR', snippet: match[0].slice(0, 100).replace(/\n/g, ' ') });
    }
    if (!hasTextColor && !attrs.includes('style=')) {
      issues.push({ file, type: 'MISSING_TEXT_COLOR', snippet: match[0].slice(0, 100).replace(/\n/g, ' ') });
    }
  }
}

console.log('📋 TextInput Accessibility & Contrast Audit');
console.log('Total files checked:', files.length);
console.log('Total issues found:', issues.length);
if (issues.length > 0) {
  console.log('\nTop issues:');
  issues.slice(0, 15).forEach(i => console.log(`  - [${i.type}] in ${i.file}: ${i.snippet}`));
}
