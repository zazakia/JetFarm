import fs from 'fs';
import path from 'path';

function scanDir(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.expo') {
      files.push(...scanDir(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = [...scanDir('app'), ...scanDir('src')];
let animatedMissingFallback = [];
let horizontalScrollViewCount = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  
  // Check Animated.View with dark bg classes and text-white but without style={{ backgroundColor: ... }}
  const animatedMatches = content.matchAll(/<Animated\.View\b([^>]*?)>/gs);
  for (const match of animatedMatches) {
    const attrs = match[1];
    if (attrs.includes('className=') && attrs.includes('bg-') && !attrs.includes('style=')) {
      if (/bg-(blue|indigo|slate|gray-900|emerald|red|purple)/.test(attrs)) {
        animatedMissingFallback.push({ file, snippet: match[0].slice(0, 100).replace(/\n/g, ' ') });
      }
    }
  }

  if (content.includes('<ScrollView') && content.includes('horizontal')) {
    horizontalScrollViewCount++;
  }
}

console.log('📋 BryFixLayout Visual & Geometry Audit');
console.log('Total files checked:', files.length);
console.log('Horizontal ScrollViews checked:', horizontalScrollViewCount);
console.log('Animated.View missing inline bg fallback:', animatedMissingFallback.length);
if (animatedMissingFallback.length > 0) {
  console.log('\nAnimated.View items to harden:');
  animatedMissingFallback.forEach(i => console.log(`  - in ${i.file}: ${i.snippet}`));
}
