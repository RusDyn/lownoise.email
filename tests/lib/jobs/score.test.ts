import { describe, it, expect } from "vitest";
import {
  filterAndRankJobs,
  filterReason,
  scoreJob,
  keywordCoverage,
  geoScopeScore,
  skillMatchScore,
  titleMatchScore,
  bodyMatchScore,
  salaryScore,
  timezoneScore,
} from "@/lib/jobs/score";
import { expandAuthCountries } from "@/lib/jobs/normalize";
import { getGeoRegions } from "@/lib/jobs/geo";
import type { Subscriber } from "@/lib/jobs/types";
import {
  SUB1_BROAD_FS,
  SUB2_DEVOPS_IL,
  SUB3_GO_RUST,
  J1_DEVOPS_INFRA,
  J2_BACKEND,
  J3_K8S_US,
  J4_DEVOPS_PL,
  J5_BACKEND_EU,
  JOB_LIST,
  ISRAEL_HYBRID,
  ISRAEL_REMOTE,
  ISRAEL_ONSITE,
  ONSITE_BUT_REMOTE_FRIENDLY,
  BODY_ONLY_MATCH,
  NO_KEYWORD_MATCH,
} from "./fixtures";

// ── Helpers ────────────────────────────────────────────────────────────────

function authCodes(sub: Subscriber): string[] {
  return expandAuthCountries(sub.authCountries);
}

function regions(sub: Subscriber): string[] {
  return getGeoRegions(sub.authCountries);
}

function score(job: (typeof JOB_LIST)[number], sub: Subscriber): number {
  return scoreJob(job, sub, authCodes(sub), regions(sub));
}

// ── Filter Phase: 3 subs × 5 jobs = 15 assertions ────────────────────────

describe("filter phase — 3 real subs × 5 real jobs", () => {
  // SUB1: Broad Fullstack Nigeria — all 5 jobs should pass
  describe("SUB1 (Broad Fullstack Nigeria)", () => {
    it("J1 passes (global, remote, no restriction, skill match)", () => {
      expect(filterReason(J1_DEVOPS_INFRA, SUB1_BROAD_FS, authCodes(SUB1_BROAD_FS))).toBeNull();
    });
    it("J2 passes (global, remote, no restriction, skill match)", () => {
      expect(filterReason(J2_BACKEND, SUB1_BROAD_FS, authCodes(SUB1_BROAD_FS))).toBeNull();
    });
    it("J3 passes (us, SUB1 has US auth, skill match)", () => {
      expect(filterReason(J3_K8S_US, SUB1_BROAD_FS, authCodes(SUB1_BROAD_FS))).toBeNull();
    });
    it("J4 passes (eu, SUB1 has PL/PT auth, skill match)", () => {
      expect(filterReason(J4_DEVOPS_PL, SUB1_BROAD_FS, authCodes(SUB1_BROAD_FS))).toBeNull();
    });
    it("J5 passes (eu, no restriction, skill match)", () => {
      expect(filterReason(J5_BACKEND_EU, SUB1_BROAD_FS, authCodes(SUB1_BROAD_FS))).toBeNull();
    });
  });

  // SUB2: Israel DevOps Hybrid — only J1 passes
  describe("SUB2 (Israel DevOps Hybrid)", () => {
    it("J1 passes (global, remote-friendly, title match 'devops')", () => {
      expect(filterReason(J1_DEVOPS_INFRA, SUB2_DEVOPS_IL, authCodes(SUB2_DEVOPS_IL))).toBeNull();
    });
    it("J2 → relevance filter (no 'devops' in title or skills)", () => {
      expect(filterReason(J2_BACKEND, SUB2_DEVOPS_IL, authCodes(SUB2_DEVOPS_IL))).toBe("relevance");
    });
    it("J3 → location filter (US-restricted, SUB2 auth=[IL])", () => {
      expect(filterReason(J3_K8S_US, SUB2_DEVOPS_IL, authCodes(SUB2_DEVOPS_IL))).toBe("location");
    });
    it("J4 → location filter (PL/RS/HR/PT, SUB2 auth=[IL])", () => {
      expect(filterReason(J4_DEVOPS_PL, SUB2_DEVOPS_IL, authCodes(SUB2_DEVOPS_IL))).toBe("location");
    });
    it("J5 → relevance filter (no 'devops' in title or skills)", () => {
      expect(filterReason(J5_BACKEND_EU, SUB2_DEVOPS_IL, authCodes(SUB2_DEVOPS_IL))).toBe("relevance");
    });
  });

  // SUB3: Go/Rust Backend Remote — J4 filtered, rest pass
  describe("SUB3 (Go/Rust Backend Remote)", () => {
    it("J1 passes (global, no restriction, skill 'kubernetes')", () => {
      expect(filterReason(J1_DEVOPS_INFRA, SUB3_GO_RUST, authCodes(SUB3_GO_RUST))).toBeNull();
    });
    it("J2 passes (global, no restriction, title 'backend')", () => {
      expect(filterReason(J2_BACKEND, SUB3_GO_RUST, authCodes(SUB3_GO_RUST))).toBeNull();
    });
    it("J3 passes (us, SUB3 has no auth so location filter skipped)", () => {
      // Sub with empty authCountries skips location restriction filter
      expect(filterReason(J3_K8S_US, SUB3_GO_RUST, authCodes(SUB3_GO_RUST))).toBeNull();
    });
    it("J4 → relevance filter (no keyword overlap with skills/title)", () => {
      expect(filterReason(J4_DEVOPS_PL, SUB3_GO_RUST, authCodes(SUB3_GO_RUST))).toBe("relevance");
    });
    it("J5 passes (eu, no restriction, title 'backend')", () => {
      expect(filterReason(J5_BACKEND_EU, SUB3_GO_RUST, authCodes(SUB3_GO_RUST))).toBeNull();
    });
  });
});

