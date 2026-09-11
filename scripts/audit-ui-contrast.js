/**
 * UI/UX Contrast & Accessibility Audit Script for POSCursor / POS Cursor
 * 
 * Scans app/ and src/components/ for potential UI/UX anti-patterns:
 * 1. Contrast violations (e.g. text-white on light bg, text-slate-900 on dark bg)
 * 2. Missing dark mode contrast pairs
 * 3. Icon color mismatches
 * 4. Small touch targets (<44px height/width)
 * 5. Accessibility attribute omissions (e.g. icon-only pressables missing accessibilityLabel)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SCAN_DIRS = [
  path.join(ROOT_DIR, 'app'),
  path.join(ROOT_DIR, 'src', 'components'),
];

const EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js'];

const findings = [];

function getAllFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!file.startsWith('.') && file !== '__tests__' && file !== 'node_modules') {
        results = results.concat(getAllFiles(filePath));
      }
    } else {
      if (EXTENSIONS.includes(path.extname(filePath))) {
        results.push(filePath);
      }
    }
  }
  return results;
}

function auditFile(filePath) {
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // Check 1: White text on white or light background
    if (/text-(white|slate-50|gray-50|zinc-50)\b/.test(trimmed)) {
      if (/bg-(white|slate-50|slate-100|gray-50|gray-100)\b/.test(trimmed)) {
        findings.push({
          file: relPath,
          line: lineNum,
          type: 'CONTRAST_WHITE_ON_WHITE',
          severity: 'HIGH',
          message: 'White/very light text combined with white/light background on same line.',
          snippet: trimmed,
        });
      }
    }

    // Check 2: Dark text on dark background
    if (/text-(slate-900|slate-950|black|gray-900)\b/.test(trimmed)) {
      if (/bg-(slate-900|slate-950|black|gray-900)\b/.test(trimmed)) {
        findings.push({
          file: relPath,
          line: lineNum,
          type: 'CONTRAST_DARK_ON_DARK',
          severity: 'HIGH',
          message: 'Dark/black text combined with dark/black background on same line.',
          snippet: trimmed,
        });
      }
    }

    // Check 3: Hardcoded text color #fff / #ffffff without dark container context
    if (/color=["']#fff(fff)?["']/i.test(trimmed) || /color:\s*["']#fff(fff)?["']/i.test(trimmed)) {
      if (!/bg-|Colors\.(primary|secondary|error|dark|role|status)/i.test(trimmed) && !/background|surface|emerald|slate-800|slate-900/i.test(trimmed)) {
        findings.push({
          file: relPath,
          line: lineNum,
          type: 'HARDCODED_WHITE_COLOR',
          severity: 'MEDIUM',
          message: 'Hardcoded white text/icon color (#fff/#ffffff) without explicit dark container style detected.',
          snippet: trimmed,
        });
      }
    }

    // Check 4: Suspiciously low touch target on Pressable/TouchableOpacity
    if (/<(Pressable|TouchableOpacity|TouchableHighlight)\b/.test(trimmed)) {
      if (/className=["'][^"']*\b(h-[1-7]|w-[1-7]|p-0\.5|p-1)\b/.test(trimmed) && !/min-h-\[4|p-2|p-3|p-4/.test(trimmed)) {
        findings.push({
          file: relPath,
          line: lineNum,
          type: 'SMALL_TOUCH_TARGET',
          severity: 'MEDIUM',
          message: 'Interactive element has potentially small touch target (<44px).',
          snippet: trimmed,
        });
      }
    }

    // Check 5: Icon-only button missing accessibility label
    if (/<(Pressable|TouchableOpacity)\b/.test(trimmed)) {
      if (!/accessibilityLabel=/.test(trimmed) && !/aria-label=/.test(trimmed)) {
        const multiLineContext = lines.slice(idx, idx + 4).join(' ');
        if (/<(Ionicons|Feather|MaterialIcons|FontAwesome|Octicons|AntDesign)\b/.test(multiLineContext) && !/>\s*[\w\d]/.test(multiLineContext)) {
          findings.push({
            file: relPath,
            line: lineNum,
            type: 'MISSING_ACCESSIBILITY_LABEL',
            severity: 'LOW',
            message: 'Icon-only pressable button appears to lack an accessibilityLabel or aria-label.',
            snippet: trimmed,
          });
        }
      }
    }

    // Check 6: Hardcoded light surface bg without dark mode pair
    if (/className=["'][^"']*\bbg-(white|slate-50|slate-100)\b/.test(trimmed)) {
      if (!/dark:bg-/.test(trimmed) && !/dark:/.test(content)) {
        if (/dark:/.test(content)) {
          findings.push({
            file: relPath,
            line: lineNum,
            type: 'MISSING_DARK_MODE_PAIR',
            severity: 'LOW',
            message: 'Light background utility specified without corresponding dark:bg- pair.',
            snippet: trimmed,
          });
        }
      }
    }
  });
}

function runAudit() {
  console.log('🔍 Starting UI/UX Contrast & Accessibility Audit...\n');
  let totalFiles = 0;

  for (const dir of SCAN_DIRS) {
    const files = getAllFiles(dir);
    totalFiles += files.length;
    files.forEach(auditFile);
  }

  console.log(`Scanned ${totalFiles} component & screen files.\n`);

  if (findings.length === 0) {
    console.log('✅ PASS: No contrast or accessibility anti-patterns detected!');
    return;
  }

  console.log(`⚠️ FOUND ${findings.length} POTENTIAL UI/UX ISSUES:\n`);

  const bySeverity = {
    HIGH: findings.filter(f => f.severity === 'HIGH'),
    MEDIUM: findings.filter(f => f.severity === 'MEDIUM'),
    LOW: findings.filter(f => f.severity === 'LOW'),
  };

  if (bySeverity.HIGH.length > 0) {
    console.log(`🛑 HIGH SEVERITY (${bySeverity.HIGH.length}):`);
    bySeverity.HIGH.forEach(f => {
      console.log(`  - [${f.file}:${f.line}] ${f.type}: ${f.message}`);
      console.log(`    Code: "${f.snippet}"\n`);
    });
  }

  if (bySeverity.MEDIUM.length > 0) {
    console.log(`⚠️ MEDIUM SEVERITY (${bySeverity.MEDIUM.length}):`);
    bySeverity.MEDIUM.forEach(f => {
      console.log(`  - [${f.file}:${f.line}] ${f.type}: ${f.message}`);
      console.log(`    Code: "${f.snippet}"\n`);
    });
  }

  if (bySeverity.LOW.length > 0) {
    console.log(`ℹ️ LOW SEVERITY / SUGGESTIONS (${bySeverity.LOW.length}):`);
    bySeverity.LOW.slice(0, 15).forEach(f => {
      console.log(`  - [${f.file}:${f.line}] ${f.type}: ${f.message}`);
    });
    if (bySeverity.LOW.length > 15) {
      console.log(`    ... and ${bySeverity.LOW.length - 15} more low severity items.`);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  HIGH:   ${bySeverity.HIGH.length}`);
  console.log(`  MEDIUM: ${bySeverity.MEDIUM.length}`);
  console.log(`  LOW:    ${bySeverity.LOW.length}`);
}

runAudit();
