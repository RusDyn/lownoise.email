/**
 * Deterministic unit test for filterAndRankJobs.
 *
 * Tests workplace mode filtering (remote/hybrid/onsite) and the keyword
 * relevance gate (title or skill match required — body-only matches
 * are not enough).
 *
 * Run: npx tsx scripts/test-filters.ts
 */

import { filterAndRankJobs } from "../lib/jobs/score";
import type { StructuredJob, Subscriber } from "../lib/jobs/types";

// ── Subscriber fixtures ────────────────────────────────────────────────────────
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

const ISRAEL_ONSITE: Subscriber = {
  id: "test-il-onsite",
  email: "test-onsite@test.invalid",
  keywords: ["devops"],
  remote: "onsite",
  location: "israel",
  timezone: "",
  authCountries: ["IL"],
  hasUSVisa: false,
};

const ISRAEL_REMOTE: Subscriber = {
  id: "test-il-remote",
  email: "test-remote@test.invalid",
  keywords: ["devops"],
  remote: "remote",
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

// Non-remote-friendly onsite job — should be BLOCKED for hybrid
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

// Body-only keyword match — no title or skill match. Must be filtered by
// the relevance gate.
const bodyOnlyMatch = makeJob({
  url: "https://example.com/body-only",
  title: "Head of Claims",
  skills: ["insurance", "claims"],
  body: "Work with our DevOps team to streamline claim processing.",
});

// No keyword match at all — irrelevant job. Must be filtered.
const noKeywordMatch = makeJob({
  url: "https://example.com/no-match",
  title: "AI Engineer",
  skills: ["python", "pytorch", "ml"],
  body: "Build machine learning models for fraud detection.",
});

// Onsite job that the LLM contradictorily marked remote-friendly.
// Hybrid/onsite subscribers can see it when local; remote subscribers should not.
const onsiteButRemoteFriendly = makeJob({
  url: "https://example.com/onsite-friendly",
  title: "Onsite-but-Friendly DevOps",
  workMode: "onsite",
  isRemoteFriendly: true,
  skills: ["devops"],
  locationRestriction: [],
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

// ── Section 1: Hybrid subscriber ──────────────────────────────────────────────

console.log("\n── Hybrid subscriber (remote=hybrid) ──");

const allJobs = [
  globalRemote, localHybrid, usRemote, onsiteLocal, usVisaJob, ilRemote,
  bodyOnlyMatch, noKeywordMatch, onsiteButRemoteFriendly,
];
const hybridResults = filterAndRankJobs(allJobs, ISRAEL_HYBRID);
const hybridUrls = new Set(hybridResults.map((j) => j.url));

console.log(`  ${hybridResults.length}/${allJobs.length} jobs passed\n`);

// Must pass: fully remote global job
assert(hybridUrls.has(globalRemote.url), "hybrid: global remote job passes");

// Must pass: local hybrid job
assert(hybridUrls.has(localHybrid.url), "hybrid: local hybrid job passes");

// Must NOT pass: US-restricted remote job (IL subscriber not authorized for US)
assert(!hybridUrls.has(usRemote.url), "hybrid: US-restricted remote job blocked");

// Must NOT pass: onsite-only job (hybrid shouldn't see truly onsite jobs)
assert(!hybridUrls.has(onsiteLocal.url), "hybrid: onsite-only job blocked");

// Must NOT pass: US visa requirement
assert(!hybridUrls.has(usVisaJob.url), "hybrid: US visa job blocked");

// Must pass: IL-restricted remote job (location overlap)
assert(hybridUrls.has(ilRemote.url), "hybrid: IL-restricted remote job passes");

// Must NOT pass: body-only keyword match (no title or skill match)
assert(!hybridUrls.has(bodyOnlyMatch.url), "hybrid: body-only match filtered by relevance gate");

// Must NOT pass: no keyword match at all
assert(!hybridUrls.has(noKeywordMatch.url), "hybrid: no-keyword job filtered by relevance gate");

// Must pass: local onsite workMode but isRemoteFriendly=true
assert(hybridUrls.has(onsiteButRemoteFriendly.url), "hybrid: onsite+remote-friendly job passes");

// ── Section 2: Onsite subscriber ──────────────────────────────────────────────

console.log("\n── Onsite subscriber (remote=onsite) ──");

const onsiteResults = filterAndRankJobs(allJobs, ISRAEL_ONSITE);
const onsiteUrls = new Set(onsiteResults.map((j) => j.url));

console.log(`  ${onsiteResults.length}/${allJobs.length} jobs passed\n`);

// Must pass: local hybrid job
assert(onsiteUrls.has(localHybrid.url), "onsite: local hybrid job passes");

// Must pass: onsite job
assert(onsiteUrls.has(onsiteLocal.url), "onsite: onsite job passes");

// Must NOT pass: fully remote job (onsite subscriber shouldn't see remote)
assert(!onsiteUrls.has(globalRemote.url), "onsite: fully remote job blocked");

// Must NOT pass: IL-restricted remote job (still remote-only)
assert(!onsiteUrls.has(ilRemote.url), "onsite: IL-restricted remote job blocked");

// Must NOT pass: body-only match
assert(!onsiteUrls.has(bodyOnlyMatch.url), "onsite: body-only match filtered");

// Must NOT pass: no keyword match
assert(!onsiteUrls.has(noKeywordMatch.url), "onsite: no-keyword job filtered");

// Must pass: onsite+remote-friendly (actually passes because workMode="onsite",
// not blocked by the remote filter for onsite subscribers)
assert(onsiteUrls.has(onsiteButRemoteFriendly.url), "onsite: onsite+remote-friendly job passes");

// ── Section 3: Remote subscriber ──────────────────────────────────────────────

console.log("\n── Remote subscriber (remote=remote) ──");

const remoteResults = filterAndRankJobs(allJobs, ISRAEL_REMOTE);
const remoteUrls = new Set(remoteResults.map((j) => j.url));

console.log(`  ${remoteResults.length}/${allJobs.length} jobs passed\n`);

// Must pass: fully remote global job
assert(remoteUrls.has(globalRemote.url), "remote: global remote job passes");

// Must NOT pass: local hybrid (not remote-friendly)
assert(!remoteUrls.has(localHybrid.url), "remote: non-remote-friendly hybrid blocked");

// Must NOT pass: onsite job (not remote-friendly)
assert(!remoteUrls.has(onsiteLocal.url), "remote: onsite job blocked");

// Must NOT pass: body-only match
assert(!remoteUrls.has(bodyOnlyMatch.url), "remote: body-only match filtered");

// Must NOT pass: no keyword match
assert(!remoteUrls.has(noKeywordMatch.url), "remote: no-keyword job filtered");

// Must NOT pass: remote subscribers should not receive onsite/hybrid roles
assert(!remoteUrls.has(onsiteButRemoteFriendly.url), "remote: onsite+remote-friendly job blocked");

// ── Result ────────────────────────────────────────────────────────────────────
console.log(`\n${failures === 0 ? "✓ All assertions passed" : `✗ ${failures} assertion(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