// ── Score Phase: exact component breakdowns ───────────────────────────────

describe("score phase — component breakdowns", () => {
  describe("SUB1 (Broad Fullstack Nigeria — 10 keywords)", () => {
    // J1: 5/10 keywords matched → cov=0.50
    it("J1 scores 42.5 (cov=0.50: 5/10 keywords)", () => {
      expect(keywordCoverage(J1_DEVOPS_INFRA, SUB1_BROAD_FS)).toBeCloseTo(0.50, 1);
      expect(geoScopeScore(J1_DEVOPS_INFRA, regions(SUB1_BROAD_FS))).toBe(20);
      expect(skillMatchScore(J1_DEVOPS_INFRA, SUB1_BROAD_FS)).toBe(25);
      expect(titleMatchScore(J1_DEVOPS_INFRA, SUB1_BROAD_FS)).toBe(0);
      expect(bodyMatchScore(J1_DEVOPS_INFRA, SUB1_BROAD_FS)).toBe(10);
      expect(salaryScore(J1_DEVOPS_INFRA)).toBe(0);
      expect(timezoneScore(J1_DEVOPS_INFRA, SUB1_BROAD_FS)).toBe(5);
      // raw kw: 25+0+10=35, ×0.50=17.5, +geo20+salary0+tz5 = 42.5
      const s = score(J1_DEVOPS_INFRA, SUB1_BROAD_FS);
      expect(s).toBeGreaterThanOrEqual(42.4);
      expect(s).toBeLessThan(42.6);
    });

    // J3: 2/10 keywords matched → cov=0.20
    it("J3 scores 44.6 (cov=0.20: 2/10 keywords, but title+salary boost)", () => {
      expect(keywordCoverage(J3_K8S_US, SUB1_BROAD_FS)).toBeCloseTo(0.20, 1);
      expect(geoScopeScore(J3_K8S_US, regions(SUB1_BROAD_FS))).toBe(20);
      expect(skillMatchScore(J3_K8S_US, SUB1_BROAD_FS)).toBe(18);
      expect(titleMatchScore(J3_K8S_US, SUB1_BROAD_FS)).toBe(20);
      expect(bodyMatchScore(J3_K8S_US, SUB1_BROAD_FS)).toBe(10);
      expect(salaryScore(J3_K8S_US)).toBe(10);
      expect(timezoneScore(J3_K8S_US, SUB1_BROAD_FS)).toBe(5);
      // raw kw: 18+20+10=48, ×0.20=9.6, +geo20+salary10+tz5 = 44.6
      const s = score(J3_K8S_US, SUB1_BROAD_FS);
      expect(s).toBeGreaterThanOrEqual(44.5);
      expect(s).toBeLessThan(44.7);
    });

    // J5: 3/10 keywords matched → cov=0.30
    it("J5 scores 43.4 (cov=0.30: 3/10 keywords)", () => {
      expect(keywordCoverage(J5_BACKEND_EU, SUB1_BROAD_FS)).toBeCloseTo(0.30, 1);
      expect(geoScopeScore(J5_BACKEND_EU, regions(SUB1_BROAD_FS))).toBe(20);
      expect(skillMatchScore(J5_BACKEND_EU, SUB1_BROAD_FS)).toBe(18);
      expect(titleMatchScore(J5_BACKEND_EU, SUB1_BROAD_FS)).toBe(0);
      expect(bodyMatchScore(J5_BACKEND_EU, SUB1_BROAD_FS)).toBe(10);
      expect(salaryScore(J5_BACKEND_EU)).toBe(10);
      expect(timezoneScore(J5_BACKEND_EU, SUB1_BROAD_FS)).toBe(5);
      // raw kw: 18+0+10=28, ×0.30=8.4, +geo20+salary10+tz5 = 43.4
      const s = score(J5_BACKEND_EU, SUB1_BROAD_FS);
      expect(s).toBeGreaterThanOrEqual(43.3);
      expect(s).toBeLessThan(43.5);
    });

    // J2: 2/10 keywords matched → cov=0.20, no salary
    it("J2 scores 30.6 (cov=0.20: 2/10 keywords, no salary)", () => {
      expect(keywordCoverage(J2_BACKEND, SUB1_BROAD_FS)).toBeCloseTo(0.20, 1);
      expect(geoScopeScore(J2_BACKEND, regions(SUB1_BROAD_FS))).toBe(20);
      expect(skillMatchScore(J2_BACKEND, SUB1_BROAD_FS)).toBe(18);
      expect(titleMatchScore(J2_BACKEND, SUB1_BROAD_FS)).toBe(0);
      expect(bodyMatchScore(J2_BACKEND, SUB1_BROAD_FS)).toBe(10);
      expect(salaryScore(J2_BACKEND)).toBe(0);
      expect(timezoneScore(J2_BACKEND, SUB1_BROAD_FS)).toBe(5);
      // raw kw: 18+0+10=28, ×0.20=5.6, +geo20+salary0+tz5 = 30.6
      const s = score(J2_BACKEND, SUB1_BROAD_FS);
      expect(s).toBeGreaterThanOrEqual(30.5);
      expect(s).toBeLessThan(30.7);
    });

    // J4: 1/10 keywords matched → cov=0.10
    it("J4 scores 27.0 (cov=0.10: 1/10 keywords — weak match)", () => {
      expect(keywordCoverage(J4_DEVOPS_PL, SUB1_BROAD_FS)).toBeCloseTo(0.10, 1);
      expect(geoScopeScore(J4_DEVOPS_PL, regions(SUB1_BROAD_FS))).toBe(20);
      expect(skillMatchScore(J4_DEVOPS_PL, SUB1_BROAD_FS)).toBe(10);
      expect(titleMatchScore(J4_DEVOPS_PL, SUB1_BROAD_FS)).toBe(0);
      expect(bodyMatchScore(J4_DEVOPS_PL, SUB1_BROAD_FS)).toBe(10);
      expect(salaryScore(J4_DEVOPS_PL)).toBe(0);
      expect(timezoneScore(J4_DEVOPS_PL, SUB1_BROAD_FS)).toBe(5);
      // raw kw: 10+0+10=20, ×0.10=2.0, +geo20+salary0+tz5 = 27.0
      const s = score(J4_DEVOPS_PL, SUB1_BROAD_FS);
      expect(s).toBeGreaterThanOrEqual(26.9);
      expect(s).toBeLessThan(27.1);
    });
  });

  describe("SUB2 (Israel DevOps Hybrid — 1 keyword)", () => {
    // SUB2 has 1 keyword → coverage always 1.0 → no penalty
    it("J1 scores 55 (cov=1.0: single keyword, no penalty)", () => {
      expect(keywordCoverage(J1_DEVOPS_INFRA, SUB2_DEVOPS_IL)).toBe(1.0);
      expect(geoScopeScore(J1_DEVOPS_INFRA, regions(SUB2_DEVOPS_IL))).toBe(20);
      expect(skillMatchScore(J1_DEVOPS_INFRA, SUB2_DEVOPS_IL)).toBe(0);
      expect(titleMatchScore(J1_DEVOPS_INFRA, SUB2_DEVOPS_IL)).toBe(20);
      expect(bodyMatchScore(J1_DEVOPS_INFRA, SUB2_DEVOPS_IL)).toBe(10);
      expect(salaryScore(J1_DEVOPS_INFRA)).toBe(0);
      expect(timezoneScore(J1_DEVOPS_INFRA, SUB2_DEVOPS_IL)).toBe(5);
      const s = score(J1_DEVOPS_INFRA, SUB2_DEVOPS_IL);
      expect(s).toBeGreaterThanOrEqual(54.9);
      expect(s).toBeLessThan(55.1);
    });
  });

  describe("SUB3 (Go/Rust Backend Remote — 4 keywords)", () => {
    // All 4 jobs for SUB3 match exactly 1/4 keywords → cov=0.25 for all
    // The ordering comes from geoScope, salary, and raw skill/title/body differences

    it("J3 scores 35.0 (cov=0.25: 1/4 keywords, but title+skills+salary boost)", () => {
      expect(keywordCoverage(J3_K8S_US, SUB3_GO_RUST)).toBeCloseTo(0.25, 1);
      expect(geoScopeScore(J3_K8S_US, regions(SUB3_GO_RUST))).toBe(10);
      expect(skillMatchScore(J3_K8S_US, SUB3_GO_RUST)).toBe(10);
      expect(titleMatchScore(J3_K8S_US, SUB3_GO_RUST)).toBe(20);
      expect(bodyMatchScore(J3_K8S_US, SUB3_GO_RUST)).toBe(10);
      expect(salaryScore(J3_K8S_US)).toBe(10);
      expect(timezoneScore(J3_K8S_US, SUB3_GO_RUST)).toBe(5);
      // raw kw: 10+20+10=40, ×0.25=10, +geo10+salary10+tz5 = 35
      const s = score(J3_K8S_US, SUB3_GO_RUST);
      expect(s).toBeGreaterThanOrEqual(34.9);
      expect(s).toBeLessThan(35.1);
    });

    it("J2 scores 32.5 (cov=0.25: 1/4 keywords, title 'backend', no salary)", () => {
      expect(keywordCoverage(J2_BACKEND, SUB3_GO_RUST)).toBeCloseTo(0.25, 1);
      expect(geoScopeScore(J2_BACKEND, regions(SUB3_GO_RUST))).toBe(20);
      expect(skillMatchScore(J2_BACKEND, SUB3_GO_RUST)).toBe(0);
      expect(titleMatchScore(J2_BACKEND, SUB3_GO_RUST)).toBe(20);
      expect(bodyMatchScore(J2_BACKEND, SUB3_GO_RUST)).toBe(10);
      expect(salaryScore(J2_BACKEND)).toBe(0);
      expect(timezoneScore(J2_BACKEND, SUB3_GO_RUST)).toBe(5);
      // raw kw: 0+20+10=30, ×0.25=7.5, +geo20+salary0+tz5 = 32.5
      const s = score(J2_BACKEND, SUB3_GO_RUST);
      expect(s).toBeGreaterThanOrEqual(32.4);
      expect(s).toBeLessThan(32.6);
    });

    it("J5 scores 32.5 (cov=0.25: 1/4 keywords, title 'backend', has salary)", () => {
      expect(keywordCoverage(J5_BACKEND_EU, SUB3_GO_RUST)).toBeCloseTo(0.25, 1);
      expect(geoScopeScore(J5_BACKEND_EU, regions(SUB3_GO_RUST))).toBe(10);
      expect(skillMatchScore(J5_BACKEND_EU, SUB3_GO_RUST)).toBe(0);
      expect(titleMatchScore(J5_BACKEND_EU, SUB3_GO_RUST)).toBe(20);
      expect(bodyMatchScore(J5_BACKEND_EU, SUB3_GO_RUST)).toBe(10);
      expect(salaryScore(J5_BACKEND_EU)).toBe(10);
      expect(timezoneScore(J5_BACKEND_EU, SUB3_GO_RUST)).toBe(5);
      // raw kw: 0+20+10=30, ×0.25=7.5, +geo10+salary10+tz5 = 32.5
      const s = score(J5_BACKEND_EU, SUB3_GO_RUST);
      expect(s).toBeGreaterThanOrEqual(32.4);
      expect(s).toBeLessThan(32.6);
    });

    it("J1 scores 30.0 (cov=0.25: 1/4 keywords — weakest, only 'kubernetes' in skills)", () => {
      expect(keywordCoverage(J1_DEVOPS_INFRA, SUB3_GO_RUST)).toBeCloseTo(0.25, 1);
      expect(geoScopeScore(J1_DEVOPS_INFRA, regions(SUB3_GO_RUST))).toBe(20);
      expect(skillMatchScore(J1_DEVOPS_INFRA, SUB3_GO_RUST)).toBe(10);
      expect(titleMatchScore(J1_DEVOPS_INFRA, SUB3_GO_RUST)).toBe(0);
      expect(bodyMatchScore(J1_DEVOPS_INFRA, SUB3_GO_RUST)).toBe(10);
      expect(salaryScore(J1_DEVOPS_INFRA)).toBe(0);
      expect(timezoneScore(J1_DEVOPS_INFRA, SUB3_GO_RUST)).toBe(5);
      // raw kw: 10+0+10=20, ×0.25=5.0, +geo20+salary0+tz5 = 30.0
      const s = score(J1_DEVOPS_INFRA, SUB3_GO_RUST);
      expect(s).toBeGreaterThanOrEqual(29.9);
      expect(s).toBeLessThan(30.1);
    });
  });
});

