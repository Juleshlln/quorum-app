const BUSINESS_IMPACT_SCHEMA_PATTERNS = [
  "Could not find the table 'public.traffic_daily_page_metrics' in the schema cache",
  "Could not find the table 'public.analytics_connections' in the schema cache",
  "Could not find the table 'public.ai_attribution_events' in the schema cache",
  "Could not find the table 'public.brand_search_daily' in the schema cache",
  'schema cache',
  'relation "public.traffic_daily_page_metrics" does not exist',
  'relation "public.analytics_connections" does not exist',
  'relation "public.ai_attribution_events" does not exist',
  'relation "public.brand_search_daily" does not exist',
];

export function isBusinessImpactSchemaMissingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return BUSINESS_IMPACT_SCHEMA_PATTERNS.some((pattern) => message.includes(pattern));
}

export function getBusinessImpactMigrationHelp() {
  return {
    command: 'npm run db:migrate',
    migrationFile: 'supabase/migrations/023_business_impact_competitive_intelligence.sql',
  };
}
