import type { StructuredJob, Subscriber } from "./types";
import { expandAuthCountries, normalizeCode } from "./normalize";

export function scoreJob(job: StructuredJob, subscriber: Subscriber): number {
  let score = 0;
  const kws = subscriber.keywords.map((k) => k.toLowerCase());
  const titleLower = job.title.toLowerCase();
  const locationLower = (subscriber.location ?? "").toLowerCase();

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

  // tiebreak
  score += Math.random() * 0.1;

  return score;
}

export function filterAndRankJobs(jobs: StructuredJob[], subscriber: Subscriber): StructuredJob[] {
  const authCodes = expandAuthCountries(subscriber.authCountries);
  return jobs
    .filter((job) => {
      if (job.visaRequirement === "US" && !subscriber.hasUSVisa) return false;
      // Cumulative flexibility: "remote" subscribers only see remote-friendly jobs.
      // "hybrid" and "onsite" subscribers see all work modes — hybrid subscribers
      // also get fully remote jobs since remote is strictly more flexible.
      if (subscriber.remote === "remote" && !job.isRemoteFriendly) return false;
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
