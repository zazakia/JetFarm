import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.join(repoRoot, 'src', 'constants', 'generatedAppUpdates.ts');
const jsonOutputPath = path.join(repoRoot, 'src', 'constants', 'generatedAppUpdates.json');

const RECORD_SEPARATOR = '\u001e';
const FIELD_SEPARATOR = '\u001f';

function runGit(args) {
    return execFileSync('git', args, {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 20,
    });
}

function hasGitRepo() {
    try {
        runGit(['rev-parse', '--is-inside-work-tree']);
        runGit(['rev-parse', '--verify', 'HEAD']);
        return true;
    } catch {
        return false;
    }
}

function serializeUpdates(updates) {
    const serialized = JSON.stringify(updates, null, 4);
    return `import type { AppUpdateEntry } from './appUpdates';\n\n` +
        `export const GENERATED_APP_UPDATES: AppUpdateEntry[] = ${serialized};\n`;
}

function writeBaselineUpdates() {
    const today = new Date().toISOString().slice(0, 10);
    const updates = [
        {
            id: 'baseline',
            version: '0.1.0',
            versionLabel: 'Release',
            date: today,
            title: 'Initial JetFarm baseline',
            category: 'technical',
            icon: 'code',
            summary: 'Clean decoupled baseline without prior repository history.',
            changes: ['Initial project identity and local isolation setup.'],
            codeChanges: ['Repository baseline established.'],
        },
    ];
    fs.writeFileSync(outputPath, serializeUpdates(updates), 'utf8');
    fs.writeFileSync(jsonOutputPath, JSON.stringify(updates, null, 4), 'utf8');
    console.log(`Wrote ${updates.length} baseline updates to ${outputPath} and ${jsonOutputPath} (no git history)`);
}

function cleanMessage(value) {
    return value.replace(/\r/g, '').trim();
}

function stripConventionalPrefix(subject) {
    return subject.replace(/^(feat|fix|chore|refactor|test|docs|build|ci|perf|style)(\([^)]+\))?!?:\s*/i, '').trim();
}

function normalizeTitle(subject) {
    const cleaned = stripConventionalPrefix(subject).replace(/\.$/, '').trim();
    if (!cleaned) {
        return 'Repository update';
    }

    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function getBodySentences(body) {
    return cleanMessage(body)
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !/^[A-Z][A-Za-z-]+:\s/.test(line))
        .flatMap(line => line.split(/(?<=[.!?])\s+/))
        .map(line => line.trim())
        .filter(Boolean);
}

function pickCategory(subject, body) {
    const normalizedSubject = subject.toLowerCase();
    const text = `${subject} ${body}`.toLowerCase();

    if (/(audit|reconcil|integrity|repair|backfill|migration data|historical data)/.test(normalizedSubject)) {
        return 'data';
    }

    if (/^(feat)\b/i.test(subject) || /^(add|implement|introduce|expose|create|launch)\b/.test(normalizedSubject)) {
        return 'feature';
    }

    if (/^(fix|hotfix)\b/i.test(subject) || /^(restore|prevent|keep|stabiliz|harden|correct)\b/.test(normalizedSubject)) {
        return 'fix';
    }

    if (/(audit|reconcil|integrity|repair|backfill|migration data|historical data)/.test(text)) {
        return 'data';
    }

    if (/(fix|fixed|stabiliz|harden|prevent|restore|correct|reliable)/.test(text)) {
        return 'fix';
    }

    if (/(add|implement|introduce|expose|launch|create)/.test(text)) {
        return 'feature';
    }

    return 'technical';
}

function pickIcon(category) {
    switch (category) {
        case 'feature':
            return 'new-releases';
        case 'fix':
            return 'build-circle';
        case 'data':
            return 'fact-check';
        default:
            return 'code';
    }
}

function summarize(subject, body) {
    const sentences = getBodySentences(body);
    if (sentences.length > 0) {
        return sentences[0];
    }

    return normalizeTitle(subject);
}

function formatChangeList(subject, body) {
    const bullets = [normalizeTitle(subject)];
    for (const sentence of getBodySentences(body)) {
        if (bullets.length >= 3) {
            break;
        }

        if (!bullets.includes(sentence)) {
            bullets.push(sentence);
        }
    }

    return bullets;
}

function formatCodeChanges(files) {
    const preferredFiles = files.filter(file => !/^(\.omx\/|coverage\/|playwright-report\/|test-results\/|debug-screenshots\/)/.test(file));
    const visibleFiles = preferredFiles.length > 0 ? preferredFiles : files;

    if (visibleFiles.length === 0) {
        return ['Repository metadata updated with no file list captured.'];
    }

    return visibleFiles.slice(0, 3).map(file => `Updated ${file}`);
}

if (!hasGitRepo()) {
    writeBaselineUpdates();
    process.exit(0);
}

const rawLog = runGit([
    'log',
    '--date=short',
    `--format=%H${FIELD_SEPARATOR}%h${FIELD_SEPARATOR}%ad${FIELD_SEPARATOR}%s${FIELD_SEPARATOR}%b${RECORD_SEPARATOR}`,
]);

const entries = rawLog
    .split(RECORD_SEPARATOR)
    .map(chunk => chunk.trim())
    .filter(Boolean);

const updates = entries.map(entry => {
    const [sha, shortSha, date, subject, body = ''] = entry.split(FIELD_SEPARATOR);
    const files = runGit(['show', '--pretty=format:', '--name-only', sha])
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
    const category = pickCategory(subject, body);

    return {
        id: sha,
        version: shortSha,
        versionLabel: 'Commit',
        date,
        title: normalizeTitle(subject),
        category,
        icon: pickIcon(category),
        summary: summarize(subject, body),
        changes: formatChangeList(subject, body),
        codeChanges: formatCodeChanges(files),
    };
});

fs.writeFileSync(outputPath, serializeUpdates(updates), 'utf8');
fs.writeFileSync(jsonOutputPath, JSON.stringify(updates, null, 4), 'utf8');
console.log(`Wrote ${updates.length} updates to ${outputPath} and ${jsonOutputPath}`);
