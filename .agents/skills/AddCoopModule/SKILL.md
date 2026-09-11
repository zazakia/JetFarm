---
name: AddCoopModule
description: Guide for adding a new business unit module (e.g. Agri-store, Pharmacy, Transport) under the Multi-Purpose Cooperative framework in POSCursor.
---

# AddCoopModule Skill

This skill guides the agent in adding new business unit modules (segments) to the cooperative app.

## How to use this skill
Whenever the user asks to "add a new business", "create a new module", "integrate pharmacy/agri-store/jeepney business", activate this skill.

## Step-by-Step Execution Plan

### 1. Scaffold the Module Files
Run the scaffold script directly from the terminal to create directories, manifest, default services, and register the module:
```bash
node scripts/scaffold-module.mjs --name "YOUR_BUSINESS_NAME" --slug "your-business-slug" --coaCode "YOUR_COA_PREFIX"
```

### 2. Define Custom Schema & Migration (WatermelonDB/Supabase Offline-First)
If the business needs extra tables (like product inventory, bookings, etc.):
- Add the tables to the WatermelonDB schema in `src/database/schema.ts` (increment version).
- Register the models in `src/database/index.ts` and `src/database/index.web.ts`.
- Append the creation steps in `src/database/migrations.ts`.
- Create a corresponding Supabase SQL migration file under `supabase/migrations/` using the template created by the scaffolder.

### 3. Implement Custom Logic & Services
- Write the services under `src/modules/your-business-slug/services/`.
- Ensure all financial transactions call `ModuleAccountingBridge.postModuleEntry(...)` using the custom asset, income, and expense accounts declared in your manifest.

### 4. Create UI Screens
- Design dashboard and forms using Expo Router under `app/(admin)/modules/your-business-slug/` using NativeWind v4 classNames.
- Match existing UI design aesthetics (sleek cards, rounded borders, clean loading indicators).

### 5. Verify & Run Tests
- Add unit tests for your services under `src/modules/your-business-slug/__tests__/`.
- Run the unit test suite: `npx jest src/modules/your-business-slug`
- Verify that standard MFI tests do not fail.
