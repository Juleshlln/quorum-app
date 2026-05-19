# Daily Export (CSV + Daily GEO Audit PDF)

## Additional technical docs
- Business Impact & Competitive Intelligence: [`README.business-impact.md`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/README.business-impact.md)

## What is included
- DB migration: `supabase/migrations/022_report_exports.sql`
- New API routes:
  - `POST /api/exports/create`
  - `GET /api/exports?projectId=...`
  - `GET /api/exports/:id/download`
- Export engine: `src/lib/exports/daily-export.ts`
- UI integration in Sources page: `src/components/sources/sources-hub.tsx`

## Required environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALGO_VERSION` (optional, defaults to `v1.0.0`)

## PDF generation dependency
Install Playwright for server-side HTML -> PDF:

```bash
npm install playwright
```

If Playwright is missing, PDF export returns a failed status with an explicit error.

## Usage
1. Run DB migration (`supabase db push` or your migration pipeline).
2. Open `Sources` page.
3. In `Daily Exports`, select a run/date.
4. Click `CSV` or `Audit PDF`.
5. When status is `done`, click `Download`.

## Security model
- API verifies `projects.user_id = auth.uid()` before export creation/download.
- Files are stored in private Supabase bucket `reports`.
- Download is via signed URL generated server-side.
- Export history is stored in `report_exports` with statuses (`queued`, `generating`, `done`, `failed`).
