import type { StructuredJob, Subscriber } from "./types";
import { expandAuthCountries, normalizeCode, parseUtcOffset } from "./normalize";
import { isBannedDomain, isBannedCompany } from "./banlist";

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

export function scoreJob(job: StructuredJob, subscriber: Subscriber): number {
  let score = 0;
  const kws = subscriber.keywords.map((k) => k.toLowerCase());
  const titleLower = job.title.toLowerCase();
  const locationLower = String(subscriber.location ?? "").toLowerCase();

  // +10 if geoScope matches subscriber location or is global
  if (job.geoScope === "global") {
    score += 10;
  } else if (locationLower && job.geoScope !== "other" && locationLower.includes(job.geoScope)) {
    score += 10;
  }

  const wordMatch = (text: string, kw: string) =>
    new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);

  // +1 per matching skill (cap 5)
  const skillsLower = job.skills.map((s) => s.toLowerCase());
  const skillMatchCount = kws.filter((k) => skillsLower.includes(k)).length;
  score += Math.min(skillMatchCount, 5);

  // +10 if title contains any keyword
  if (kws.length > 0 && kws.some((k) => wordMatch(titleLower, k))) score += 10;

  // +5 if job body mentions any keyword
  if (kws.length > 0 && job.body) {
    const bodyLower = job.body.toLowerCase();
    if (kws.some((k) => wordMatch(bodyLower, k))) score += 5;
  }

  // +2 if salary is specified
  if (job.salaryMin > 0) score += 2;

  // Timezone compatibility: boost jobs whose geoScope overlaps the subscriber's
  // working hours, demote jobs with severe timezone mismatch (e.g. US jobs for
  // someone in GMT+8 would mean late-night meetings).
  if (subscriber.timezone) {
    const subOffset = parseUtcOffset(subscriber.timezone);
    if (subOffset !== null) {
      const range = GEOSCOPE_TZ_RANGE[job.geoScope];
      if (range) {
        const dist = distFromRange(subOffset / 60, range); // minutes → hours
        if (dist === 0) score += 3;
        else if (dist <= 3) score += 2;
        else if (dist >= 8) score -= 4;
      }
    }
  }

  // Require at least one strong relevance signal: title match or skill match.
  // Body mentions alone (e.g. "work with our DevOps team" in an unrelated role)
  // are too noisy to qualify a job as relevant.
  if (kws.length > 0) {
    const hasTitleMatch = kws.some((k) => wordMatch(titleLower, k));
    const hasSkillMatch = skillMatchCount > 0;
    if (!hasTitleMatch && !hasSkillMatch) return 0;
  }

  // tiebreak
  score += Math.random() * 0.1;

  return score;
}

export function filterAndRankJobs(jobs: StructuredJob[], subscriber: Subscriber): StructuredJob[] {
  const authCodes = expandAuthCountries(subscriber.authCountries);
  return jobs
    .filter((job) => {
      // Defense-in-depth: re-check banned domains at delivery time.
      // The primary ban happens during ingestion (scrape-jobs dedup-filter),
      // but pre-existing Redis entries, URL redirect edge cases, or bugs
      // could let a banned job through. This gate ensures banned domains
      // never reach a subscriber's digest, even if they're in storage.
      if (isBannedDomain(job.url)) {
        console.warn("send-digest: banned domain caught at delivery:", job.url);
        return false;
      }

      // Also catch jobs whose apply URL hides behind a redirect wrapper
      // (e.g. LinkedIn external-job tracker) but whose company name still
      // matches a banned domain brand.
      if (isBannedCompany(job.company)) {
        console.warn("send-digest: banned company caught at delivery:", job.company, job.url);
        return false;
      }

      if (job.visaRequirement === "US" && !subscriber.hasUSVisa) return false;
      // "remote" subscribers only see remote-friendly jobs.
      // "hybrid" subscribers see hybrid and remote jobs; truly onsite jobs
      //   (workMode === "onsite" && !isRemoteFriendly) are blocked.
      // "onsite" subscribers see hybrid and onsite jobs; fully remote jobs
      //   (workMode === "remote") are blocked.
      if (subscriber.remote === "remote" && !job.isRemoteFriendly) return false;
      if (subscriber.remote === "hybrid" && job.workMode === "onsite" && !job.isRemoteFriendly) return false;
      if (subscriber.remote === "onsite" && job.workMode === "remote") return false;
      // Filter jobs that restrict to countries the subscriber isn't authorized for
      if (
        job.locationRestriction.length > 0 &&
        authCodes.length > 0 &&
        !job.locationRestriction.some((c) => authCodes.includes(normalizeCode(c)))
      ) return false;
      return true;
    })
    .map((job) => ({ job, score: scoreJob(job, subscriber) }))
    .filter(({ score }) => score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ job }) => job);
}
