/**
 * Find remote-friendly jobs with keyword overlap for our 3 real subscribers.
 * Run: node --env-file=.env.local node_modules/.bin/tsx scripts/find-scoring-jobs.ts
 */
import { getJobsSince } from "../lib/jobs/store";

// Real subscriber keywords (from Resend)
const SUB_KWS = [
  { name: "SUB1", kws: ["typescript", "postgresql", "terraform", "react", "aws", "javascript", "kubernetes", "cloud", "ci/cd", "python"] },
  { name: "SUB2", kws: ["devops"] },
  { name: "SUB3", kws: ["backend", "go", "rust", "kubernetes"] },
];

async function main() {
  const since = Date.now() - 72 * 60 * 60 * 1000;
  const jobs = await getJobsSince(since);
  console.error(`Total jobs: ${jobs.length}`);

  // Stats
  let remoteFriendly = 0, hasLocationRestriction = 0, hasSalary = 0;
  const geoScopes: Record<string, number> = {};
  for (const j of jobs) {
    if (j.isRemoteFriendly) remoteFriendly++;
    if (j.locationRestriction.length > 0) hasLocationRestriction++;
    if (j.salaryMin > 0) hasSalary++;
    geoScopes[j.geoScope] = (geoScopes[j.geoScope] ?? 0) + 1;
  }
  console.error(`Remote-friendly: ${remoteFriendly}/${jobs.length}`);
  console.error(`With location restriction: ${hasLocationRestriction}/${jobs.length}`);
  console.error(`With salary: ${hasSalary}/${jobs.length}`);
  console.error("GeoScopes:", JSON.stringify(geoScopes));

  // For each subscriber, find jobs that pass filters and get scored
  for (const sub of SUB_KWS) {
    const kwsLower = sub.kws.map(k => k.toLowerCase());
    const passing = jobs.filter(j => {
      // Remote filter (all subs want remote)
      if (!j.isRemoteFriendly) return false;
      // Relevance gate
      const titleLower = j.title.toLowerCase();
      const skillsLower = j.skills.map(s => s.toLowerCase());
      const hasTitle = kwsLower.some(k => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(titleLower));
      const hasSkill = kwsLower.some(k => skillsLower.includes(k));
      return hasTitle || hasSkill;
    });

    console.error(`\n${sub.name}: ${passing.length} jobs pass filter+relevance`);
    for (const j of passing.slice(0, 8)) {
      const titleLower = j.title.toLowerCase();
      const skillsLower = j.skills.map(s => s.toLowerCase());
      const titleMatches = kwsLower.filter(k => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(titleLower));
      const skillMatches = kwsLower.filter(k => skillsLower.includes(k));
      console.log(JSON.stringify({
        title: j.title,
        company: j.company,
        geoScope: j.geoScope,
        workMode: j.workMode,
        locationRestriction: j.locationRestriction,
        isRemoteFriendly: j.isRemoteFriendly,
        salaryMin: j.salaryMin,
        skills: j.skills.slice(0, 6),
        titleMatches,
        skillMatches,
      }));
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
