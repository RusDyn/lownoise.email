import { expandAuthCountries } from "./normalize";

/**
 * Maps ISO 3166-1 alpha-2 country codes to their geoScope region.
 * Unmapped countries return undefined — the caller should treat this as "unknown".
 */
const COUNTRY_TO_GEOSCOPE: Record<string, string> = {
  US: "us",
  GB: "uk",
  // EU member states (all 27)
  AT: "eu", BE: "eu", BG: "eu", HR: "eu", CY: "eu", CZ: "eu",
  DK: "eu", EE: "eu", FI: "eu", FR: "eu", DE: "eu", GR: "eu",
  HU: "eu", IE: "eu", IT: "eu", LV: "eu", LT: "eu", LU: "eu",
  MT: "eu", NL: "eu", PL: "eu", PT: "eu", RO: "eu", SK: "eu",
  SI: "eu", ES: "eu", SE: "eu",
  // APAC countries
  AU: "apac", NZ: "apac", IN: "apac", JP: "apac", CN: "apac",
  SG: "apac", KR: "apac", TW: "apac", HK: "apac", MY: "apac",
  TH: "apac", PH: "apac", ID: "apac", VN: "apac",
};

/**
 * Given a subscriber's auth country codes (e.g. ["US", "DE", "GB"]),
 * returns the set of geoScope regions they're authorized in.
 *
 * Uses expandAuthCountries to handle "EU" expansion and UK→GB aliasing.
 * Deduplicates results — ["DE", "FR"] both map to "eu", so output is ["eu"].
 */
export function getGeoRegions(authCountries: string[]): string[] {
  const expanded = expandAuthCountries(authCountries);
  return [
    ...new Set(
      expanded
        .map((code) => COUNTRY_TO_GEOSCOPE[code])
        .filter((r): r is string => r !== undefined),
    ),
  ];
}
