import { createHash } from "crypto";
import type { StructuredJob, Subscriber } from "./types";
import { expandAuthCountries, inferCountryCodes, normalizeCode, parseUtcOffset } from "./normalize";
import { isBannedDomain, isBannedCompany } from "./banlist";
import { getGeoRegions } from "./geo";

/** Approximate UTC offset ranges (in hours) for each geoScope. */
const GEOSCOPE_TZ_RANGE: Partial<Record<string, [number, number]>> = {
  us: [-10, -5],    // Hawaii to Eastern
  eu: [-1, 3],      // Azores to Eastern Europe
  uk: [0, 1],       // GMT / BST
  apac: [5.5, 12],  // India to New Zealand
};

/** Distance from `value` to the nearest edge of [min, max]. 0 when inside. */
function distFromRange(value: number, range: [number, number]): number {
  const [min, max] = range;
  if (value >= min && value <= max) return 0;
  return Math.min(Math.abs(value - min), Math.abs(value - max));
}

/** Word-boundary regex test — used for title and body keyword matching. */
function wordMatch(text: string, kw: string): boolean {
  return new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
}

function overlaps(a: string[], b: string[]): boolean {
  return a.some((value) => b.includes(value));
}

function subscriberLocationCodes(subscriber: Subscriber, authCodes: string[]): string[] {
  return [...new Set([...authCodes, ...inferCountryCodes(subscriber.location)])];
}

function jobLocationCodes(job: StructuredJob): string[] {
  return [
    ...new Set([
      ...job.locationRestriction.flatMap((c) => expandAuthCountries([normalizeCode(c)])),
      ...inferCountryCodes(`${job.city} ${job.country}`),
    ]),
  ];
}

// ── Phase 1: Filter (hard binary decisions) ───────────────────────────────

/**
 * Reason a job was filtered out, or null if it passed all filters.
 * Exported for tests to assert specific filter reasons.
 */
export type FilterReason = "banned" | "visa" | "remote" | "location" | "relevance";

export function filterReason(
  job: StructuredJob,
  subscriber: Subscriber,
  authCodes: string[],
): FilterReason | null {
  // Filter 1: Banned domain/company
  if (isBannedDomain(job.url)) return "banned";
  if (isBannedCompany(job.company)) return "banned";

  // Filter 2: US visa requirement
  if (job.visaRequirement === "US" && !subscriber.hasUSVisa) return "visa";

  // Filter 3: Remote/work-mode mismatch
  if (subscriber.remote === "remote" && job.workMode !== "remote") return "remote";
  if (subscriber.remote === "remote" && !job.isRemoteFriendly) return "remote";
  if (subscriber.remote === "hybrid" && job.workMode === "onsite" && !job.isRemoteFriendly) return "remote";
  if (subscriber.remote === "onsite" && job.workMode === "remote") return "remote";

  // Filter 4: Location restriction mismatch.
  // Normalize then expand each restriction code (so "EU" expands to member
  // countries) to get a flat list, then check for overlap with authCodes
  // (which are already expanded).
  const expandedRestrictions = job.locationRestriction.flatMap((c) =>
    expandAuthCountries([normalizeCode(c)]),
  );
  if (
    job.locationRestriction.length > 0 &&
    authCodes.length > 0 &&
    !overlaps(expandedRestrictions, authCodes)
  ) {
    return "location";
  }

  const subscriberCodes = subscriberLocationCodes(subscriber, authCodes);
  const jobCodes = jobLocationCodes(job);
  if (
    job.workMode !== "remote" &&
    subscriberCodes.length > 0 &&
    jobCodes.length > 0 &&
    !overlaps(jobCodes, subscriberCodes)
  ) {
    return "location";
  }

  // Filter 5: Relevance gate — subscriber has keywords but job has no title or
  // skill match. Body-only matches are too noisy to qualify a job as relevant.
  if (subscriber.keywords.length > 0) {
    const kwsLower = subscriber.keywords.map((k) => k.toLowerCase());
    const titleLower = job.title.toLowerCase();
    const skillsLower = job.skills.map((s) => s.toLowerCase());

    const hasTitleMatch = kwsLower.some((k) => wordMatch(titleLower, k));
    const hasSkillMatch = kwsLower.some((k) => skillsLower.includes(k));

    if (!hasTitleMatch && !hasSkillMatch) return "relevance";
  }

  return null;
}

function filterPhase(
  jobs: StructuredJob[],
  subscriber: Subscriber,
  authCodes: string[],
): StructuredJob[] {
  return jobs.filter((job) => filterReason(job, subscriber, authCodes) === null);
}

// ── Phase 2: Scoring components (0-100 total) ─────────────────────────────

/**
 * GeoScope/Location relevance — 0 to 20 points.
 *
 * Uses the country-to-geoScope mapping (lib/jobs/geo.ts) to match the
 * subscriber's authorized regions against the job's geoScope.
 * No more "australia".includes("us") false positives.
 */
export function geoScopeScore(job: StructuredJob, regions: string[]): number {
  if (job.geoScope === "global") return 20;

  if (regions.length === 0) {
    // No auth info — neutral partial credit
    return 10;
  }

  if (regions.includes(job.geoScope)) return 20;
  if (job.geoScope === "other") return 10;

  return 0;
}

/**
 * Skill match — 0 to 25 points, tiered (diminishing returns).
 *
 * 1 match = 10, 2 = 18, 3 = 23, 4+ = 25 (cap).
 * Matching is exact (case-insensitive includes).
 */
