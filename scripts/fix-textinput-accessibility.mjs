import fs from 'fs';
import path from 'path';

function scanDir(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.expo' && entry.name !== 'dist') {
      files.push(...scanDir(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = [...scanDir('app'), ...scanDir('src')];
let modifiedFilesCount = 0;
let totalFixedInputs = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let originalContent = content;

  // 1. Add placeholderTextColor="#9CA3AF" if missing on inputs with placeholder
  let updatedContent = content.replace(/<TextInput\b(?![^>]*placeholderTextColor=)([^>]*?placeholder=[^>]*?)(\/?>)/g, (fullMatch, body, ending) => {
    totalFixedInputs++;
    return `<TextInput${body} placeholderTextColor="#9CA3AF"${ending}`;
  });

  // 2. Ensure text-gray-900 in className if no text- color is specified
  updatedContent = updatedContent.replace(/<TextInput\b([^>]*?)className=(["'`])([^"'`]*?)\2([^>]*?>)/g, (fullMatch, pre, quote, classVal, post) => {
    if (!/text-(gray|slate|black|white|blue|red|green|neutral|zinc|stone)/.test(classVal)) {
      totalFixedInputs++;
      return `<TextInput${pre}className=${quote}${classVal} text-gray-900${quote}${post}`;
    }
    return fullMatch;
  });

  if (updatedContent !== originalContent) {
    fs.writeFileSync(file, updatedContent, 'utf-8');
    modifiedFilesCount++;
  }
}

console.log(`\n🎉 Completed Full TextInput Accessibility & Text-Color Hardening`);
console.log(`  Files modified: ${modifiedFilesCount}`);
console.log(`  Total properties hardened: ${totalFixedInputs}`);
