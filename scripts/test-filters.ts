/**
 * Deterministic unit test for filterAndRankJobs.
 *
 * Tests the Israel/hybrid case: a subscriber with location=Israel,
 * authCountries=["IL"], remote="hybrid" should see fully remote jobs
 * alongside hybrid/onsite jobs available to their location.
 *
 * Run: npx tsx scripts/test-filters.ts
 */

import { filterAndRankJobs } from "../lib/jobs/score";
import type { StructuredJob, Subscriber } from "../lib/jobs/types";

// ── Subscriber fixture ────────────────────────────────────────────────────────
const ISRAEL_HYBRID: Subscriber = {
  id: "test-il-hybrid",
  email: "test@test.invalid",
  keywords: ["devops"],
  remote: "hybrid",
  location: "israel",
  timezone: "",
  authCountries: ["IL"],
  hasUSVisa: false,
};

// ── Job fixture factory ───────────────────────────────────────────────────────
function makeJob(overrides: Partial<StructuredJob>): StructuredJob {
  return {
    url: "https://example.com/job",
    title: "Software Engineer",
    company: "TestCo",
    city: "Tel Aviv",
    country: "Israel",
    workMode: "hybrid",
    geoScope: "other",
    employmentType: "full-time",
    salaryMin: 0,
    salaryMax: 0,
    salaryCurrency: "",
    salaryPeriod: "",
    visaSponsorship: false,
    visaRequirement: "",
    locationRestriction: [],
    seniority: "mid",
    skills: ["devops", "aws"],
    isRemoteFriendly: false,
    equityOffered: false,
    scrapedAt: Date.now(),
    source: "other",
    body: "DevOps engineer role.",
    ...overrides,
  };
}

// ── Test fixtures ─────────────────────────────────────────────────────────────

// Key case: fully remote, globally available — must pass for hybrid subscriber
const globalRemote = makeJob({
  url: "https://example.com/global-remote",
  title: "Global Remote DevOps",
  workMode: "remote",
  geoScope: "global",
  isRemoteFriendly: true,
  locationRestriction: [],
});

// Hybrid job in Israel, no restrictions — should pass
const localHybrid = makeJob({
  url: "https://example.com/local-hybrid",
  title: "Local Hybrid DevOps",
  workMode: "hybrid",
  geoScope: "other",
  isRemoteFriendly: false,
  locationRestriction: [],
});

// Remote-friendly but restricted to US — should be blocked (IL != US)
const usRemote = makeJob({
  url: "https://example.com/us-remote",
  title: "US-Only Remote DevOps",
  workMode: "remote",
  geoScope: "us",
  isRemoteFriendly: true,
  locationRestriction: ["US"],
});

// Non-remote-friendly onsite job — should pass (hybrid sees all work modes)
const onsiteLocal = makeJob({
  url: "https://example.com/onsite",
  title: "Onsite DevOps",
  workMode: "onsite",
  geoScope: "other",
  isRemoteFriendly: false,
  locationRestriction: [],
});

// Requires US visa — should be blocked (subscriber lacks hasUSVisa)
const usVisaJob = makeJob({
  url: "https://example.com/us-visa",
  title: "US Visa DevOps",
  workMode: "hybrid",
  geoScope: "us",
  isRemoteFriendly: false,
  visaRequirement: "US",
  locationRestriction: [],
});

// Remote job restricted to IL — should pass (location overlap)
const ilRemote = makeJob({
  url: "https://example.com/il-remote",
  title: "IL-Only Remote DevOps",
  workMode: "remote",
  geoScope: "other",
  isRemoteFriendly: true,
  locationRestriction: ["IL"],
});

// ── Test runner ───────────────────────────────────────────────────────────────

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`  ✗ FAIL: ${label}`);
    failures++;
  } else {
    console.log(`  ✓ ${label}`);
  }
}

const allJobs = [globalRemote, localHybrid, usRemote, onsiteLocal, usVisaJob, ilRemote];
const results = filterAndRankJobs(allJobs, ISRAEL_HYBRID);
const resultUrls = new Set(results.map((j) => j.url));

console.log(`\nFilter results: ${results.length}/${allJobs.length} jobs passed\n`);

// ── Assertions ────────────────────────────────────────────────────────────────

// Must pass: fully remote global job shown to hybrid subscriber
assert(resultUrls.has(globalRemote.url), "global remote job passes for hybrid subscriber");

// Must pass: local hybrid job
assert(resultUrls.has(localHybrid.url), "local hybrid job passes");

// Must NOT pass: US-restricted remote job (IL subscriber not authorized for US)
assert(!resultUrls.has(usRemote.url), "US-restricted remote job blocked for IL subscriber");

// Must pass: non-remote-friendly onsite job (hybrid sees all work modes)
assert(resultUrls.has(onsiteLocal.url), "onsite job passes for hybrid subscriber");

// Must NOT pass: US visa requirement (subscriber lacks hasUSVisa)
assert(!resultUrls.has(usVisaJob.url), "US visa job blocked for non-US subscriber");

// Must pass: IL-restricted remote job (location overlap)
assert(resultUrls.has(ilRemote.url), "IL-restricted remote job passes for IL subscriber");

// ── Scoring assertion ─────────────────────────────────────────────────────────
// Global remote job should get geoScope bonus for hybrid subscriber
const scoredGlobal = results.find((j) => j.url === globalRemote.url);
assert(scoredGlobal != null, "global remote job included in results");

// ── Result ────────────────────────────────────────────────────────────────────
console.log(`\n${failures === 0 ? "✓ All assertions passed" : `✗ ${failures} assertion(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