// ── Ordering assertions ────────────────────────────────────────────────────

describe("score ordering (filterAndRankJobs integration)", () => {
  it("SUB1: J3(44.6) > J5(43.4) > J1(42.5) > J2(30.6) > J4(27.0)", () => {
    const results = filterAndRankJobs(JOB_LIST, SUB1_BROAD_FS);
    expect(results).toHaveLength(5);
    const titles = results.map((j) => j.title);
    expect(titles[0]).toContain("Kubernetes Focused");   // J3 44.6
    expect(titles[1]).toContain("Backend Engineer");      // J5 43.4
    expect(titles[2]).toContain("DevOps Engineer (Infrastructure)"); // J1 42.5
    expect(titles[3]).toContain("Senior Backend Engineer"); // J2 30.6
    expect(titles[4]).toContain("Middle+ DevOps Engineer");  // J4 27.0
  });

  it("SUB2: only J1(55)", () => {
    const results = filterAndRankJobs(JOB_LIST, SUB2_DEVOPS_IL);
    expect(results).toHaveLength(1);
    expect(results[0].title).toContain("DevOps Engineer (Infrastructure)");
  });

  it("SUB3: J3(35.0) > J2=J5(32.5) > J1(30.0)", () => {
    const results = filterAndRankJobs(JOB_LIST, SUB3_GO_RUST);
    expect(results).toHaveLength(4);
    const titles = results.map((j) => j.title);
    // J3 at 35.0 (title+skills kubernetes + salary in same keyword)
    expect(titles[0]).toContain("Kubernetes Focused");
    // J2 and J5 tied at 32.5 (order by tiebreaker)
    expect(titles[1]).toMatch(/Senior Backend Engineer|^Backend Engineer$/);
    expect(titles[2]).toMatch(/Senior Backend Engineer|^Backend Engineer$/);
    // J1 at 30.0 (weakest — only skills kubernetes, no title match, no salary)
    expect(titles[3]).toContain("DevOps Engineer (Infrastructure)");
  });
});

