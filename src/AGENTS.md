# src/

## OVERVIEW
Main application source code. 165 files across 10 subdirectories covering business logic, database layer, UI components, hooks, stores, and utilities.

## STRUCTURE
```
src/
├── components/     # Reusable UI (33 files)
├── services/       # Business logic services (20) - see services/AGENTS.md
├── database/       # WatermelonDB schema + models (29 files)
├── hooks/          # Custom React hooks (4)
├── store/          # Auth context (AuthContext.tsx)
├── stores/         # Zustand: authStore, syncStore
├── utils/          # Utility functions (12 files)
├── constants/      # roles, colors, app updates (4 files)
└── __tests__/      # Shared test utilities
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Business logic | `services/` |
| Database models/schema | `database/` |
| UI building blocks | `components/` |
| Custom hooks | `hooks/` |
| Auth state | `store/AuthContext.tsx` |
| Sync state | `stores/syncStore.ts` |
| Utilities | `utils/` |

## KEY FILES
- `database/index.ts` - WatermelonDB initialization with all models registered
- `database/schema.ts` - App schema version 25, 19 tables
- `database/supabase.ts` - Supabase client singleton
- `store/AuthContext.tsx` - Auth provider wrapping the entire app
- `stores/syncStore.ts` - Sync status via Zustand
- `constants/roles.ts` - Role definitions used across the app

## CONVENTIONS
- Services: classes with static methods, no instantiation
- Components: React Native + NativeWind (`className` props)
- Models: WatermelonDB decorators (`@field`, `@date`, `@relation`)
- Hooks: return `{ data, loading, error }` pattern
- Files use kebab-case for services/utils, PascalCase for components/models
