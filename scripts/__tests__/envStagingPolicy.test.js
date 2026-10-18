'use strict';

/**
 * The pre-commit gate blocks every staged path matching `.startsWith('.env')`,
 * but `.env.example` is a TRACKED template (documented in AGENTS.md and relied on
 * by onboarding). The blanket rule made it uncommittable without --no-verify, so
 * agents either bypassed the hook or silently dropped template changes.
 *
 * These tests pin the distinction: the template is allowed, every real env file
 * stays blocked, and the block is not fooled by nesting or by lookalike names.
 */

const { blockedEnvFiles, isCommittableEnvTemplate } = require('../lib/envStagingPolicy.js');

describe('env staging policy', () => {
    it('allows the tracked .env.example template', () => {
        expect(blockedEnvFiles(['.env.example', 'src/index.ts'])).toEqual([]);
    });

    it('blocks every real env file, including the ones that hold production secrets', () => {
        expect(
            blockedEnvFiles(['.env', '.env.local', '.env.production', '.env.hetzner', '.env.test']),
        ).toEqual(['.env', '.env.local', '.env.production', '.env.hetzner', '.env.test']);
    });

    it('blocks env files nested in subdirectories', () => {
        expect(blockedEnvFiles(['supabase/.env.local', 'android/.env'])).toEqual([
            'supabase/.env.local',
            'android/.env',
        ]);
    });

    it('does not flag unrelated files that merely contain "env"', () => {
        expect(
            blockedEnvFiles(['src/utils/e2eEnvironment.ts', 'scripts/env-report.mjs', 'docs/environment.md']),
        ).toEqual([]);
    });

    it('preserves input order and reports each blocked path once', () => {
        expect(blockedEnvFiles(['.env.production', 'a.ts', '.env.local', '.env.production'])).toEqual([
            '.env.production',
            '.env.local',
            '.env.production',
        ]);
    });

    it('treats only the exact root-level template as committable', () => {
        expect(isCommittableEnvTemplate('.env.example')).toBe(true);
        // A nested or suffixed lookalike is not the documented template.
        expect(isCommittableEnvTemplate('sub/.env.example')).toBe(false);
        expect(isCommittableEnvTemplate('.env.example.local')).toBe(false);
        expect(isCommittableEnvTemplate('.env.production')).toBe(false);
    });
});