// ── Determinism ────────────────────────────────────────────────────────────

describe("determinism (no Math.random())", () => {
  it("produces identical scores on repeated calls", () => {
    const first = filterAndRankJobs(JOB_LIST, SUB1_BROAD_FS).map((j) => j.title);
    const second = filterAndRankJobs(JOB_LIST, SUB1_BROAD_FS).map((j) => j.title);
    expect(first).toEqual(second);
  });

  it("same URL always produces the same score", () => {
    const s1 = score(J1_DEVOPS_INFRA, SUB1_BROAD_FS);
    const s2 = score(J1_DEVOPS_INFRA, SUB1_BROAD_FS);
    expect(s1).toBe(s2);
  });
});

// ── Score range ────────────────────────────────────────────────────────────

describe("score range [0, 100]", () => {
  it("all surviving pairs have scores in [0, 100]", () => {
    const subs = [SUB1_BROAD_FS, SUB2_DEVOPS_IL, SUB3_GO_RUST];
    for (const sub of subs) {
      for (const job of JOB_LIST) {
        const reason = filterReason(job, sub, authCodes(sub));
        if (reason === null) {
          const s = score(job, sub);
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});

// ── Edge cases ported from scripts/test-filters.ts ────────────────────────

describe("edge cases (ported from test-filters.ts)", () => {
  const edgeJobs = [ONSITE_BUT_REMOTE_FRIENDLY, BODY_ONLY_MATCH, NO_KEYWORD_MATCH];

  describe("isRemoteFriendly overrides workMode", () => {
    it("hybrid subscriber: onsite+remoteFriendly job passes", () => {
      const reason = filterReason(
        ONSITE_BUT_REMOTE_FRIENDLY,
        ISRAEL_HYBRID,
        authCodes(ISRAEL_HYBRID),
      );
      expect(reason).toBeNull();
    });

    it("remote subscriber: onsite+remoteFriendly job passes (isRemoteFriendly wins)", () => {
      const reason = filterReason(
        ONSITE_BUT_REMOTE_FRIENDLY,
        ISRAEL_REMOTE,
        authCodes(ISRAEL_REMOTE),
      );
      expect(reason).toBeNull();
    });

    it("onsite subscriber: onsite+remoteFriendly job passes", () => {
      const reason = filterReason(
        ONSITE_BUT_REMOTE_FRIENDLY,
        ISRAEL_ONSITE,
        authCodes(ISRAEL_ONSITE),
      );
      expect(reason).toBeNull();
    });
  });

  describe("body-only match → filtered by relevance gate", () => {
    it("hybrid subscriber: body-only match rejected", () => {
      const reason = filterReason(
        BODY_ONLY_MATCH,
        ISRAEL_HYBRID,
        authCodes(ISRAEL_HYBRID),
      );
      expect(reason).toBe("relevance");
    });

    it("remote subscriber: body-only match rejected by remote filter first (not remote-friendly)", () => {
      // BODY_ONLY_MATCH has isRemoteFriendly=false, so remote subscriber rejects it
      // at the remote filter before the relevance gate is reached
      const reason = filterReason(
        BODY_ONLY_MATCH,
        ISRAEL_REMOTE,
        authCodes(ISRAEL_REMOTE),
      );
      expect(reason).toBe("remote");
    });
  });

  describe("no keyword match → filtered by relevance gate", () => {
    it("hybrid subscriber: no-match job rejected", () => {
      const reason = filterReason(
        NO_KEYWORD_MATCH,
        ISRAEL_HYBRID,
        authCodes(ISRAEL_HYBRID),
      );
      expect(reason).toBe("relevance");
    });
  });

  describe("filterAndRankJobs integration with edge cases", () => {
    it("hybrid subscriber gets correct results from mixed pool", () => {
      const results = filterAndRankJobs(
        [...edgeJobs, J1_DEVOPS_INFRA],
        ISRAEL_HYBRID,
      );
      const titles = results.map((j) => j.title);
      // J1 should pass (remote-friendly global), onsiteButRemoteFriendly should pass
      expect(titles).toContain("Senior DevOps Engineer (Infrastructure)");
      expect(titles).toContain("Onsite-but-Friendly DevOps");
      // bodyOnlyMatch and noKeywordMatch should be filtered
      expect(titles).not.toContain("Head of Claims");
      expect(titles).not.toContain("AI Engineer");
    });
  });
});
