# Secret and Data Remediation Checklist

Date: 2026-04-26
Workspace: `D:\GitHub\jetfarm-local`

## Goal
Remove tracked secrets and sensitive data from future commits, rotate exposed credentials, and purge historical exposure from git history.

## Current tracked exposure inventory

### Tracked env files
- `.env`
- `.env.development`
- `.env.production`
- `.env.test`

### Env keys currently present
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SUPABASE_DB_PASSWORD`

### Tracked sensitive/data-heavy paths
- `backups/remote_2026-04-01_19-47-21/**`
- `artifacts/**`
- `data/**`
- `excel_loans.json`
- `artifacts/local.db`

### Git history shows env files were committed in these commits
- `1dd23eb`
- `f14fe3f`
- `794ccf6`
- `7e7eec5`
- `7e2f556`
- `e5ecb21`
- `49b1c7d`
- `19779ff`
- `46127a2`
- `c256c0f`
- `557eb0d`

---

## Safe order of operations

### 1. Rotate exposed credentials first
Do this before removing files from history.

Rotate at minimum:
- database password currently exposed via env files
- any non-public Supabase secrets if ever stored locally

Notes:
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` is public by design, but still review usage because weak RLS makes it dangerous.
- After rotation, verify the new values are only stored in local developer machines / deployment secret managers.

### 2. Replace tracked env files with `.env.example`
Non-destructive prep has already been done:
- created `.env.example`

Then run:
```powershell
git rm --cached .env .env.development .env.production .env.test
```

Do **not** delete your local files from disk unless you intend to recreate them. `--cached` only stops tracking.

### 3. Stop tracking data dumps and artifacts
Run:
```powershell
git rm --cached -r backups artifacts data
git rm --cached excel_loans.json
git rm --cached artifacts/local.db
```

If some of these are intentionally shared fixtures, move only sanitized fixtures into a separate safe folder such as `fixtures/`.

### 4. Purge history
Use one tool only.

#### Option A: `git filter-repo` (recommended)
```powershell
pip install git-filter-repo
```
Then:
```powershell
git filter-repo --path .env --path .env.development --path .env.production --path .env.test --path-glob 'backups/*' --path-glob 'artifacts/*' --path-glob 'data/*' --path excel_loans.json --invert-paths
```

#### Option B: BFG Repo-Cleaner
Use if your team already prefers BFG.

### 5. Force-push rewritten history
Only after coordinating with collaborators:
```powershell
git push --force-with-lease origin <branch>
```

### 6. Tell collaborators to re-clone
After history rewrite, old clones remain contaminated.

---

## Verification checklist

Run after remediation:

### Tracked file checks
```powershell
git ls-files .env .env.*
git ls-files backups artifacts data excel_loans.json *.db
```
Expected: no output, or only intentionally retained sanitized fixtures.

### History checks
```powershell
git log --all -- .env .env.*
git log --all -- backups artifacts data excel_loans.json
```
Expected: no secret/data-bearing history remains after rewrite.

### Content scan checks
```powershell
Get-ChildItem -Recurse -File | Select-String -Pattern 'EXPO_PUBLIC_SUPABASE_DB_PASSWORD|SUPABASE_DB_PASSWORD|service_role|BEGIN PRIVATE KEY' -SimpleMatch
```
Expected: no real secret hits in tracked files.

### App checks
- update local `.env` files from secret manager
- rerun:
```powershell
npx tsc --noEmit --pretty false
npm test -- --runInBand
npm run export:web:production
```

---

## Recommended follow-up after secret remediation
1. Apply Supabase RLS migration in a non-prod env
2. Run real role-based smoke tests:
   - admin login
   - collector payment encoder
   - collector quick collect
   - savings-to-loan
   - payment delete/reversal
3. Add CI secret scanning
4. Add CI tracked-file policy to fail if `.env*`, `backups/`, `artifacts/`, `data/`, or `*.db` are reintroduced

---

## Suggested PR / release note snippet
"Added non-destructive remediation assets for secret/data cleanup: `.env.example` plus a repository cleanup checklist covering credential rotation, untracking, history purge, and verification. No local secret/data files were deleted automatically in this pass."
