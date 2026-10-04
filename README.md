# JetFarm

React Native Expo agribusiness outgrower operations, contract farming management, and agri-finance platform for offline-first rural agricultural cooperatives.

## Key Features
- **Outgrower & Contract Farming**: Farmer master profiles, land parcel geolocation, crop cycle scheduling, and planting season commitments.
- **Agricultural Input Disbursements**: Track advances of certified seeds, fertilizers, and crop protection chemicals with loan repayment offset agreements.
- **Harvest Intake & Buying Station**: Digital weighbridge scale integration, moisture/quality grading, receiving receipts, and gross payout calculations.
- **Net Harvest Settlement**: Automatic deduction of input loans, cash advances, and cooperative development fees from crop delivery gross proceeds.
- **Multi-Role Support**: Admin, Field Technician, Agronomist, Buying Station Operator, Cashier, and Outgrower Farmer Portal.
- **Offline-First Persistence**: Local WatermelonDB writes in remote farm locations; bidirectional Supabase sync when mobile network or Wi-Fi is available.
- **Enterprise Accounting**: Accounts Receivable, Accounts Payable, General Ledger, and Agricultural Crop Cycle Financial Statements in Philippine Peso (`₱` / `PHP`).
- **Quality Gates (B7-Ultra)**: 206 test suites, 1635 unit/parity tests (100% pass), and zero arbitrary NativeWind hex colors.

## Tech Stack
| Component | Technology |
| --- | --- |
| Framework | Expo SDK 55 |
| Language | TypeScript |
| Local database | WatermelonDB |
| Backend | Supabase (Postgres + Auth) |
| Routing | Expo Router |
| State management | React Context for auth/session, Zustand for sync telemetry |
| Forms | React Hook Form + Zod |
| Styling | NativeWind |

## Project Structure
```text
.
|-- app/                # Expo Router screens and role-based route groups
|-- src/
|   |-- components/     # Reusable UI components
|   |-- constants/      # Shared constants and role metadata
|   |-- database/       # WatermelonDB setup, schema, models, migrations
|   |-- hooks/          # App hooks such as network monitoring
|   |-- services/       # Domain and integration services
|   |-- store/          # React auth/session context
|   |-- stores/         # Zustand stores (sync telemetry, legacy auth store)
|   `-- utils/          # Helpers and formatting utilities
|-- docs/               # Project and operational documentation
|-- scripts/            # Local maintenance, import, verification, and repair scripts
|-- supabase/           # Local Supabase config and migrations
`-- tests/              # Playwright end-to-end flows
```

## Documentation
- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Developer Guide](./docs/DEVELOPER_GUIDE.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Data Management](./docs/DATA_MANAGEMENT.md)
- [Technical Reference](./docs/DOCUMENTATION.md)

## Getting Started
### Prerequisites
- Node.js 18+
- npm
- Expo-compatible Android emulator/device if testing native
- Docker Desktop if using local Supabase

### Install
```bash
npm install
```

### Environment Setup
Use `.env.local` for local development. Production credentials belong in `.env.production`.

Example local setup:
```env
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:45421
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_local_or_remote_anon_key
EXPO_PUBLIC_SUPABASE_DB_PASSWORD=postgres
SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key
```

Env precedence in local scripts is:
1. `.env.local`
2. `.env.<NODE_ENV>.local`
3. `.env.<NODE_ENV>`
4. `.env`

### Local Supabase
Start the local stack before local app work:
```bash
npx supabase start
```

Repo-local default ports:
- API: `http://127.0.0.1:45421`
- DB: `127.0.0.1:45422`
- Studio: `http://127.0.0.1:45423`

### Running the App
```bash
npm run start:local
npm run android
npm run web:local
npm run ios
```

## Testing
```bash
npm test
npx playwright test
```

## Logout Behavior
Normal logout ends the Supabase session but preserves the local WatermelonDB data. Destructive local resets are explicit maintenance actions and should not be tied to routine sign-out.

## License
Private - INFINITY FINANCE. All rights reserved.
