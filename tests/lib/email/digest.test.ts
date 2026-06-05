import { describe, expect, it } from "vitest";
import { timeAgo } from "@/lib/email/digest";

const NOW = 1_800_000_000_000;

describe("digest email formatting", () => {
  it("formats missing, current, and future timestamps as empty or just now", () => {
    expect(timeAgo(undefined, NOW)).toBe("");
    expect(timeAgo(NOW, NOW)).toBe("just now");
    expect(timeAgo(NOW + 1_000, NOW)).toBe("just now");
    expect(timeAgo(NOW - 59_000, NOW)).toBe("just now");
  });

  it("uses minute labels for jobs less than two hours old", () => {
    expect(timeAgo(NOW - 60_000, NOW)).toBe("1m ago");
    expect(timeAgo(NOW - 60 * 60_000, NOW)).toBe("60m ago");
    expect(timeAgo(NOW - 119 * 60_000, NOW)).toBe("119m ago");
  });

  it("uses compact hour and day labels after the minute window", () => {
    expect(timeAgo(NOW - 120 * 60_000, NOW)).toBe("2h ago");
    expect(timeAgo(NOW - 21 * 3_600_000, NOW)).toBe("21h ago");
    expect(timeAgo(NOW - 25 * 3_600_000, NOW)).toBe("1d ago");
  });
});
