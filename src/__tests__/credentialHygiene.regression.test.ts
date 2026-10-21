import * as fs from 'fs';
import * as path from 'path';

/**
 * Credential hygiene for a public repository.
 *
 * `zazakia/JetFarm` is public, so any Supabase service key or database password committed anywhere
 * in the tree is already disclosed - it cannot be un-known, only rotated (a human action) and kept
 * from reappearing. This file is the "kept from reappearing" half: it fails a normal `npm test` run
 * the moment a credential-shaped literal is committed, and it pins the remaining TLS-verification
 * bypasses in an explicit allowlist that may shrink but never grow.
 */
const ROOT = process.cwd();
const SCAN_DIRS = ['scripts', 'src', 'app', 'supabase', 'tests', 'docs', '.github', 'config'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'tmp', 'dist', 'build', 'coverage', 'android', 'ios', 'screenshots', '.next']);
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.sql', '.md', '.yml', '.yaml', '.html', '.env.example', '.toml']);

// This guard itself carries the patterns it looks for.
const SELF = path.join('src', '__tests__', 'credentialHygiene.regression.test.ts');

interface Candidate {
    file: string;
    text: string;
}

function collect(dir: string, into: Candidate[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) collect(full, into);
            continue;
        }
        const ext = path.extname(entry.name);
        if (ext && !TEXT_EXT.has(ext)) continue;
        if (path.relative(ROOT, full).split(path.sep).join('/') === SELF) continue;
        let text = '';
        try {
            text = fs.readFileSync(full, 'utf8');
        } catch {
            continue;
        }
        into.push({ file: path.relative(ROOT, full).split(path.sep).join('/'), text });
    }
}

function linesWith(file: string, text: string, pattern: RegExp): string[] {
    return text
        .split('\n')
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => pattern.test(line))
        .map(({ line, n }) => `${file}:${n}: ${line.trim().slice(0, 80)}`);
}

describe('credential hygiene (public repo)', () => {
    const files: Candidate[] = [];
    SCAN_DIRS.forEach(dir => collect(path.join(ROOT, dir), files));

    it('finds the tree it is supposed to guard', () => {
        // A guard that scanned nothing would pass vacuously.
        expect(files.length).toBeGreaterThan(150);
        expect(files.some(f => f.file.startsWith('scripts/'))).toBe(true);
        expect(files.some(f => f.file.startsWith('supabase/'))).toBe(true);
    });

    it('carries no Supabase secret-class key literal', () => {
        // sb_secret_* / sb_pat_* bypass RLS entirely. There is no acceptable place for one in the
        // tree, not even behind an env fallback.
        const pattern = /sb_(?:secret|secret_publishable|pat)_[A-Za-z0-9_-]{20,}/;
        const hits = files.flatMap(f => linesWith(f.file, f.text, pattern));
        expect(hits).toEqual([]);
    });

    it('carries no publishable or anon key written as a bare literal', () => {
        // sb_publishable_* / anon keys are RLS-bound and may sit behind an environment fallback for
        // local development, but a bare literal is how a key ends up in a public repo.
        const pattern = /sb_(?:publishable|anon|publishable_anon)[a-z_]*_[A-Za-z0-9_-]{20,}/;
        const hits = files.flatMap(f =>
            linesWith(f.file, f.text, pattern)
                .filter(line => !line.includes('process.env.'))
                .map(line => line.replace(/sb_(?:publishable|anon|publishable_anon)[a-z_]*_[A-Za-z0-9_-]+/, '<redacted-key>'))
        );
        expect(hits).toEqual([]);
    });

    it('carries no JWT-shaped key literal', () => {
        const pattern = /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/;
        const hits = files.flatMap(f => linesWith(f.file, f.text, pattern));
        expect(hits).toEqual([]);
    });

    it('carries no postgres DSN with an inline password', () => {
        // `postgres://user:...@` is the documented placeholder shape used in prose; a real DSN names
        // an account. Markdown prose is still scanned, so only the literal placeholder is skipped.
        const pattern = /postgres(?:ql)?:\/\/(?!user:)[^\s'"]*:[^\s@'"]{6,}@/;
        const hits = files
            .flatMap(f => linesWith(f.file, f.text, pattern))
            .map(line => line.replace(/\/\/([^/:]+):[^@]+@/, '//$1:<redacted-password>@'));
        expect(hits).toEqual([]);
    });

    it('carries no hardcoded database password', () => {
        const pattern = /(?:password|PASSWORD)\s*[:=]\s*[^\s,]*\|\|\s*'[^']{6,}'/;
        const hits = files
            .flatMap(f => linesWith(f.file, f.text, pattern))
            .map(line => line.replace(/\|\|\s*'[^']*'/, "|| '<redacted>'"));
        expect(hits).toEqual([]);
    });

    it('pins every remaining TLS-verification bypass so the list can only shrink', () => {
        const pattern = /rejectUnauthorized\s*:\s*false/;
        const found = Array.from(new Set(
            files
                // Docs and the guard's own comments name the forbidden flag to warn about it;
                // only executable code that actually sets it counts.
                .filter(f => !f.file.includes('__tests__') && !f.file.startsWith('docs/'))
                .filter(f =>
                    f.text.split('\n').some(raw => {
                        if (!pattern.test(raw)) return false;
                        const body = raw.trim();
                        return !body.startsWith('//') && !body.startsWith('*') && !body.startsWith('/*') && !body.startsWith('#');
                    })
                )
                .map(f => f.file)
        )).sort();

        // Known debt on pre-existing production/deploy paths, tracked for human remediation.
        // Adding a file here is a regression; deleting one is the fix - scripts/lib/pgTls.mjs is
        // the replacement, and it verifies with an optional private CA.
        const ALLOWED = [
            'scripts/backup.js',
            'scripts/check-production-migrations.mjs',
            'scripts/deploy-hetzner.mjs',
            'scripts/find-anon-key.mjs',
            'scripts/find-pooler-region.mjs',
        ].sort();

        expect(found.filter(f => !ALLOWED.includes(f))).toEqual([]);
        expect(found.length).toBeLessThanOrEqual(ALLOWED.length);
    });
});
