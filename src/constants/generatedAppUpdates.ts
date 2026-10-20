import type { AppUpdateEntry } from './appUpdates';

export const GENERATED_APP_UPDATES: AppUpdateEntry[] = [
    {
        "id": "3b5c1c5f95208547305418180367a5144a307066",
        "version": "3b5c1c5",
        "versionLabel": "Commit",
        "date": "2026-10-20",
        "title": "Software factory design, mark tier-enforcement gap implemented",
        "category": "feature",
        "icon": "new-releases",
        "summary": "Station map of the JetFarm development line (intake -> deploy -> monitor),",
        "changes": [
            "Software factory design, mark tier-enforcement gap implemented",
            "Station map of the JetFarm development line (intake -> deploy -> monitor),",
            "have-vs-gap per station, L0-L5 routing, human checkpoints, pi-durable"
        ],
        "codeChanges": [
            "Updated docs/SOFTWARE-FACTORY-DESIGN.md"
        ]
    },
    {
        "id": "db6d38c87bf01cd3e8135d06a161970eacd313c3",
        "version": "db6d38c",
        "versionLabel": "Commit",
        "date": "2026-10-20",
        "title": "Enforce tier evidence at pre-push and hard-block L5 pushes",
        "category": "feature",
        "icon": "new-releases",
        "summary": "- Extract TIER_GATES/HUMAN_ONLY_COMMANDS + enforcement decisions into",
        "changes": [
            "Enforce tier evidence at pre-push and hard-block L5 pushes",
            "- Extract TIER_GATES/HUMAN_ONLY_COMMANDS + enforcement decisions into",
            "scripts/lib/tierPolicy.js (single source shared with the Jest suite)"
        ],
        "codeChanges": [
            "Updated AGENTS.md",
            "Updated scripts/__tests__/tierPolicy.test.js",
            "Updated scripts/changed-files-gate.mjs"
        ]
    },
    {
        "id": "3a1698f0f67b0e164ec64663590c3ea85a895e78",
        "version": "3a1698f",
        "versionLabel": "Commit",
        "date": "2026-10-20",
        "title": "Record the working cloud DDL path and a public-repo credential exposure",
        "category": "technical",
        "icon": "code",
        "summary": "Blocker 2 was wrong.",
        "changes": [
            "Record the working cloud DDL path and a public-repo credential exposure",
            "Blocker 2 was wrong.",
            "The project sits on the ap-northeast-2 session pooler (the"
        ],
        "codeChanges": [
            "Updated docs/ENV-PRODUCTION-REPOINT-20261019.md"
        ]
    },
    {
        "id": "0f1792d0be638d26f50f5b24d5664c0fc64f1234",
        "version": "0f1792d",
        "versionLabel": "Commit",
        "date": "2026-10-20",
        "title": "Pin a CA and never bypass TLS verification in the cloud runner",
        "category": "feature",
        "icon": "new-releases",
        "summary": "Supabase Cloud signs its pooler and direct certs with a private \"Supabase Root",
        "changes": [
            "Pin a CA and never bypass TLS verification in the cloud runner",
            "Supabase Cloud signs its pooler and direct certs with a private \"Supabase Root",
            "2021 CA\" that no system trust store carries, so a normal connection dies with"
        ],
        "codeChanges": [
            "Updated scripts/__tests__/applyCloudSupabaseMigrations.test.js",
            "Updated scripts/apply-cloud-supabase-migrations.mjs",
            "Updated scripts/lib/applyCloudSupabaseMigrations.core.js"
        ]
    },
    {
        "id": "f8148bb8efac3ee8a8960e373830db973ef208ab",
        "version": "f8148bb",
        "versionLabel": "Commit",
        "date": "2026-10-19",
        "title": "Record local verification status of the cloud provisioning runner",
        "category": "technical",
        "icon": "code",
        "summary": "The provisioning tool referenced as a future step now exists, so the doc",
        "changes": [
            "Record local verification status of the cloud provisioning runner",
            "The provisioning tool referenced as a future step now exists, so the doc",
            "points at it and states plainly what has and has not been verified: dry run,"
        ],
        "codeChanges": [
            "Updated docs/ENV-PRODUCTION-REPOINT-20261019.md"
        ]
    },
    {
        "id": "ad2f5f6ebc9e78a3cbb45fea820be9d8b8e2f596",
        "version": "ad2f5f6",
        "versionLabel": "Commit",
        "date": "2026-10-19",
        "title": "Provision Supabase Cloud from repo migrations with Hetzner ledger parity",
        "category": "feature",
        "icon": "new-releases",
        "summary": "The cloud project picked as the future production target is empty, and the",
        "changes": [
            "Provision Supabase Cloud from repo migrations with Hetzner ledger parity",
            "The cloud project picked as the future production target is empty, and the",
            "only existing migration path (scripts/apply-hetzner-migrations.mjs) drives"
        ],
        "codeChanges": [
            "Updated scripts/__tests__/applyCloudSupabaseMigrations.test.js",
            "Updated scripts/apply-cloud-supabase-migrations.mjs",
            "Updated scripts/lib/applyCloudSupabaseMigrations.core.js"
        ]
    },
    {
        "id": "af85f54d2947e3e0e37dc2c175ca3b7be5db37e7",
        "version": "af85f54",
        "versionLabel": "Commit",
        "date": "2026-10-19",
        "title": "Record cloud-project provisioning readiness findings for future prod",
        "category": "technical",
        "icon": "code",
        "summary": "Cloud project pkkcpyhpbkbadnjlpqfv verified live-but-empty (0/93 contract",
        "changes": [
            "Record cloud-project provisioning readiness findings for future prod",
            "Cloud project pkkcpyhpbkbadnjlpqfv verified live-but-empty (0/93 contract",
            "tables, 0 auth users)."
        ],
        "codeChanges": [
            "Updated docs/ENV-PRODUCTION-REPOINT-20261019.md"
        ]
    },
    {
        "id": "637f2f4218655e599f71d6ee42d0394d10f7c7d6",
        "version": "637f2f4",
        "versionLabel": "Commit",
        "date": "2026-10-19",
        "title": "Add autonomous long-running work contract",
        "category": "fix",
        "icon": "build-circle",
        "summary": "Ordinary prompts stall on ambiguity and per-command approvals.",
        "changes": [
            "Add autonomous long-running work contract",
            "Ordinary prompts stall on ambiguity and per-command approvals.",
            "This gives a"
        ],
        "codeChanges": [
            "Updated AGENTS.md"
        ]
    },
    {
        "id": "1917d622588f3cffb702e127bb1a8cda7885ac54",
        "version": "1917d62",
        "versionLabel": "Commit",
        "date": "2026-10-19",
        "title": "Clear implicit-any and unknown hook-result errors for strict prep",
        "category": "data",
        "icon": "fact-check",
        "summary": "Mechanical strict-mode preparation.",
        "changes": [
            "Clear implicit-any and unknown hook-result errors for strict prep",
            "Mechanical strict-mode preparation.",
            "tsconfig is unchanged (strict: false);"
        ],
        "codeChanges": [
            "Updated scripts/migrate-brayan.ts",
            "Updated src/database/index.ts",
            "Updated src/hooks/__tests__/useParcelMapping.test.ts"
        ]
    },
    {
        "id": "a99672364ffa4671418359171a8f8a4ac599f911",
        "version": "a996723",
        "versionLabel": "Commit",
        "date": "2026-10-19",
        "title": "Declare uuid explicitly and add lokijs/uuid type packages",
        "category": "fix",
        "icon": "build-circle",
        "summary": "`uuid` was imported from 11 sites but never declared; it resolved only as a",
        "changes": [
            "Declare uuid explicitly and add lokijs/uuid type packages",
            "`uuid` was imported from 11 sites but never declared; it resolved only as a",
            "hoisted transitive dependency of `xcode` (v7.0.3), which breaks if npm's"
        ],
        "codeChanges": [
            "Updated package-lock.json",
            "Updated package.json"
        ]
    },
    {
        "id": "d7cf2d5553ecd408033815acc0aba0f4ee5a9399",
        "version": "d7cf2d5",
        "versionLabel": "Commit",
        "date": "2026-10-19",
        "title": "Assert definite assignment on all WatermelonDB model fields",
        "category": "data",
        "icon": "fact-check",
        "summary": "Adds the definite-assignment assertion (`name!: T`) to every decorated model",
        "changes": [
            "Assert definite assignment on all WatermelonDB model fields",
            "Adds the definite-assignment assertion (`name!: T`) to every decorated model",
            "property -- 582 fields across 46 models, including `@readonly @date(...)`"
        ],
        "codeChanges": [
            "Updated src/database/__tests__/modelDefiniteAssignment.test.ts",
            "Updated src/database/models/ActionLog.ts",
            "Updated src/database/models/AppSetting.ts"
        ]
    },
    {
        "id": "c5843a9eab2c355fe229c741d1eb5857a154e52f",
        "version": "c5843a9",
        "versionLabel": "Commit",
        "date": "2026-10-19",
        "title": "Give the map its own height and make taps land on it",
        "category": "fix",
        "icon": "build-circle",
        "summary": "Two independent defects made the parcel mapping screen unusable on a phone.",
        "changes": [
            "Give the map its own height and make taps land on it",
            "Two independent defects made the parcel mapping screen unusable on a phone.",
            "strip became a competing flexible sibling and absorbed 237px of the portrait"
        ],
        "codeChanges": [
            "Updated app/(admin)/agribusiness/__tests__/mapping.test.tsx",
            "Updated app/(admin)/agribusiness/mapping.tsx",
            "Updated src/components/ParcelMap/MappingToolbar.tsx"
        ]
    },
    {
        "id": "ded4d038b63b3769ff0d98beabfa6445b0fd6cbb",
        "version": "ded4d03",
        "versionLabel": "Commit",
        "date": "2026-10-19",
        "title": "Dedicate the Playwright port and expose mock-auth mode to the runner",
        "category": "fix",
        "icon": "build-circle",
        "summary": "Two harness gaps made the mapping specs unrunnable through any documented or",
        "changes": [
            "Dedicate the Playwright port and expose mock-auth mode to the runner",
            "Two harness gaps made the mapping specs unrunnable through any documented or",
            "automated entry point."
        ],
        "codeChanges": [
            "Updated docs/MAPPING-MODULE.md",
            "Updated playwright.config.ts",
            "Updated scripts/playwright-web-port.regression.test.js"
        ]
    },
    {
        "id": "9b08d714060ea8d96d44c66f4dc80fa6204113e2",
        "version": "9b08d71",
        "versionLabel": "Commit",
        "date": "2026-10-18",
        "title": "Document EXPO_PUBLIC_APP_URL in the template",
        "category": "fix",
        "icon": "build-circle",
        "summary": "Companion to the release-origin fix: the template now records the canonical",
        "changes": [
            "Document EXPO_PUBLIC_APP_URL in the template",
            "Companion to the release-origin fix: the template now records the canonical",
            "origin that serves /download and /version.json, and notes that leaving it unset"
        ],
        "codeChanges": [
            "Updated .env.example"
        ]
    },
    {
        "id": "c902ef30688835c35c706569466262881ec5d002",
        "version": "c902ef3",
        "versionLabel": "Commit",
        "date": "2026-10-18",
        "title": "Allow the tracked .env.example template through pre-commit",
        "category": "fix",
        "icon": "build-circle",
        "summary": "The env guard matched every staged path starting with \".env\", which included",
        "changes": [
            "Allow the tracked .env.example template through pre-commit",
            "The env guard matched every staged path starting with \".env\", which included",
            ".env.example -- a tracked, secret-free template documented in AGENTS.md."
        ],
        "codeChanges": [
            "Updated scripts/__tests__/envStagingPolicy.test.js",
            "Updated scripts/changed-files-gate.mjs",
            "Updated scripts/lib/envStagingPolicy.js"
        ]
    },
    {
        "id": "ddd5ee76dd30ba7dead1c59a03f3149f9251a693",
        "version": "ddd5ee7",
        "versionLabel": "Commit",
        "date": "2026-10-18",
        "title": "Add a read-only remote schema-gap probe",
        "category": "data",
        "icon": "fact-check",
        "summary": "SyncService pushes every column the local tableSchema declares, so a single",
        "changes": [
            "Add a read-only remote schema-gap probe",
            "SyncService pushes every column the local tableSchema declares, so a single",
            "missing remote column makes PostgREST reject the whole batch (PGRST204/42703)"
        ],
        "codeChanges": [
            "Updated scripts/audit-remote-schema-gap.mjs",
            "Updated supabase/queries/prod-schema-gap-probe.sql"
        ]
    },
    {
        "id": "e9c50c70c4c922fca82f87c930e9d308d6dcb9dc",
        "version": "e9c50c7",
        "versionLabel": "Commit",
        "date": "2026-10-18",
        "title": "Keep cold deep links alive across a reload",
        "category": "fix",
        "icon": "build-circle",
        "summary": "Three independent things bounced a web reload to the dashboard: the root layout",
        "changes": [
            "Keep cold deep links alive across a reload",
            "Three independent things bounced a web reload to the dashboard: the root layout",
            "returning null while expo-font loaded, the admin gate replacing <Slot /> with"
        ],
        "codeChanges": [
            "Updated app/(admin)/_layout.tsx",
            "Updated app/_layout.tsx",
            "Updated src/store/AuthContext.tsx"
        ]
    },
    {
        "id": "d5d905509bede4d3b0ab3225b2f879d3c9268b81",
        "version": "d5d9055",
        "versionLabel": "Commit",
        "date": "2026-10-18",
        "title": "Default the release origin to Cloudflare Pages",
        "category": "fix",
        "icon": "build-circle",
        "summary": "PRODUCTION_APP_URL and every fallback default pointed at the Hetzner vhost,",
        "changes": [
            "Default the release origin to Cloudflare Pages",
            "PRODUCTION_APP_URL and every fallback default pointed at the Hetzner vhost,",
            "which serves no /download route (404) and a version.json frozen at 0.1.1, so"
        ],
        "codeChanges": [
            "Updated AGENTS.md",
            "Updated scripts/deploy-cloudflare.mjs",
            "Updated scripts/deploy-hetzner.mjs"
        ]
    },
    {
        "id": "ecf56656309c1549c7d93ba4e7f3fb187e476866",
        "version": "ecf5665",
        "versionLabel": "Commit",
        "date": "2026-10-17",
        "title": "Bump version to v0.1.5 build 6 and sync app updates",
        "category": "technical",
        "icon": "code",
        "summary": "Bump version to v0.1.5 build 6 and sync app updates",
        "changes": [
            "Bump version to v0.1.5 build 6 and sync app updates"
        ],
        "codeChanges": [
            "Updated app.json",
            "Updated package.json",
            "Updated src/constants/AppVersion.ts"
        ]
    },
    {
        "id": "c9ad2331ea46c5e58e442b982af7270067481a8f",
        "version": "c9ad233",
        "versionLabel": "Commit",
        "date": "2026-10-17",
        "title": "Add database schema migration verification to deploy-jetfarm",
        "category": "feature",
        "icon": "new-releases",
        "summary": "Add database schema migration verification to deploy-jetfarm",
        "changes": [
            "Add database schema migration verification to deploy-jetfarm"
        ],
        "codeChanges": [
            "Updated .agents/skills/deploy-jetfarm/SKILL.md"
        ]
    },
    {
        "id": "e1a068c8c40341c06132e8868f87907883464d40",
        "version": "e1a068c",
        "versionLabel": "Commit",
        "date": "2026-10-17",
        "title": "Add edit and delete actions across all agribusiness modules",
        "category": "feature",
        "icon": "new-releases",
        "summary": "Add edit and delete actions across all agribusiness modules",
        "changes": [
            "Add edit and delete actions across all agribusiness modules"
        ],
        "codeChanges": [
            "Updated app/(admin)/agribusiness/expenses.tsx",
            "Updated app/(admin)/agribusiness/harvest.tsx",
            "Updated app/(admin)/agribusiness/investors.tsx"
        ]
    },
    {
        "id": "c7dceeb29b6428c8f72f09d2074881836e1ab5b8",
        "version": "c7dceeb",
        "versionLabel": "Commit",
        "date": "2026-10-17",
        "title": "Parcel block division, monitoring panels, responsive layout, and mapping workflows",
        "category": "feature",
        "icon": "new-releases",
        "summary": "Parcel block division, monitoring panels, responsive layout, and mapping workflows",
        "changes": [
            "Parcel block division, monitoring panels, responsive layout, and mapping workflows"
        ],
        "codeChanges": [
            "Updated app/(admin)/_layout.tsx",
            "Updated app/(admin)/agribusiness/__tests__/cycles.test.tsx",
            "Updated app/(admin)/agribusiness/__tests__/laborBlockLinks.test.tsx"
        ]
    },
    {
        "id": "9027c974f5ee3ef8be338eff2d1144395df8d00a",
        "version": "9027c97",
        "versionLabel": "Commit",
        "date": "2026-10-16",
        "title": "Bump version to v0.1.4 (build 5) after deployment",
        "category": "technical",
        "icon": "code",
        "summary": "Bump version to v0.1.4 (build 5) after deployment",
        "changes": [
            "Bump version to v0.1.4 (build 5) after deployment"
        ],
        "codeChanges": [
            "Updated app.json",
            "Updated package.json",
            "Updated src/constants/AppVersion.ts"
        ]
    },
    {
        "id": "dc932802f77ed888fb5e4607b6218796c9cb1959",
        "version": "dc93280",
        "versionLabel": "Commit",
        "date": "2026-10-16",
        "title": "Sync generated app updates with latest commits",
        "category": "technical",
        "icon": "code",
        "summary": "Sync generated app updates with latest commits",
        "changes": [
            "Sync generated app updates with latest commits"
        ],
        "codeChanges": [
            "Updated src/constants/generatedAppUpdates.json",
            "Updated src/constants/generatedAppUpdates.ts"
        ]
    },
    {
        "id": "11ae100dcb7fc59e2749bbeb812460159847dc36",
        "version": "11ae100",
        "versionLabel": "Commit",
        "date": "2026-10-16",
        "title": "Farm workers module, growth health line graph, and universal transaction confirmation messages (fixes #4, #5, #6, #7)",
        "category": "feature",
        "icon": "new-releases",
        "summary": "Farm workers module, growth health line graph, and universal transaction confirmation messages (fixes #4, #5, #6, #7)",
        "changes": [
            "Farm workers module, growth health line graph, and universal transaction confirmation messages (fixes #4, #5, #6, #7)"
        ],
        "codeChanges": [
            "Updated app/(admin)/agribusiness/cycles.tsx",
            "Updated app/(admin)/agribusiness/expenses.tsx",
            "Updated app/(admin)/agribusiness/harvest.tsx"
        ]
    },
    {
        "id": "857a0b9cc18093a2f69808230456a9e46fd17378",
        "version": "857a0b9",
        "versionLabel": "Commit",
        "date": "2026-10-15",
        "title": "Implement Bacalso Farm schedule of implementation and P&L report (fixes #2, #3)",
        "category": "feature",
        "icon": "new-releases",
        "summary": "Implement Bacalso Farm schedule of implementation and P&L report (fixes #2, #3)",
        "changes": [
            "Implement Bacalso Farm schedule of implementation and P&L report (fixes #2, #3)"
        ],
        "codeChanges": [
            "Updated app/(admin)/agribusiness/expenses.tsx",
            "Updated app/(admin)/agribusiness/implementation-report.tsx",
            "Updated app/(admin)/agribusiness/index.tsx"
        ]
    },
    {
        "id": "3c40430ffab789650fb576f4f153748fccf6e161",
        "version": "3c40430",
        "versionLabel": "Commit",
        "date": "2026-10-15",
        "title": "Integrate planned vs actual farming steps and harden user activation (fixes #1, #2, #3)",
        "category": "feature",
        "icon": "new-releases",
        "summary": "Integrate planned vs actual farming steps and harden user activation (fixes #1, #2, #3)",
        "changes": [
            "Integrate planned vs actual farming steps and harden user activation (fixes #1, #2, #3)"
        ],
        "codeChanges": [
            "Updated app/(admin)/agribusiness/expenses.tsx",
            "Updated app/(admin)/agribusiness/index.tsx",
            "Updated app/(admin)/users/[id].tsx"
        ]
    },
    {
        "id": "a5f17f9082e8dd59b48bd9e886b34be48a5ab74e",
        "version": "a5f17f9",
        "versionLabel": "Commit",
        "date": "2026-10-15",
        "title": "Agribusiness, dynamic search bar, transfers, and tracing updates",
        "category": "feature",
        "icon": "new-releases",
        "summary": "Agribusiness, dynamic search bar, transfers, and tracing updates",
        "changes": [
            "Agribusiness, dynamic search bar, transfers, and tracing updates"
        ],
        "codeChanges": [
            "Updated app.json",
            "Updated app/(admin)/_layout.tsx",
            "Updated app/(admin)/agribusiness/expenses.tsx"
        ]
    },
    {
        "id": "db105e1e02cc52d185970c3db36806179d92e7ad",
        "version": "db105e1",
        "versionLabel": "Commit",
        "date": "2026-10-13",
        "title": "Update migration scripts, test assertions, and docs",
        "category": "technical",
        "icon": "code",
        "summary": "Update migration scripts, test assertions, and docs",
        "changes": [
            "Update migration scripts, test assertions, and docs"
        ],
        "codeChanges": [
            "Updated docs/JetFarm_Agribusiness_Outgrower_Platform.pptx",
            "Updated docs/images/agribusiness-analytics.png",
            "Updated docs/images/agribusiness-command-center.png"
        ]
    },
    {
        "id": "a837640a573fc0ab280c17bbc7905db73e18415e",
        "version": "a837640",
        "versionLabel": "Commit",
        "date": "2026-10-12",
        "title": "Release v0.1.2 — versioned APK installer JetFarm-v0.1.2.apk, fix CI/CD pipeline, Cloudflare Pages download redirects",
        "category": "fix",
        "icon": "build-circle",
        "summary": "Release v0.1.2 — versioned APK installer JetFarm-v0.1.2.apk, fix CI/CD pipeline, Cloudflare Pages download redirects",
        "changes": [
            "Release v0.1.2 — versioned APK installer JetFarm-v0.1.2.apk, fix CI/CD pipeline, Cloudflare Pages download redirects"
        ],
        "codeChanges": [
            "Updated .github/workflows/ci-cd.yml",
            "Updated .github/workflows/reusable-ci-cd.yml",
            "Updated app.json"
        ]
    },
    {
        "id": "6a18bd3d3f56f216dff832adf1ff4ec3cb94ac06",
        "version": "6a18bd3",
        "versionLabel": "Commit",
        "date": "2026-10-09",
        "title": "Oct 9 updates — loan applications, services, and tests",
        "category": "technical",
        "icon": "code",
        "summary": "Oct 9 updates — loan applications, services, and tests",
        "changes": [
            "Oct 9 updates — loan applications, services, and tests"
        ],
        "codeChanges": [
            "Updated app/(admin)/settings/index.tsx",
            "Updated app/(loan-encoder)/loan-applications/[id].tsx",
            "Updated app/(loan-encoder)/loan-applications/__tests__/[id].test.tsx"
        ]
    },
    {
        "id": "e70f982a1fb3914fc2c834ba3aa28abf5fbdb30e",
        "version": "e70f982",
        "versionLabel": "Commit",
        "date": "2026-10-08",
        "title": "Jetfarm_db schema isolation implementation plan",
        "category": "feature",
        "icon": "new-releases",
        "summary": "Jetfarm_db schema isolation implementation plan",
        "changes": [
            "Jetfarm_db schema isolation implementation plan"
        ],
        "codeChanges": [
            "Updated docs/superpowers/plans/2026-10-08-jetfarm-schema-isolation.md"
        ]
    },
    {
        "id": "4deaef068f775c859e3f3090c4337002a8f93f79",
        "version": "4deaef0",
        "versionLabel": "Commit",
        "date": "2026-10-08",
        "title": "Jetfarm_db schema isolation design (approach A clean cutover)",
        "category": "technical",
        "icon": "code",
        "summary": "Jetfarm_db schema isolation design (approach A clean cutover)",
        "changes": [
            "Jetfarm_db schema isolation design (approach A clean cutover)"
        ],
        "codeChanges": [
            "Updated docs/superpowers/specs/2026-10-08-jetfarm-schema-isolation-design.md"
        ]
    },
    {
        "id": "7e6cd4b8f1d1582b2b4958690ff9118b92865a19",
        "version": "7e6cd4b",
        "versionLabel": "Commit",
        "date": "2026-10-08",
        "title": "Give demo records deterministic uuid ids so sync pushes stop failing 22P02",
        "category": "fix",
        "icon": "build-circle",
        "summary": "Production remote tables (app_areas, app_borrowers, ws_customers, employees)",
        "changes": [
            "Give demo records deterministic uuid ids so sync pushes stop failing 22P02",
            "Production remote tables (app_areas, app_borrowers, ws_customers, employees)",
            "declare id UUID PRIMARY KEY; readable sample ids (\"sample-area-poblacion\")"
        ],
        "codeChanges": [
            "Updated app/_layout.tsx",
            "Updated src/services/SampleDataService.ts",
            "Updated src/services/__tests__/SampleDataService.test.ts"
        ]
    },
    {
        "id": "3a2400338332087dba05b773dd6d49452258d18d",
        "version": "3a24003",
        "versionLabel": "Commit",
        "date": "2026-10-06",
        "title": "Complete buildable plan artifacts (CI tier gate, marketplace posting tests, status log)",
        "category": "feature",
        "icon": "new-releases",
        "summary": "- .github/workflows/tier-gate.yml: classify PR diff into L0-L5 tiers,",
        "changes": [
            "Complete buildable plan artifacts (CI tier gate, marketplace posting tests, status log)",
            "- .github/workflows/tier-gate.yml: classify PR diff into L0-L5 tiers,",
            "label the PR, warn on L5 human-approval, upload evidence artifact"
        ],
        "codeChanges": [
            "Updated .github/workflows/tier-gate.yml",
            "Updated docs/AI-ASSISTED-DEV-WORKFLOW-PLAN.md",
            "Updated src/services/__tests__/MarketplaceSalesPostingService.test.ts"
        ]
    },
    {
        "id": "f70740a6b2f4ea294f660190606e95f054112090",
        "version": "f70740a",
        "versionLabel": "Commit",
        "date": "2026-10-06",
        "title": "Sync project updates",
        "category": "technical",
        "icon": "code",
        "summary": "Sync project updates",
        "changes": [
            "Sync project updates"
        ],
        "codeChanges": [
            "Updated src/hooks/__tests__/useObservedRecords.test.ts",
            "Updated src/hooks/useCollectionSheet.ts",
            "Updated src/hooks/useCollectorDashboard.ts"
        ]
    },
    {
        "id": "098052107b8b4975805b858d4e9b1b9db1074ce7",
        "version": "0980521",
        "versionLabel": "Commit",
        "date": "2026-10-06",
        "title": "Observe remittance totals instead of fetching on mount",
        "category": "fix",
        "icon": "build-circle",
        "summary": "Cash held and the recent remittance list were loaded by one effect that ran per",
        "changes": [
            "Observe remittance totals instead of fetching on mount",
            "Cash held and the recent remittance list were loaded by one effect that ran per",
            "mount, so the figures went stale while the collector was on the screen and an"
        ],
        "codeChanges": [
            "Updated app/(collector)/remittances.tsx",
            "Updated src/hooks/__tests__/useCollectorRemittance.test.ts",
            "Updated src/hooks/useCollectorRemittance.ts"
        ]
    },
    {
        "id": "6906312745d4d7a60cb3154cd14dc20a2367f0f3",
        "version": "6906312",
        "versionLabel": "Commit",
        "date": "2026-10-06",
        "title": "Ignore tar.gz archives at the repo root",
        "category": "technical",
        "icon": "code",
        "summary": "Pairs the untracking commit with the rule that keeps build archives from being",
        "changes": [
            "Ignore tar.gz archives at the repo root",
            "Pairs the untracking commit with the rule that keeps build archives from being",
            "staged again by the workspace-sync automation."
        ],
        "codeChanges": [
            "Updated .gitignore"
        ]
    },
    {
        "id": "0ab05ee0a7ccb5c2b39a6541ac062adff73f9169",
        "version": "0ab05ee",
        "versionLabel": "Commit",
        "date": "2026-10-06",
        "title": "Stop tracking the root build archive",
        "category": "technical",
        "icon": "code",
        "summary": "A 17 MB dist_update.tar.gz was swept into the workspace-sync commit and is now",
        "changes": [
            "Stop tracking the root build archive",
            "A 17 MB dist_update.tar.gz was swept into the workspace-sync commit and is now",
            "in published history, so every clone and deploy pull carries it."
        ],
        "codeChanges": [
            "Updated dist_update.tar.gz"
        ]
    },
    {
        "id": "aaf068df39af53c9e3163bc764c56ac4a2cfd399",
        "version": "aaf068d",
        "versionLabel": "Commit",
        "date": "2026-10-06",
        "title": "Sync project workspace",
        "category": "technical",
        "icon": "code",
        "summary": "Sync project workspace",
        "changes": [
            "Sync project workspace"
        ],
        "codeChanges": [
            "Updated app/(collector)/collection-sheet.tsx",
            "Updated app/(collector)/index.tsx",
            "Updated dist_update.tar.gz"
        ]
    },
    {
        "id": "8dc5a523f83355e43cdf8c7c6239f4ecfe79b1ee",
        "version": "8dc5a52",
        "versionLabel": "Commit",
        "date": "2026-10-04",
        "title": "Phase 1 AI-authored coverage for BusinessUnit, Dividend, CicFormatter",
        "category": "feature",
        "icon": "new-releases",
        "summary": "First AI test-authoring trial under docs/AI-ASSISTED-DEV-WORKFLOW-PLAN.md",
        "changes": [
            "Phase 1 AI-authored coverage for BusinessUnit, Dividend, CicFormatter",
            "First AI test-authoring trial under docs/AI-ASSISTED-DEV-WORKFLOW-PLAN.md",
            "Phase 1 (tests only, no production behavior changed):"
        ],
        "codeChanges": [
            "Updated src/__tests__/test-utils.ts",
            "Updated src/services/__tests__/BusinessUnitService.test.ts",
            "Updated src/services/__tests__/DividendService.test.ts"
        ]
    },
    {
        "id": "7d219fc3a75cdf146f764f299f9e7e8ffb6f96b3",
        "version": "7d219fc",
        "versionLabel": "Commit",
        "date": "2026-10-04",
        "title": "Phase 0 AI-workflow gates + checkpoint accumulated agribusiness/settings work",
        "category": "data",
        "icon": "fact-check",
        "summary": "Adds the AI-assisted development workflow foundation from",
        "changes": [
            "Phase 0 AI-workflow gates + checkpoint accumulated agribusiness/settings work",
            "Adds the AI-assisted development workflow foundation from",
            "docs/AI-ASSISTED-DEV-WORKFLOW-PLAN.md:"
        ],
        "codeChanges": [
            "Updated .agents/login.f85c06c.tsx",
            "Updated .agents/login.old.tsx",
            "Updated .agents/skills/deploy-jetfarm/SKILL.md"
        ]
    },
    {
        "id": "35bef44bfc5df52e6b47005c66067d51202f2ff8",
        "version": "35bef44",
        "versionLabel": "Commit",
        "date": "2026-09-26",
        "title": "Complete B7-Ultra quality gate, enterprise accounting, and deployment hardening",
        "category": "feature",
        "icon": "new-releases",
        "summary": "Complete B7-Ultra quality gate, enterprise accounting, and deployment hardening",
        "changes": [
            "Complete B7-Ultra quality gate, enterprise accounting, and deployment hardening"
        ],
        "codeChanges": [
            "Updated app.json",
            "Updated app/(admin)/_layout.tsx",
            "Updated app/(admin)/accounting/index.tsx"
        ]
    },
    {
        "id": "97c0bb9cdc20398a178fd9246a65028b07bed020",
        "version": "97c0bb9",
        "versionLabel": "Commit",
        "date": "2026-09-18",
        "title": "Staging migrations, cloudflare deploy scripts, and safety tests",
        "category": "feature",
        "icon": "new-releases",
        "summary": "Staging migrations, cloudflare deploy scripts, and safety tests",
        "changes": [
            "Staging migrations, cloudflare deploy scripts, and safety tests"
        ],
        "codeChanges": [
            "Updated .agents/skills/deploy-jetfarm/SKILL.md",
            "Updated .agents/skills/testing/SKILL.md",
            "Updated AGENTS.md"
        ]
    },
    {
        "id": "fb14cb953cfb722b4d6f2c326bb6e806146f731a",
        "version": "fb14cb9",
        "versionLabel": "Commit",
        "date": "2026-09-12",
        "title": "Add agribusiness outgrower platform with models, services, migrations, and UI views",
        "category": "feature",
        "icon": "new-releases",
        "summary": "Add agribusiness outgrower platform with models, services, migrations, and UI views",
        "changes": [
            "Add agribusiness outgrower platform with models, services, migrations, and UI views"
        ],
        "codeChanges": [
            "Updated app/(admin)/_layout.tsx",
            "Updated app/(admin)/agribusiness/analytics.tsx",
            "Updated app/(admin)/agribusiness/cycles.tsx"
        ]
    },
    {
        "id": "1408367cd9da3362ca6e0f9b87738b53e206b5d2",
        "version": "1408367",
        "versionLabel": "Commit",
        "date": "2026-09-11",
        "title": "Initial project bootstrap — cleanly decoupled from template with isolated Docker stack",
        "category": "technical",
        "icon": "code",
        "summary": "Initial project bootstrap — cleanly decoupled from template with isolated Docker stack",
        "changes": [
            "Initial project bootstrap — cleanly decoupled from template with isolated Docker stack"
        ],
        "codeChanges": [
            "Updated .agents/login.f85c06c.tsx",
            "Updated .agents/login.old.tsx",
            "Updated .agents/skills/AddCoopModule/SKILL.md"
        ]
    }
];
