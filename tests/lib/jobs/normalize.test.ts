import { describe, expect, it } from "vitest";
import { inferCountryCodes } from "@/lib/jobs/normalize";

describe("inferCountryCodes", () => {
  it("infers explicit country names and location-style country codes", () => {
    expect(inferCountryCodes("remote/pt")).toContain("PT");
    expect(inferCountryCodes("Hamburg, Germany")).toContain("DE");
  });

  it("does not infer common two-letter words as country codes", () => {
    expect(inferCountryCodes("work in Hamburg")).not.toContain("IN");
    expect(inferCountryCodes("am remote")).not.toContain("AM");
    expect(inferCountryCodes("be remote")).not.toContain("BE");
  });
});
