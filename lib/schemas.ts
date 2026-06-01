import { z } from "zod";

/**
 * Coerces any Resend contact property value to a string.
 * Non-strings (null, objects, arrays, numbers) become "".
 * Proper strings pass through unchanged.
 *
 * This prevents (e).toLowerCase is not a function crashes when
 * a property that should have been a string arrives as something else.
 */
const coerceString = z.preprocess(
  (val): string => (typeof val === "string" ? val : ""),
  z.string(),
);

/**
 * Schema for Resend contact custom properties.
 * Validates that the input is a string-keyed record and coerces
 * every value to a string, so downstream code can safely call
 * .toLowerCase(), .split(), .match(), .replace(), etc.
 */
export const contactPropertiesSchema = z.record(z.string(), coerceString);

/** Inferred type: { [key: string]: string } */
export type ContactProperties = z.infer<typeof contactPropertiesSchema>;