export function skillMatchScore(job: StructuredJob, subscriber: Subscriber): number {
  const skillsLower = new Set(job.skills.map((s) => s.toLowerCase()));
  const kwsLower = subscriber.keywords.map((k) => k.toLowerCase());
  const matchCount = kwsLower.filter((k) => skillsLower.has(k)).length;
  const capped = Math.min(matchCount, 5);
  return [0, 10, 18, 23, 25, 25][capped];
}

/**
 * Title keyword match — 0 to 20 points.
 *
 * Any subscriber keyword found as a whole word in the job title.
 */
export function titleMatchScore(job: StructuredJob, subscriber: Subscriber): number {
  if (subscriber.keywords.length === 0) return 0;
  const titleLower = job.title.toLowerCase();
  const hasMatch = subscriber.keywords.some((k) => wordMatch(titleLower, k.toLowerCase()));
  return hasMatch ? 20 : 0;
}

/**
 * Body keyword mention — 0 to 10 points.
 *
 * Any subscriber keyword found as a whole word in the job body.
 */
export function bodyMatchScore(job: StructuredJob, subscriber: Subscriber): number {
  if (subscriber.keywords.length === 0 || !job.body) return 0;
  const bodyLower = job.body.toLowerCase();
  const hasMatch = subscriber.keywords.some((k) => wordMatch(bodyLower, k.toLowerCase()));
  return hasMatch ? 10 : 0;
}

/**
 * Salary specified — 0 to 10 points.
 */
export function salaryScore(job: StructuredJob): number {
  return job.salaryMin > 0 ? 10 : 0;
}

/**
 * Timezone compatibility — 0 to 15 points.
 *
 * Measures how well the subscriber's timezone overlaps with the job's geoScope
 * typical working hours. No penalty for mismatch — just less bonus.
 * No timezone data → neutral 5 points.
 */
export function timezoneScore(job: StructuredJob, subscriber: Subscriber): number {
  if (!subscriber.timezone) return 5;

  const subOffset = parseUtcOffset(subscriber.timezone);
  if (subOffset === null) return 5;

  const range = GEOSCOPE_TZ_RANGE[job.geoScope];
  if (!range) return 5;

  const dist = distFromRange(subOffset / 60, range); // minutes → hours
  if (dist === 0) return 15;
  if (dist <= 3) return 10;
  if (dist <= 6) return 5;
  return 0;
}

/**
 * Deterministic tiebreaker — 0 to ~0.01.
 *
 * Derived from the MD5 hash of the job URL. Same URL always produces the
 * same value, making rankings deterministic across runs. The 0.01 scale
 * survives the 2-decimal rounding applied in scoreJob.
 */
export function tiebreaker(job: StructuredJob): number {
  const hex = createHash("md5").update(job.url).digest("hex").slice(0, 4);
  return (parseInt(hex, 16) / 0xffff) * 0.01;
}

/**
 * Coverage ratio: how many of the subscriber's keywords appear anywhere
 * in the job (title, skills, or body). Used to penalize jobs that only
 * match a fraction of a subscriber's interests.
 *
 * For a subscriber with 1 keyword, 1 match = 100% coverage.
 * For a subscriber with 10 keywords, 1 match = 10% coverage → big penalty.
 * For "low noise" email, this ensures every surviving job is meaningfully
 * relevant to what the subscriber asked for.
 */
export function keywordCoverage(job: StructuredJob, subscriber: Subscriber): number {
  if (subscriber.keywords.length === 0) return 1; // no keywords → no penalty
  const kwsLower = subscriber.keywords.map((k) => k.toLowerCase());
  const titleLower = job.title.toLowerCase();
  const skillsLower = new Set(job.skills.map((s) => s.toLowerCase()));
  const bodyLower = job.body?.toLowerCase() ?? "";

  const matched = kwsLower.filter(
    (k) => wordMatch(titleLower, k) || skillsLower.has(k) || wordMatch(bodyLower, k),
  ).length;

  return matched / subscriber.keywords.length;
}

/**
 * Score a single job against a subscriber.
 *
 * Keyword-dependent components (skill, title, body) are scaled by the
 * keyword coverage ratio. A job matching 1/4 keywords gets 25% of those
 * points. A job matching 4/4 gets 100%. This produces honest 0-100 scores
 * suitable for public display.
 *
 * GeoScope, salary, and timezone are independent quality signals — not
 * scaled by coverage.
 */
export function scoreJob(
  job: StructuredJob,
  subscriber: Subscriber,
  _authCodes: string[],
  regions: string[],
): number {
  const cov = keywordCoverage(job, subscriber);
  const keywordScore =
    (skillMatchScore(job, subscriber) +
     titleMatchScore(job, subscriber) +
     bodyMatchScore(job, subscriber)) * cov;

  const score =
    geoScopeScore(job, regions) +
    keywordScore +
    salaryScore(job) +
    timezoneScore(job, subscriber) +
    tiebreaker(job);

  return Math.round(score * 100) / 100;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Filter and rank jobs for a subscriber.
 *
 * Phase 1: Hard binary filters remove definite non-matches.
 * Phase 2: Surviving jobs are scored 0-100, sorted descending, and the
 * top 10 are returned.
 *
 * This is the main entry point used by send-digest.ts. Signature is
 * unchanged from the original implementation.
 */
export function filterAndRankJobs(
  jobs: StructuredJob[],
  subscriber: Subscriber,
): StructuredJob[] {
  const authCodes = expandAuthCountries(subscriber.authCountries);
  const regions = getGeoRegions(subscriber.authCountries);

  // Phase 1: Filter out definite non-matches
  const filtered = filterPhase(jobs, subscriber, authCodes);

  // Phase 2: Score, sort, and take top 10
  return filtered
    .map((job) => ({ job, score: scoreJob(job, subscriber, authCodes, regions) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ job }) => job);
}
