-- Migration: 020_reject_generic_probable_citations
-- Defence-in-depth: DB-level trigger that rejects probable citations from
-- generic domains, regardless of the application code path.
-- Also cleans up corrupted fallback data from 2026-02-21.

/* ══════════════════════════════════════════════════════════════════════ */
/*  1. Trigger: reject generic probable citations at INSERT time         */
/* ══════════════════════════════════════════════════════════════════════ */

CREATE OR REPLACE FUNCTION reject_generic_probable_citations()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.method = 'probable' AND EXISTS (
    SELECT 1
    FROM sources_urls su
    JOIN sources_domains sd ON sd.id = su.domain_id
    WHERE su.id = NEW.url_id
      AND sd.domain_normalized IN (
        'wikipedia.org',
        'reddit.com',
        'youtube.com',
        'medium.com',
        'g2.com',
        'capterra.com',
        'trustpilot.com',
        'linkedin.com'
      )
  ) THEN
    RAISE EXCEPTION 'Rejected: probable citation on generic domain (trigger 020)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reject_generic_probable ON citations;
CREATE TRIGGER trigger_reject_generic_probable
  BEFORE INSERT ON citations
  FOR EACH ROW
  EXECUTE FUNCTION reject_generic_probable_citations();

/* ══════════════════════════════════════════════════════════════════════ */
/*  2. Cleanup: delete corrupted fallback citations from 2026-02-21      */
/* ══════════════════════════════════════════════════════════════════════ */

DELETE FROM citations
WHERE project_id = '747816f2-bd89-4c98-94b6-af070834c6c3'
  AND cited_at >= '2026-02-21T00:00:00Z'
  AND cited_at <  '2026-02-22T00:00:00Z'
  AND is_fallback = true;
