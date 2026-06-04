/**
 * Dumps real jobs from Redis and real subscribers from Resend as test fixture data.
 *
 * Run: node --env-file=.env.local node_modules/.bin/tsx scripts/dump-test-data.ts
 *
 * Output: JSON on stdout containing up to 5 jobs and up to 5 subscribers
 * with diverse preferences — ready to paste into a test fixture module.
 */

import { getJobsSince } from "../lib/jobs/store";
import { listActiveContacts } from "../lib/contacts";
import { stripTimezone, extractTimezone } from "../lib/jobs/normalize";
import type { StructuredJob, Subscriber } from "../lib/jobs/types";

async function main() {
  // ── Fetch jobs from Redis (last 48h) ────────────────────────────────────
  const since = Date.now() - 48 * 60 * 60 * 1000;
  const rawJobs = await getJobsSince(since);
  console.error(`Fetched ${rawJobs.length} jobs from Redis`);

  // Pick 5 jobs with diverse characteristics: different geoScopes, workModes,
  // location restrictions, salary presence, and skill sets.
  const pickedJobs: StructuredJob[] = [];
  const seenGeo: Set<string> = new Set();
  const seenWorkMode: Set<string> = new Set();

  for (const job of rawJobs) {
    if (pickedJobs.length >= 5) break;
    const key = `${job.geoScope}|${job.workMode}`;
    if (seenGeo.has(job.geoScope) && seenWorkMode.has(job.workMode) && pickedJobs.length >= 3) continue;
    seenGeo.add(job.geoScope);
    seenWorkMode.add(job.workMode);
    pickedJobs.push(job);
  }

  // If we didn't get 5 diverse jobs, pad with more
  for (const job of rawJobs) {
    if (pickedJobs.length >= 5) break;
    if (!pickedJobs.includes(job)) pickedJobs.push(job);
  }

  console.error(`Selected ${pickedJobs.length} diverse jobs`);

  // ── Fetch subscribers from Resend ────────────────────────────────────────
  const contacts = await listActiveContacts();
  console.error(`Fetched ${contacts.length} active contacts from Resend`);

  // Build Subscriber objects (same logic as send-digest.ts)
  const allSubs: Subscriber[] = contacts.map((c) => {
    const kwStr = c.properties["keywords"] ?? "";
    const authStr = c.properties["auth_countries"] ?? "";
    const remoteStr = c.properties["remote"] ?? "";
    const locationStr = (c.properties["location"] ?? "").toLowerCase();
    const tzProp = c.properties["timezone"] ?? "";

    const authCountries = authStr
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    return {
      id: c.id,
      email: c.email,
      keywords: kwStr
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
      remote: remoteStr.toLowerCase(),
      location: stripTimezone(locationStr),
      timezone: tzProp.toUpperCase() || extractTimezone(locationStr),
      authCountries,
      hasUSVisa: authCountries.includes("US"),
    };
  });

  // Pick up to 5 subscribers with diverse preferences:
  // - Different remote prefs (remote, hybrid, onsite if available)
  // - Different keyword sets (broad vs narrow, different stacks)
  // - Different auth country configurations (single country, multi, empty)
  const pickedSubs: Subscriber[] = [];
  const seenRemote: Set<string> = new Set();
  const seenKeywordCount: Set<string> = new Set(); // "narrow"(1-3), "medium"(4-7), "broad"(8+)

  const seenDiversity: Set<string> = new Set();

  // First pass: enforce diversity across remote pref, keyword breadth, and auth
  // country count. Skip subs whose diversityKey is already represented.
  for (const sub of allSubs) {
    if (pickedSubs.length >= 5) break;

    const kwBucket = sub.keywords.length <= 3 ? "narrow" : sub.keywords.length <= 7 ? "medium" : "broad";
    const authBucket = sub.authCountries.length === 0 ? "none" : sub.authCountries.length <= 2 ? "few" : "many";

    const diversityKey = `${sub.remote}|${kwBucket}|${authBucket}`;
    if (seenDiversity.has(diversityKey)) continue;

    seenDiversity.add(diversityKey);
    seenRemote.add(sub.remote);
    seenKeywordCount.add(kwBucket);
    pickedSubs.push(sub);
  }

  // Second pass: fill remaining slots without diversity constraint
  for (const sub of allSubs) {
    if (pickedSubs.length >= 5) break;
    if (!pickedSubs.includes(sub)) pickedSubs.push(sub);
  }

  console.error(`Selected ${pickedSubs.length} diverse subscribers`);

  // ── Anonymize emails ─────────────────────────────────────────────────────
  const anonJobs = pickedJobs.map((j, i) => ({
    ...j,
    // Truncate body to 500 chars for fixture readability (original up to 8000)
    body: j.body.slice(0, 500),
    scrapedAt: 1700000000, // fixed timestamp for deterministic tests
    datePosted: j.datePosted ? 1700000000 : undefined,
  }));

  const anonSubs = pickedSubs.map((s, i) => ({
    ...s,
    id: `test-sub-${i + 1}`,
    email: `test${i + 1}@test.invalid`,
  }));

  // ── Output ───────────────────────────────────────────────────────────────
  console.log(JSON.stringify({ jobs: anonJobs, subscribers: anonSubs }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
