// Smoke test: calls the bovi actor and verifies schema mapping, source values,
// and 1-day filter behavior against real data.
// Run: node --env-file=.env.local --import=tsx scripts/smoke-bovi.ts

import { BOVI_MAX_AGE_MS } from "../lib/jobs/scrape";

void (async () => {
const token = process.env.APIFY_API_KEY;
if (!token) {
  console.error("APIFY_API_KEY is not set in environment");
  process.exit(1);
}
const now = Date.now();

console.log("=== Bovi Actor Smoke Test ===");
console.log(`Now: ${new Date(now).toISOString()}`);
console.log();

// 1. Call the actor directly (onlyNewSinceLastRun:false so we get data)
console.log("Fetching from Apify...");
const endpoint = `https://api.apify.com/v2/acts/GeQK0uepRsjeAVzne/run-sync-get-dataset-items?token=${token}&timeout=300&memory=512&maxTotalChargeUsd=0.1`;

const res = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    includeDescriptions: true,
    onlyNewSinceLastRun: false,
    presetLists: ["top-tech", "ai-ml", "devtools", "fintech"],
    remoteOnly: true,
    maxJobsPerCompany: 50,
    outputProfile: "full",
  }),
  signal: AbortSignal.timeout(310_000),
});

if (!res.ok) {
  const body = await res.text();
  throw new Error(`Apify returned ${res.status}: ${body.slice(0, 500)}`);
}
const items = (await res.json()) as Record<string, unknown>[];
console.log(`Raw items: ${items.length}`);
console.log();

// 2. Show field names & types from first item
if (items.length === 0) {
  console.log("No items returned. Check actor configuration.");
  return;
}

const first = items[0];
console.log("Field names & types (first item):");
for (const [k, v] of Object.entries(first)) {
  const type = v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
  const preview = type === "string" ? ` (${(v as string).length} chars)` : "";
  console.log(`  ${k}: ${type}${preview}`);
}
console.log();

// 3. ATS source distribution
const atsValues = new Map<string, number>();
for (const item of items) {
  const ats = (item.ats as string) ?? "unknown";
  atsValues.set(ats, (atsValues.get(ats) ?? 0) + 1);
}
console.log("ATS source distribution:");
for (const [ats, count] of [...atsValues].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${ats}: ${count}`);
}
console.log();

// 4. Date freshness — apply the same filter scrapeApifyBovi() uses
let fresh = 0, stale = 0, unparseable = 0;
for (const item of items) {
  const postedAt = (item.posted_at as string) ?? "";
  const postedMs = new Date(postedAt).getTime();
  if (isNaN(postedMs)) {
    unparseable++;
  } else if (postedMs < now - BOVI_MAX_AGE_MS) {
    stale++;
  } else {
    fresh++;
  }
}
console.log("Freshness (1-day filter):");
console.log(`  fresh:        ${fresh}`);
console.log(`  stale:        ${stale} (would be skipped)`);
console.log(`  unparseable:  ${unparseable} (would pass through)`);
console.log();

// 5. Date samples
const dates = items
  .map(i => ({ ats: (i.ats as string) ?? "?", posted: (i.posted_at as string) ?? "" }))
  .filter(d => d.posted);
console.log("Date samples (first 5, with age):");
for (const d of dates.slice(0, 5)) {
  const ageH = Math.round((now - new Date(d.posted).getTime()) / 3600_000);
  console.log(`  [${d.ats}] ${d.posted} (${ageH}h ago)`);
}
console.log();

// 6. Verify our mapping fields are all present
const required = ["ats", "company", "title", "url", "posted_at", "global_id"];
console.log("Required field coverage:");
for (const field of required) {
  const missing = items.filter(i => !i[field]);
  const status = missing.length === 0 ? "✓" : `✗ ${missing.length} missing`;
  console.log(`  ${field}: ${status}`);
}

// 7. Check for fields we didn't expect (schema drift)
const expected = new Set([
  "ats", "company", "title", "location", "remote", "remote_type",
  "department", "team", "employment_type", "seniority", "salary",
  "url", "apply_url", "posted_at", "job_id", "global_id",
  "description_text", "description_html", "scraped_at",
]);
const unexpected = Object.keys(first).filter(k => !expected.has(k));
if (unexpected.length > 0) {
  console.log(`\nUnexpected fields (schema drift?): ${unexpected.join(", ")}`);
} else {
  console.log("\n✓ All fields match expected schema");
}

console.log();
console.log("Done.");
})();
