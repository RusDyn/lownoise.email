import { describe, expect, it } from "vitest";
import { isBoviJobFresh, BOVI_MAX_AGE_MS } from "@/lib/jobs/scrape";

// Fixed "now" for deterministic tests: 2026-06-06T12:00:00.000Z
const NOW = new Date("2026-06-06T12:00:00.000Z").getTime();

describe("isBoviJobFresh", () => {
  it("returns true for a job posted 1 hour ago", () => {
    const postedAt = "2026-06-06T11:00:00.000Z";
    expect(isBoviJobFresh(postedAt, NOW)).toBe(true);
  });

  it("returns true for a job posted 23 hours ago", () => {
    const postedAt = "2026-06-05T13:00:00.000Z";
    expect(isBoviJobFresh(postedAt, NOW)).toBe(true);
  });

  it("returns false for a job posted 25 hours ago", () => {
    const postedAt = "2026-06-05T11:00:00.000Z";
    expect(isBoviJobFresh(postedAt, NOW)).toBe(false);
  });

  it("returns false for a job posted 2 days ago", () => {
    const postedAt = "2026-06-04T12:00:00.000Z";
    expect(isBoviJobFresh(postedAt, NOW)).toBe(false);
  });

  it("returns false at exactly the boundary (now - maxAgeMs)", () => {
    // Exactly BOVI_MAX_AGE_MS ago — boundary: should be true (>=)
    const boundary = new Date(NOW - BOVI_MAX_AGE_MS).toISOString();
    expect(isBoviJobFresh(boundary, NOW)).toBe(true);
  });

  it("returns false just past the boundary (now - maxAgeMs - 1ms)", () => {
    const justPast = new Date(NOW - BOVI_MAX_AGE_MS - 1).toISOString();
    expect(isBoviJobFresh(justPast, NOW)).toBe(false);
  });

  it("returns true for a job posted right now", () => {
    const postedAt = new Date(NOW).toISOString();
    expect(isBoviJobFresh(postedAt, NOW)).toBe(true);
  });

  it("returns true for an unparseable date string (err on the side of keeping)", () => {
    expect(isBoviJobFresh("not-a-date", NOW)).toBe(true);
    expect(isBoviJobFresh("", NOW)).toBe(true);
    expect(isBoviJobFresh("last week", NOW)).toBe(true);
  });

  it("returns true for a future date", () => {
    const postedAt = "2026-06-07T12:00:00.000Z";
    expect(isBoviJobFresh(postedAt, NOW)).toBe(true);
  });

  it("handles ISO 8601 with timezone offset", () => {
    // 2026-06-06T12:00:00+02:00 = 2026-06-06T10:00:00Z — 2 hours ago
    const postedAt = "2026-06-06T12:00:00.000+02:00";
    expect(isBoviJobFresh(postedAt, NOW)).toBe(true);
  });

  it("handles ISO 8601 without milliseconds", () => {
    const postedAt = "2026-06-06T11:00:00Z";
    expect(isBoviJobFresh(postedAt, NOW)).toBe(true);
  });

  it("respects custom maxAgeMs", () => {
    // 2 hours old, but maxAge is 1 hour
    const postedAt = "2026-06-06T10:00:00.000Z";
    expect(isBoviJobFresh(postedAt, NOW, 3_600_000)).toBe(false);
  });
});
