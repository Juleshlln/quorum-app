# Business Impact & Competitive Intelligence

## Scope
This module adds a business layer on top of Quorum's existing AI visibility monitoring.

It distinguishes three concepts on purpose:

- `observed AI traffic`: sessions whose analytics source / medium matches a maintained AI-source detection config
- `assisted / inferred AI impact`: a probabilistic estimate derived from post-citation traffic lift after removing directly observed AI sessions
- `competitive intelligence insights`: answer-share, source-share and gap analysis derived from prompts, citations and competitor mappings

## Architecture

### 1. Data layer
- Migration: [`supabase/migrations/023_business_impact_competitive_intelligence.sql`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/supabase/migrations/023_business_impact_competitive_intelligence.sql)
- New tables:
  - `analytics_connections`
  - `traffic_daily_page_metrics`
  - `ai_attribution_events`
  - `brand_search_daily`
- Generated typing was mirrored manually in [`src/types/database.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/types/database.ts) because the local task flow does not rely on a live Supabase type generation step.

### 2. Connector layer
- Connector registry: [`src/lib/integrations/analytics/registry.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/lib/integrations/analytics/registry.ts)
- GA4 connector: [`src/lib/integrations/analytics/ga4.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/lib/integrations/analytics/ga4.ts)
- GSC connector: [`src/lib/integrations/analytics/gsc.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/lib/integrations/analytics/gsc.ts)
- Matomo scaffold: [`src/lib/integrations/analytics/matomo.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/lib/integrations/analytics/matomo.ts)
- Credentials are encrypted at rest with AES-256-GCM in [`src/lib/integrations/analytics/crypto.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/lib/integrations/analytics/crypto.ts)
- Google auth uses either:
  - service account JSON
  - access-token payloads

### 3. Ingestion and attribution
- Sync orchestration: [`src/lib/business-impact/sync.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/lib/business-impact/sync.ts)
- Attribution engine: [`src/lib/business-impact/attribution.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/lib/business-impact/attribution.ts)
- AI traffic detection config: [`src/lib/business-impact/traffic-classification.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/lib/business-impact/traffic-classification.ts)

Flow:
1. Connect GA4 / GSC credentials through API routes.
2. Sync page traffic and brand search rows into Supabase.
3. Rebuild attribution events from existing Quorum citations plus synced traffic.
4. Serve business-impact and competitive-intelligence dashboards from read-focused services.

### 4. Read services and APIs
- Read services: [`src/lib/business-impact/service.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/lib/business-impact/service.ts)
- Connect routes:
  - [`src/app/api/integrations/ga4/connect/route.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/app/api/integrations/ga4/connect/route.ts)
  - [`src/app/api/integrations/gsc/connect/route.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/app/api/integrations/gsc/connect/route.ts)
- Business-impact routes:
  - [`src/app/api/business-impact/overview/route.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/app/api/business-impact/overview/route.ts)
  - [`src/app/api/business-impact/pages/route.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/app/api/business-impact/pages/route.ts)
  - [`src/app/api/business-impact/attribution/route.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/app/api/business-impact/attribution/route.ts)
- Competitive-intelligence routes:
  - [`src/app/api/competitive-intelligence/overview/route.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/app/api/competitive-intelligence/overview/route.ts)
  - [`src/app/api/competitive-intelligence/prompts/route.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/app/api/competitive-intelligence/prompts/route.ts)
  - [`src/app/api/competitive-intelligence/sources/route.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/app/api/competitive-intelligence/sources/route.ts)
  - [`src/app/api/competitive-intelligence/opportunities/route.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/app/api/competitive-intelligence/opportunities/route.ts)
- Automated cron:
  - [`src/app/api/cron/business-impact/route.ts`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/app/api/cron/business-impact/route.ts)

### 5. UI
- Business Impact page: [`src/app/(dashboard)/business-impact/page.tsx`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/app/(dashboard)/business-impact/page.tsx)
- Competitive Intelligence page: [`src/app/(dashboard)/competitive-intelligence/page.tsx`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/app/(dashboard)/competitive-intelligence/page.tsx)
- Main UI components live under:
  - [`src/components/business-impact`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/components/business-impact)
  - [`src/components/competitive-intelligence`](/Users/juleshalluin/Library/CloudStorage/OneDrive-SKEMABusinessSchool/Quorum/quorum-mvp/src/components/competitive-intelligence)

## Transparent formulas

### Observed AI traffic
`observed_ai_sessions` is the sum of `traffic_daily_page_metrics.sessions` for rows whose `source` or `medium` matches the versioned AI regex config.

### Conversions / revenue observed
Observed conversions and revenue are prorated using the observed AI share on the cited page for the same day:

`observed share = observed_ai_sessions / total_page_sessions`

`conversions_observed = page_conversions * observed share`

`revenue_observed = page_revenue * observed share`

### Assisted sessions estimate
The engine intentionally avoids double-counting direct AI sessions:

`post_citation_lift = max(total_sessions - baseline_sessions - observed_ai_sessions, 0)`

`assisted_sessions_estimate = post_citation_lift * visibility_weight * citation_weight`

In code the weights are explicit, bounded and documented. This is an estimate, not deterministic attribution.

### Confidence
- `high`: citation + observed AI traffic + historical baseline + enough citation density
- `medium`: at least one direct or inferential signal
- `low`: directional only

## Assumptions
- Current v1 supports Google service-account credentials or explicit access-token payloads.
- GA4 uses `landingPagePlusQueryString`, `sessionSource`, `sessionMedium`, `sessions`, `totalUsers`, `engagedSessions`, `conversions`, `totalRevenue`.
- GSC v1 fetches `date + query` rows then filters brand terms locally.
- Competitive intelligence reuses Quorum's current `prompt_runs`, `citations`, `sources_domains`, `sources_urls`, `competitors`, `monitoring_prompts`, `monitoring_topics`.

## Known limitations
- OAuth refresh flows and UI-based Google consent are not implemented yet.
- Matomo is scaffolded only.
- GSC local filtering can miss long-tail branded queries if the API row limit truncates the dataset.
- `traffic_daily_page_metrics` is page-day-source based, so attribution stays page-level and not user-level.
- The assisted model is deliberately conservative and should be read as directional evidence.
- Competitive metrics depend on the quality of competitor mappings already present in `competitors` and `sources_domains`.

## TODOs
- Implement Matomo ingestion.
- Add refresh-token support for Google OAuth credentials.
- Add persisted sync job logs and sync health cards in the dashboard.
- Add filters by model, topic and prompt cohort in the new pages.
- Optionally materialize competitive intelligence snapshots if query volume grows.
