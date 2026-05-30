import type { RawJob } from "./types";

interface SerperOrganic {
  title: string;
  link: string;
  snippet?: string;
  date?: string;
}

interface ApifyLinkedInItem {
  title?: string;
  applyUrl?: string;
  postedAt?: string;
  applyMethod?: string;
  workRemoteAllowed?: boolean;
  applicantsCount?: number;
  employmentType?: string;
  industries?: string[];
  salaryInsights?: unknown;
  workplaceTypes?: string[];
  country?: string;
}

function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "";
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
      const url = cleanUrl(item.link);
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
      if (!item.workRemoteAllowed) continue;
      if ((item.applicantsCount ?? 0) >= 100) continue;

      const url = cleanUrl(item.applyUrl ?? "");
      if (!url) continue;

      jobs.push({
        title: item.title ?? "",
        url,
        date: item.postedAt,
        data: {
          employmentType: item.employmentType,
          industries: item.industries,
          salaryInsights: item.salaryInsights,
          workplaceTypes: item.workplaceTypes,
          country: item.country,
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
