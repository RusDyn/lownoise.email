import type { RawJob } from "./types";

interface SerperOrganic {
  title: string;
  link: string;
  snippet?: string;
  date?: string;
}

interface ApifyLinkedInItem {
  title?: string;
  link?: string;
  applyUrl?: string;
  applyMethod?: string;
  postedAt?: string;
  applicantsCount?: number | string;
  employmentType?: string;
  industries?: string[];
  salary?: unknown;
  location?: string;
  companyName?: string;
  seniorityLevel?: string;
  jobFunction?: string;
}

function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "";
  }
}

// Ashby company pages have one path segment (/company) and list multiple jobs.
// Job listings have two segments (/company/uuid). Filter out company pages because
// the LLM can't extract required single-job fields from a list page.
function isAshbyCompanyPage(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.hostname !== "jobs.ashbyhq.com") return false;
    const segments = u.pathname.split("/").filter(Boolean);
    return segments.length === 1;
  } catch {
    return false;
  }
}

// Follow HTTP redirects to resolve URL shorteners (click.appcast.io, lnkd.in,
// LinkedIn external-job trackers, etc.) to the final destination URL.
//
// Uses GET with automatic redirect following — HEAD requests are commonly
// blocked or return 200 with JS redirects (LinkedIn, Greenhouse, etc.),
// which would silently fail to resolve. GET + redirect:"follow" handles
// all standard 3xx redirects. We don't read the response body, so the
// overhead is minimal (headers only in practice, since we abort after
// the redirect chain resolves).
async function resolveRedirects(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
    const finalUrl = res.url;
    // Cancel the body download — we only needed the resolved URL
    controller.abort();
    return finalUrl;
  } catch {
    return url; // On error, return the original URL
  } finally {
    clearTimeout(timer);
  }
}

// Strip ATS apply-form suffixes so we scrape the job listing, not the form page.
// Form pages return near-empty markdown because form/input tags are excluded.
export function normalizeJobUrl(url: string): string {
  return url
    .replace(/\/application\/?$/, "")   // Ashby: /{org}/{uuid}/application
    .replace(/\/apply\/?$/, "");         // Greenhouse, Lever: /jobs/{id}/apply
}

function parseApplicantsCount(value: ApifyLinkedInItem["applicantsCount"]): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;

  const normalized = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isNaN(normalized) ? 0 : normalized;
}

function isLinkedInUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}

export async function scrapeSerper(): Promise<RawJob[]> {
  const apiKey = process.env.SERPER_API_KEY!;
  const maxPages = 5;
  const jobs: RawJob[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        q: 'site:jobs.ashbyhq.com/ (engineer OR developer OR CTO OR "engineering")',
        tbs: "qdr:d1",
        num: 10,
        page,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.error(`Serper page ${page} failed: ${res.status}`);
      break;
    }

    const data = (await res.json()) as { organic?: SerperOrganic[] };
    const organic = data.organic ?? [];

    for (const item of organic) {
      const cleaned = cleanUrl(item.link);
      if (!cleaned) continue;

      // Skip Ashby company pages — they list multiple jobs and won't
      // have the required title/company/workMode fields for a single listing.
      if (isAshbyCompanyPage(cleaned)) {
        console.warn("scrapeSerper: skipping ashby company page:", cleaned);
        continue;
      }

      // Resolve URL shorteners and redirect chains before normalizing so
      // normalizeJobUrl sees the final destination and can strip its
      // /application or /apply suffixes.
      const resolved = await resolveRedirects(cleaned);
      if (resolved !== cleaned) {
        console.log("scrapeSerper: redirected", cleaned, "→", resolved);
      }

      const url = normalizeJobUrl(resolved);
      if (!url) continue;
      jobs.push({
        title: item.title.replace(/ - Jobs$/, "").trim(),
        url,
        snippet: item.snippet,
        date: item.date,
        data: {},
        source: "ashby",
      });
    }

    if (organic.length < 10) break;
  }

  return jobs;
}

export async function scrapeApify(): Promise<RawJob[]> {
  const token = process.env.APIFY_API_KEY!;
  const actorId = "hKByXkMQaC5Qt9UMN";
  const endpoint = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=300&memory=512`;

  let items: ApifyLinkedInItem[] = [];
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: [
          "https://www.linkedin.com/jobs/search/?keywords=engineer&geoId=103644278&f_WT=2&f_TPR=r3600&position=1&pageNum=0",
          "https://www.linkedin.com/jobs/search/?keywords=engineer&geoId=91000007&f_WT=2&f_TPR=r3600&position=1&pageNum=0",
        ],
        count: 200,
        scrapeCompany: false,
        splitByLocation: false,
      }),
      signal: AbortSignal.timeout(320_000),
    });

    if (!res.ok) {
      console.error(`Apify failed: ${res.status}`);
    } else {
      items = (await res.json()) as ApifyLinkedInItem[];
    }
  } catch (err) {
    console.error("Apify error:", err);
  }

  const jobs: RawJob[] = [];
  for (const item of items) {
    if (item.applyMethod !== "OffsiteApply") continue;
    if (parseApplicantsCount(item.applicantsCount) >= 100) continue;

    const cleaned = cleanUrl(item.applyUrl ?? "");
    if (!cleaned) continue;
    if (isLinkedInUrl(cleaned)) continue;

    // Resolve URL shorteners and redirect chains before normalizing so
    // normalizeJobUrl sees the final destination and can strip its
    // /application or /apply suffixes.
    const resolved = await resolveRedirects(cleaned);
    if (resolved !== cleaned) {
      console.log("scrapeApify: redirected", cleaned, "→", resolved);
    }

    const url = normalizeJobUrl(resolved);
    if (!url) continue;

    jobs.push({
      title: item.title ?? "",
      url,
      date: item.postedAt,
      data: {
        employmentType: item.employmentType,
        industries: item.industries,
        salary: item.salary,
        location: item.location,
        companyName: item.companyName,
        seniorityLevel: item.seniorityLevel,
        jobFunction: item.jobFunction,
        linkedinUrl: item.link,
      },
      source: "linkedin",
    });
  }

  return jobs;
}

export async function scrapeJobPage(url: string): Promise<string> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      excludeTags: [
        "img", "a",
        "nav", "header", "footer", "aside",
        "button", "form", "input", "select",
        "script", "style", "noscript", "iframe",
        ".cookie", ".share", ".social", ".sidebar",
        "#cookie", "#nav", "#header", "#footer",
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Firecrawl ${res.status} for ${url}`);

  const data = (await res.json()) as { success: boolean; data?: { markdown?: string } };
  const markdown = data.data?.markdown ?? "";

  // Normalize for LLM input
  return markdown
    .replace(/#{1,6}\s/g, "")
    .replace(/\*/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
