import type { TrafficClassification } from '@/lib/business-impact/types';

export const AI_TRAFFIC_DETECTION_VERSION = '2026-04-08.ai-traffic-v2';

export const AI_TRAFFIC_SOURCE_CONFIG = {
  version: AI_TRAFFIC_DETECTION_VERSION,
  patterns: [
    { key: 'chatgpt', regex: /\bchatgpt\b/i },
    { key: 'openai', regex: /\bopenai\b/i },
    { key: 'perplexity', regex: /\bperplexity\b/i },
    { key: 'claude', regex: /\bclaude\b/i },
    { key: 'anthropic', regex: /\banthropic\b/i },
    { key: 'gemini', regex: /\bgemini\b/i },
    { key: 'bard', regex: /\bbard\b/i },
    { key: 'copilot', regex: /\bcopilot\b/i },
    { key: 'bing', regex: /\bbing\s*chat\b|\bbing\s*copilot\b|\bchat\.bing\b/i },
    { key: 'you.com', regex: /\byou\.com\b/i },
    { key: 'duck.ai', regex: /\bduck\.ai\b|\bduckduckgo\s*ai\b/i },
  ],
} as const;

const UNKNOWN_TOKENS = new Set([
  '',
  '(direct)',
  'direct',
  '(none)',
  'none',
  '(not set)',
  'not set',
  'unassigned',
]);

export type TrafficClassificationResult = {
  classification: TrafficClassification;
  matchedSource: string | null;
};

function normalizeSignal(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

export function classifyTrafficSource(input: {
  source?: string | null;
  medium?: string | null;
}) : TrafficClassificationResult {
  const source = normalizeSignal(input.source);
  const medium = normalizeSignal(input.medium);
  const haystack = `${source} ${medium}`.trim();

  for (const pattern of AI_TRAFFIC_SOURCE_CONFIG.patterns) {
    if (pattern.regex.test(haystack)) {
      return {
        classification: 'ai_observed',
        matchedSource: pattern.key,
      };
    }
  }

  if (UNKNOWN_TOKENS.has(source) && UNKNOWN_TOKENS.has(medium)) {
    return {
      classification: 'unknown',
      matchedSource: null,
    };
  }

  return {
    classification: haystack ? 'non_ai' : 'unknown',
    matchedSource: null,
  };
}
