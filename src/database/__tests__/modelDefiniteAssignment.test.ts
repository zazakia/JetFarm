import { readdirSync, readFileSync } from 'fs';
import path from 'path';

/**
 * WatermelonDB assigns decorated properties at runtime through the decorator
 * pipeline, which TypeScript cannot observe. Under strictPropertyInitialization
 * every such field is reported as TS2564 ("no initializer and is not definitely
 * assigned in the constructor") -- a structural false positive, not a defect.
 *
 * The repo's established answer is the definite-assignment assertion (`name!: T`),
 * already used by the majority of model fields. These tests keep that convention
 * complete so the flag can stay enabled and new models cannot regress it.
 *
 * Type-only: `!` is erased at compile time and changes no runtime behaviour.
 */

const MODELS_DIR = path.resolve(__dirname, '..', 'models');

/** Decorators that make WatermelonDB assign the property at runtime. */
const ASSIGNING_DECORATORS = ['field', 'date', 'text', 'json', 'relation', 'children', 'immutable_relation'];

interface Finding {
    file: string;
    line: number;
    text: string;
}

/**
 * Single-line `@decorator('col') propName: Type;` declarations. The repo writes
 * decorators inline with the property (including `@readonly @date(...)` stacks),
 * so a line-oriented scan is sufficient. The gate matches an assigning decorator
 * ANYWHERE on the line, not just at the start, so a leading `@readonly` cannot
 * hide the property from the check.
 */
function decoratedPropertiesWithoutDefiniteAssignment(): Finding[] {
    const findings: Finding[] = [];
    const decoratorPattern = new RegExp(`@(${ASSIGNING_DECORATORS.join('|')})\\(`);

    for (const entry of readdirSync(MODELS_DIR).sort()) {
        if (!entry.endsWith('.ts') || entry.endsWith('.d.ts')) continue;
        const file = path.join(MODELS_DIR, entry);
        const lines = readFileSync(file, 'utf8').split(/\r?\n/);

        lines.forEach((text, index) => {
            if (!decoratorPattern.test(text)) return;
            // Property name and its type annotation must both be on the decorator line.
            const property = text.match(/\)\s*([A-Za-z_$][\w$]*)\s*(!\?)?\s*:/);
            if (!property) return;
            const hasAssertion = /\)\s*[A-Za-z_$][\w$]*\s*!:/.test(text);
            // Optional properties are legitimately unassigned; leave them alone.
            const isOptional = /\)\s*[A-Za-z_$][\w$]*\s*\?:/.test(text);
            if (!hasAssertion && !isOptional) {
                findings.push({ file: entry, line: index + 1, text: text.trim() });
            }
        });
    }

    return findings;
}

describe('WatermelonDB model definite assignment', () => {
    it('finds the models directory', () => {
        expect(readdirSync(MODELS_DIR).filter((f) => f.endsWith('.ts')).length).toBeGreaterThan(10);
    });

    it('declares every decorated property with a definite-assignment assertion', () => {
        // Jest's expect takes one argument (the Playwright message form does not apply),
        // so the findings are the assertion payload and the diff names each offender.
        const findings = decoratedPropertiesWithoutDefiniteAssignment().map(
            (f) => `${f.file}:${f.line}  ${f.text}`,
        );
        expect(findings).toEqual([]);
    });

    it('does not mistake an optional property for a missing assertion', () => {
        // Guards the scanner itself: a `?:` property must never be reported.
        const scanner = decoratedPropertiesWithoutDefiniteAssignment();
        expect(scanner.some((f) => /\?\s*:/.test(f.text))).toBe(false);
    });
});
