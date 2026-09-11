---
name: file-organization
description: Guidelines and instructions for organizing files within the POS Cursor/POSCursor project and preventing root directory clutter.
---

# File Organization Skill (Expo Router, NativeWind v4, WatermelonDB/Supabase)

This skill enforces file organization rules to prevent cluttering the project root directory and to keep the repository well-structured.

## Folder Organization Rules

When creating, moving, or editing files in the codebase, you MUST place them in their designated directories based on file type and purpose:

1. **Documentation and Reports (`docs/`)**
   - Save all developer notes, analyses, workflows, guides, checklists, reports, and other markdown files inside `docs/`.
   - Never create `.md` files in the root folder, with the sole exception of `README.md` and `AGENTS.md`.

2. **Developer, Import, and Maintenance Scripts (`scripts/`)**
   - Save all utility, diagnostic, migration, test wrappers, data import, or one-off development scripts (`.js`, `.mjs`, `.ts`, `.py`, `.ps1`) in the `scripts/` directory.

3. **SQL Queries and DB Helpers (`supabase/queries/`)**
   - Save all standalone SQL scripts, debugging queries, table verification scripts, and raw SQL helper files in `supabase/queries/`.
   - Official Supabase migration scripts must be placed in `supabase/migrations/` using standard timestamp prefixes.

4. **Visual Assets (`docs/images/`)**
   - Place all design drafts, mockups, screenshots, and other visual artifacts inside `docs/images/` or under specific component directories, never in the root.

5. **Code Examples (`docs/examples/`)**
   - Save standalone example code files, component mockups, or dashboard templates inside `docs/examples/` and ensure their relative imports reference correct paths (e.g. using `../../src/`).

## Link Maintenance Rules

When relocating or creating documents, ensure that:
- Any markdown links referencing other documents use relative paths matching their new locations.
- If referencing folders or files in the root from inside `docs/`, prefix them with `../` (e.g., `[package.json](../package.json)`).
