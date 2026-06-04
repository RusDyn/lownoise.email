import { describe, it, expect } from "vitest";
import { z } from "zod";
import { contactPropertiesSchema } from "@/lib/schemas";

// Re-creating the relevant part for isolated unit testing
const coerceString = z.preprocess(
  (val): string => {
    if (typeof val === "string") return val;
    if (
      val &&
      typeof val === "object" &&
      "value" in val &&
      typeof (val as Record<string, unknown>).value === "string"
    )
      return (val as { value: string }).value;
    return "";
  },
  z.string(),
);

describe("coerceString", () => {
  it("passes plain strings through", () => {
    expect(coerceString.parse("backend,Go,Rust")).toBe("backend,Go,Rust");
    expect(coerceString.parse("")).toBe("");
    expect(coerceString.parse("remote")).toBe("remote");
  });

  it("unwraps Resend {value, type} objects", () => {
    expect(coerceString.parse({ value: "backend,Go,Rust", type: "string" })).toBe(
      "backend,Go,Rust",
    );
    expect(coerceString.parse({ value: "remote", type: "string" })).toBe("remote");
    expect(coerceString.parse({ value: "", type: "string" })).toBe("");
    expect(
      coerceString.parse({ value: "Nigeria GMT+1", type: "string" }),
    ).toBe("Nigeria GMT+1");
  });

  it("returns empty string for non-string, non-Resend-object values", () => {
    expect(coerceString.parse(null)).toBe("");
    expect(coerceString.parse(undefined)).toBe("");
    expect(coerceString.parse(42)).toBe("");
    expect(coerceString.parse(true)).toBe("");
    expect(coerceString.parse(["a", "b"])).toBe("");
    expect(coerceString.parse({})).toBe("");
    expect(coerceString.parse({ value: 42, type: "number" })).toBe("");
    expect(coerceString.parse({ other: "key" })).toBe("");
  });

  it("returns empty string for missing properties", () => {
    // coerceString handles any input via preprocess — null/undefined → ""
    expect(coerceString.parse(undefined)).toBe("");
    expect(coerceString.parse(null)).toBe("");
  });
});

describe("contactPropertiesSchema", () => {
  it("coerces Resend-format properties to plain strings", () => {
    const input = {
      keywords: { value: "backend,Go,Rust", type: "string" },
      remote: { value: "remote", type: "string" },
      location: { value: "Nigeria GMT+1", type: "string" },
      auth_countries: { value: "US,CA,UK", type: "string" },
      timezone: { value: "", type: "string" },
    };

    const result = contactPropertiesSchema.parse(input);
    expect(result.keywords).toBe("backend,Go,Rust");
    expect(result.remote).toBe("remote");
    expect(result.location).toBe("Nigeria GMT+1");
    expect(result.auth_countries).toBe("US,CA,UK");
    expect(result.timezone).toBe("");
  });

  it("passes plain-string properties through unchanged", () => {
    const input = {
      keywords: "go,rust",
      remote: "hybrid",
    };

    const result = contactPropertiesSchema.parse(input);
    expect(result.keywords).toBe("go,rust");
    expect(result.remote).toBe("hybrid");
  });

  it("handles mixed Resend + plain string properties", () => {
    const input = {
      keywords: { value: "go,rust", type: "string" },
      remote: "hybrid",
    };

    const result = contactPropertiesSchema.parse(input);
    expect(result.keywords).toBe("go,rust");
    expect(result.remote).toBe("hybrid");
  });

  it("coerces null/undefined values to empty string", () => {
    const input = {
      keywords: null,
      remote: undefined,
    };

    const result = contactPropertiesSchema.parse(input);
    expect(result.keywords).toBe("");
    expect(result.remote).toBe("");
  });
});
