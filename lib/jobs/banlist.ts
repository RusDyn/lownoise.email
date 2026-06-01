/**
 * Banned domain list for known scam / AI-slop job sites.
 *
 * A domain is banned when it aggregates scraped jobs, auto-generates fake
 * listings, or acts as a middleman charging candidates for access. These
 * domains waste Firecrawl credits, LLM tokens, and subscriber trust.
 *
 * To add a domain: append it to BANNED_DOMAINS and, if it matches a
 * repeatable pattern, add the pattern to SUSPICIOUS_PATTERNS so
 * sister domains get caught automatically.
 */

// ── Hardcoded ban list ──────────────────────────────────────────────

const BANNED_DOMAINS = new Set([
  "theladders.com",
  "crossover.com",
  "torre.ai",
  "hirecrap.com",
  "micro1.ai",
]);

// ── Heuristic auto-detection patterns ───────────────────────────────
//
// Each pattern is a case-insensitive regex tested against the full hostname.
// A match means the domain is SUSPICIOUS (logged but not necessarily banned
// unless also present in BANNED_DOMAINS). These catch sister domains and
// new entrants following the same naming playbook.

const SUSPICIOUS_PATTERNS: { pattern: RegExp; reason: string }[] = [
  // Domains that just sound like scam/spam job aggregators
  { pattern: /the\w*ladders?\./i, reason: "matches known scam pattern: *ladders" },
  { pattern: /crossover\./i, reason: "matches known scam pattern: crossover" },
  { pattern: /hire\w*crap/i, reason: "contains 'hire' + derogatory term" },
  { pattern: /micro\d+\./i, reason: "matches 'microN' pattern (micro1, micro2, etc.)" },

  // Generic patterns common among scam job aggregators
  { pattern: /hire\w*ai\./i, reason: "contains 'hire' + AI branding (common scam pattern)" },
  { pattern: /ai\w*jobs?\./i, reason: "AI-branded job aggregator" },
  { pattern: /remote\w*ok\w*\.(?!io)/i, reason: "clone of remoteok.io (exclude the real one)" },
];

// ── Public API ───────────────────────────────────────────────────────

export interface SuspicionResult {
  suspicious: boolean;
  reasons: string[];
}

/** Check whether a URL's domain is on the hardcoded ban list. */
export function isBannedDomain(url: string): boolean {
  const hostname = extractHostname(url);
  if (!hostname) return false;

  // Exact match
  if (BANNED_DOMAINS.has(hostname)) return true;

  // Also match subdomains: jobs.theladders.com → theladders.com
  return BANNED_DOMAINS.has(stripSubdomains(hostname));
}

/**
 * Run heuristic checks against a URL's domain to detect suspicious
 * job-aggregator patterns. Suspicious ≠ banned — these are flagged
 * for manual review. Once confirmed, add them to BANNED_DOMAINS.
 */
export function detectSuspiciousDomain(url: string): SuspicionResult {
  const hostname = extractHostname(url);
  if (!hostname) return { suspicious: false, reasons: [] };

  const reasons: string[] = [];
  for (const { pattern, reason } of SUSPICIOUS_PATTERNS) {
    if (pattern.test(hostname)) {
      reasons.push(reason);
    }
  }

  return { suspicious: reasons.length > 0, reasons };
}

// ── Helpers ──────────────────────────────────────────────────────────

function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Strip leading subdomains: "jobs.theladders.com" → "theladders.com" */
function stripSubdomains(hostname: string): string {
  // Keep stripping from the left until 2 labels remain (or 3 for .co.uk style)
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  // For .co.uk, .com.au etc: keep the last 3 labels
  if (parts.length >= 3 && parts[parts.length - 2].length <= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}
