#!/usr/bin/env node
/**
 * Manual test script for the daily monitoring run.
 * Triggers the /api/cron/daily-run endpoint and displays the result.
 *
 * Usage:
 *   node scripts/test-daily-run.mjs                      # localhost:3000
 *   SITE_URL=https://your-app.vercel.app node scripts/test-daily-run.mjs
 *   SITE_URL=https://your-app.vercel.app CRON_SECRET=xxx node scripts/test-daily-run.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Load .env.local for local testing
const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
  console.log('✅ Loaded .env.local');
}

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ── Pre-flight checks ────────────────────────────────────────────────────────
console.log('\n=== Pre-flight checks ===');
console.log(`SITE_URL       : ${SITE_URL}`);
console.log(`CRON_SECRET    : ${CRON_SECRET ? `${CRON_SECRET.slice(0, 8)}…` : '❌ MISSING'}`);
console.log(`OPENAI_API_KEY : ${OPENAI_API_KEY ? `${OPENAI_API_KEY.slice(0, 10)}…` : '❌ MISSING'}`);

if (!CRON_SECRET) {
  console.error('\n❌ CRON_SECRET is not set. Set it in .env.local or as an env var.');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.warn('\n⚠️  OPENAI_API_KEY not set locally — the server must have it.');
}

// ── Call the endpoint ────────────────────────────────────────────────────────
const url = `${SITE_URL.replace(/\/$/, '')}/api/cron/daily-run`;
console.log(`\n=== Calling ${url} ===`);

const startMs = Date.now();
let httpStatus = 0;
let body = '';

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CRON_SECRET}`,
    },
    signal: AbortSignal.timeout(310_000), // 310s (maxDuration is 300s)
  });
  httpStatus = res.status;
  body = await res.text();
} catch (err) {
  console.error(`\n❌ Fetch failed: ${err.message}`);
  process.exit(1);
}

const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
console.log(`\nHTTP ${httpStatus}  (${elapsed}s)`);

// ── Parse and display result ─────────────────────────────────────────────────
let json;
try {
  json = JSON.parse(body);
} catch {
  console.log('Raw response:', body);
  process.exit(httpStatus >= 400 ? 1 : 0);
}

console.log('\n=== Response ===');
console.log(JSON.stringify(json, null, 2));

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n=== Summary ===');
if (httpStatus < 200 || httpStatus >= 300) {
  console.error(`❌ HTTP ${httpStatus} — run failed`);
  process.exit(1);
}

const results = json.results || [];
let totalSuccess = 0;
let totalFailed = 0;

for (const r of results) {
  const icon = r.error ? '❌' : r.skipped ? '⏭️' : '✅';
  const detail = r.skipped
    ? 'skipped (already ran today)'
    : r.error
    ? `ERROR: ${r.error}`
    : `runs=${r.runs ?? 0}  answers=${r.answers ?? 0}`;
  console.log(`  ${icon} project=${r.project_id}  ${detail}`);
  totalSuccess += r.answers ?? 0;
  if (r.error) totalFailed++;
}

console.log(`\nTotal AI answers : ${totalSuccess}`);
console.log(`Failed projects  : ${totalFailed}`);
console.log(`Status           : ${json.status}`);

if (totalSuccess === 0 && !results.every(r => r.skipped)) {
  console.error('\n❌ All items failed (answers=0). Check OPENAI_API_KEY and Vercel env vars.');
  process.exit(1);
}

console.log('\n✅ Done');
