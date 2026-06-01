import { getAllCountries } from "countries-and-timezones";
import { euMember } from "is-european";

// UI stores "UK"; ISO 3166-1 alpha-2 uses "GB" — job locationRestriction may use either
const ALIAS_MAP: Record<string, string> = { UK: "GB" };

// Derived at module load — all 27 EU member alpha-2 codes
const EU_CODES: string[] = Object.keys(getAllCountries()).filter((c) => euMember(c));

/** Normalize a single country code: trim, uppercase, resolve UK→GB alias */
export function normalizeCode(code: string): string {
  const canonical = code.trim().toUpperCase();
  return ALIAS_MAP[canonical] ?? canonical;
}

export function expandAuthCountries(codes: string[]): string[] {
  let result = codes.map(normalizeCode);
  if (result.includes("EU")) {
    result = result.filter((c) => c !== "EU").concat(EU_CODES);
  }
  return [...new Set(result)];
}

// Matches "GMT+1", "UTC-5", "GMT+5:30", "UTC-05:00"
const TZ_SUFFIX = /\s*((?:GMT|UTC)[+-]\d{1,2}(?::\d{2})?)$/i;

export function stripTimezone(location: string): string {
  if (typeof location !== "string") return "";
  return location.replace(TZ_SUFFIX, "").trim();
}

export function extractTimezone(location: string): string {
  if (typeof location !== "string") return "";
  return location.match(TZ_SUFFIX)?.[1]?.toUpperCase() ?? "";
}

/** Parse a timezone string like "GMT+1", "UTC-8", "GMT+5:30" to UTC offset in minutes.
 *  Returns null if the string cannot be parsed. */
export function parseUtcOffset(tz: string): number | null {
  const m = tz.match(/^(?:GMT|UTC)([+-]\d{1,2})(?::(\d{2}))?$/i);
  if (!m) return null;
  const hours = parseInt(m[1], 10);
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  const negative = m[1][0] === "-";
  return hours * 60 + (negative ? -mins : mins);
}
