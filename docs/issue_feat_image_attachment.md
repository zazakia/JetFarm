### 🚀 Feature: Field Image & Receipt Attachment with 30-Day Auto-Prune

#### 📝 Summary of Implementation
- **Growth Stage & Crop Health Check-ins** (`cycles.tsx`): Attached field condition photos to `AgriGrowthCheckin` with Camera and Gallery selection.
- **Harvest Weigh-In** (`harvest.tsx`): Attached weigh-in slips and batch photos to `AgriHarvestLog`.
- **Farm Expenses** (`expenses.tsx`): Added dedicated receipt photo picker alongside existing official invoice text reference.
- **Reusable Component** (`src/components/ImagePickerField.tsx`): Camera/gallery picker modal with empty, thumbnail, and offline pending upload states.
- **Upload Service** (`src/services/AgriImageUploadService.ts`): Compressed image uploads (~100–200 KB) targeting `farm-photos` bucket in Supabase Storage with offline fallback to local file URIs.
- **30-Day Auto-Prune & Storage Protection** (`supabase/migrations/20261023120000_farm_photos_bucket_and_30d_prune.sql`): Scheduled `pg_cron` daily midnight cleanup of storage objects older than 30 days while preserving local database records.
- **Pruning CLI Script** (`scripts/cleanup-farm-photos.mjs`): On-demand and dry-run cleanup tool for storage bucket objects.

#### 🧪 Quality Gates & Verification Evidence
- [x] **TypeScript**: 0 errors (`npx tsc --noEmit`)
- [x] **ESLint & NativeWind**: 0 errors (`npm run lint`)
- [x] **Targeted Unit Tests**: 21/21 passing (`AgriImageUploadService`, `ImagePickerField`, `cycles`, `AgriHarvestService`)
- [x] **Production Web Export**: Clean build bundle generated (`npm run export:web`)
