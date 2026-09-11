# Database Safety Measures

To prevent accidental data loss or corruption in the production environment, strict safeguards have been implemented for all test suites.

## Automated Guards

Both unit tests (Jest) and end-to-end tests (Playwright) include mandatory environment checks.

- **Jest**: Configured in `src/jest-setup.ts`.
- **Playwright**: Configured in `playwright.config.ts`.

If the script detects `EXPO_PUBLIC_SUPABASE_URL` pointing to the production project (`https://YOUR_SUPABASE_PROJECT.supabase.co`), it will immediately throw an error and terminate the process.

## Environment Variables

| File | Purpose | Supabase URL |
|------|---------|--------------|
| `.env.production` | Production deployment | `https://YOUR_SUPABASE_PROJECT.supabase.co` |
| `.env.test` | Testing & CI | `http://127.0.0.1:45421` (Local/Test DB) |
| `.env.local` | Local development | Varies (Local or dev branch) |

## AI Assistant Prompt (Instruction for Future Tasks)

When using AI assistants, include the following rule in the system instructions or conversation context:

```markdown
### SYSTEM RULE: PROTECT PRODUCTION DATABASE
ALWAYS ensure that any code changes related to testing, database migrations, or environment configuration strictly AVOID using the production Supabase URL: `https://YOUR_SUPABASE_PROJECT.supabase.co`.

When writing or running tests:
1. Verify that `NODE_ENV` is set to `test`.
2. Ensure `.env.test` or a local development database is being used.
3. If an operation requires a database, use a local instance (`http://127.0.0.1:45421`) or an isolated test project.
4. NEVER perform destructive operations or seeding on the production URL unless explicitly and specifically requested for a one-time production maintenance task with user confirmation.
```
