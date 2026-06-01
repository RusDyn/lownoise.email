import { getJobsSince } from "../lib/jobs/store";
import { expandAuthCountries } from "../lib/jobs/normalize";
import type { StructuredJob, Subscriber } from "../lib/jobs/types";

// ── Test subscribers matching the 4 reported cases ──────────────────────────
const TEST_CASES: Array<{ label: string; sub: Subscriber }> = [
  {
    label: "Case 1 — remote, Go/Rust/K8s, no location, no authCountries",
    sub: {
      id: "debug-1",
      email: "debug-1@test.invalid",
      keywords: ["backend", "go", "rust", "kubernetes"],
      remote: "remote",
      location: "",
      authCountries: [],
      timezone: "",
      hasUSVisa: false,
    },
  },
  {
    label: "Case 2 — remote, broad stack, Nigeria GMT+1, 15 countries",
    sub: {
      id: "debug-2",
      email: "debug-2@test.invalid",
      keywords: ["typescript", "postgresql", "terraform", "react", "aws", "javascript", "kubernetes", "cloud", "ci/cd", "python"],
      remote: "remote",
      location: "nigeria gmt+1",
      timezone: "GMT+1",
      authCountries: ["US", "CA", "UK", "PT", "NL", "AU", "DE", "PL", "FR", "UA", "IE", "SE", "IN", "BR", "SG"],
      hasUSVisa: true,
    },
  },
  {
    label: "Case 3 — hybrid, devops, Israel, IL only",
    sub: {
      id: "debug-3",
      email: "debug-3@test.invalid",
      keywords: ["devops"],
      remote: "hybrid",
      location: "israel",
      timezone: "",
      authCountries: ["IL"],
      hasUSVisa: false,
    },
  },
  {
    label: "Case 4 — reference (expected 10 jobs) — adjust to match actual case 4 prefs",
    sub: {
      id: "debug-4",
      email: "debug-4@test.invalid",
      keywords: [],
      remote: "remote",
      location: "",
      timezone: "",
      authCountries: [],
      hasUSVisa: false,
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function hardFilterReason(job: StructuredJob, sub: Subscriber): string | null {
  if (job.visaRequirement === "US" && !sub.hasUSVisa) return "US visa required";
  if (sub.remote === "remote" && !job.isRemoteFriendly) return "not remote-friendly";
  const expanded = expandAuthCountries(sub.authCountries);
  if (
    job.locationRestriction.length > 0 &&
    expanded.length > 0 &&
    !job.locationRestriction.some((c) => expanded.includes(c))
  ) {
    return `locationRestriction mismatch: job=[${job.locationRestriction.join(",")}] sub=[${expanded.join(",")}]`;
  }
  return null;
}

function scoreBreakdown(job: StructuredJob, sub: Subscriber): { score: number; breakdown: string } {
  let score = 0;
  const parts: string[] = [];
  const kws = sub.keywords.map((k) => k.toLowerCase());
  const titleLower = job.title.toLowerCase();
  const locationLower = (sub.location ?? "").toLowerCase();

  if (job.geoScope === "global") {
    score += 10;
    parts.push("geoScope:global(+10)");
  } else if (locationLower && job.geoScope !== "other" && locationLower.includes(job.geoScope)) {
    score += 10;
    parts.push(`geoScope:${job.geoScope}(+10)`);
  } else {
    parts.push(`geoScope:${job.geoScope}(+0)`);
  }

  const wordMatch = (text: string, kw: string) =>
    new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);

  const skillsLower = job.skills.map((s) => s.toLowerCase());
  const skillMatchCount = kws.filter((k) => skillsLower.includes(k)).length;
  const skillPoints = Math.min(skillMatchCount, 5);
  score += skillPoints;
  if (skillMatchCount > 0) parts.push(`skills:${skillMatchCount}(+${skillPoints})`);

  if (kws.length > 0 && kws.some((k) => wordMatch(titleLower, k))) {
    score += 10;
    parts.push("title(+10)");
  }

  if (kws.length > 0 && job.body) {
    if (kws.some((k) => wordMatch(job.body.toLowerCase(), k))) {
      score += 5;
      parts.push("body(+5)");
    }
  }

  if (job.salaryMin > 0) {
    score += 2;
    parts.push("salary(+2)");
  }

  const passThreshold = score >= 1 ? "✓≥1" : "✗<1";
  return { score, breakdown: `${parts.join(" | ")} → ${score.toFixed(1)} ${passThreshold}` };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const since = Date.now() - 48 * 60 * 60 * 1000; // last 48h
  console.log(`\nFetching jobs since ${new Date(since).toISOString()}…\n`);

  const jobs = await getJobsSince(since);
  console.log(`Total jobs in window: ${jobs.length}`);

  if (jobs.length === 0) {
    console.log("⚠  No jobs in Redis. Digest would have returned 0 for everyone.");
    return;
  }

  // ── Job pool stats ────────────────────────────────────────────────────────
  const geoCount: Record<string, number> = {};
  const skillCount: Record<string, number> = {};
  let remoteFriendlyCount = 0;

  for (const job of jobs) {
    geoCount[job.geoScope] = (geoCount[job.geoScope] ?? 0) + 1;
    if (job.isRemoteFriendly) remoteFriendlyCount++;
    for (const s of job.skills) {
      const sl = s.toLowerCase();
      skillCount[sl] = (skillCount[sl] ?? 0) + 1;
    }
  }

  console.log("\n── GeoScope distribution ──");
  for (const [k, v] of Object.entries(geoCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`\nRemote-friendly: ${remoteFriendlyCount}/${jobs.length}`);

  const topSkills = Object.entries(skillCount).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log("\n── Top 15 skills ──");
  for (const [k, v] of topSkills) console.log(`  ${k}: ${v}`);

  // ── Per-case trace ────────────────────────────────────────────────────────
  for (const { label, sub } of TEST_CASES) {
    console.log(`\n${"═".repeat(72)}`);
    console.log(`${label}`);
    console.log(`${"─".repeat(72)}`);

    const passed: StructuredJob[] = [];
    const filterCounts: Record<string, number> = {};

    for (const job of jobs) {
      const reason = hardFilterReason(job, sub);
      if (reason) {
        const key = reason.startsWith("locationRestriction") ? "locationRestriction mismatch" : reason;
        filterCounts[key] = (filterCounts[key] ?? 0) + 1;
      } else {
        passed.push(job);
      }
    }

    console.log(`\nHard filter results: ${passed.length} passed, ${jobs.length - passed.length} filtered`);
    for (const [reason, count] of Object.entries(filterCounts)) {
      console.log(`  ✗ ${reason}: ${count}`);
    }

    if (passed.length === 0) {
      console.log("→ All jobs filtered before scoring. 0 results.");
      continue;
    }

    const scored = passed
      .map((job) => ({ job, ...scoreBreakdown(job, sub) }))
      .sort((a, b) => b.score - a.score);

    const above1 = scored.filter((s) => s.score >= 1);
    console.log(`\nScoring: ${above1.length}/${passed.length} scored ≥1`);

    if (above1.length === 0) {
      console.log("→ All passed jobs scored <1. 0 results.");
      console.log("\nBottom 5 scores:");
      for (const s of scored.slice(0, 5)) {
        console.log(`  [${s.job.title.slice(0, 50)}] ${s.breakdown}`);
      }
    } else {
      console.log(`\nTop ${Math.min(5, above1.length)} jobs:`);
      for (const s of above1.slice(0, 5)) {
        console.log(`  [${s.job.title.slice(0, 50)}] ${s.breakdown}`);
      }
    }
  }

  console.log(`\n${"═".repeat(72)}\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
