import OpenAI from "openai";
import type { RawJob, StructuredJob } from "./types";
import { logger } from "@/lib/logger";

function getClient() {
  return new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY!,
  });
}

export function parseDatePosted(date: string | undefined, source: string, now = Date.now()): number | undefined {
  if (!date) return undefined;

  if (source === "linkedin") {
    const ms = new Date(date).getTime();
    if (!isNaN(ms)) return ms;
    // fall through to relative-string parser for "3 days ago" etc.
  }

  const lower = date.trim().toLowerCase();
  if (lower === "just now" || lower === "today") return now;
  if (lower === "yesterday") return now - 86_400_000;

  // handles "2 hours ago", "an hour ago", "a day ago"
  const normalized = date.trim().replace(/^an?\s+/i, "1 ");
  const m = normalized.match(/^(\d+)\s+(second|minute|hour|day|week|month)s?\s+ago$/i);
  if (m) {
    const n = parseInt(m[1], 10);
    const offsets: Record<string, number> = {
      second: 1_000, minute: 60_000, hour: 3_600_000,
      day: 86_400_000, week: 604_800_000, month: 2_592_000_000,
    };
    return now - n * (offsets[m[2].toLowerCase()] ?? 0);
  }

  const ms = new Date(date).getTime();
  return isNaN(ms) ? undefined : ms;
}

const SCHEMA = `Return JSON with these fields:
title, company, city, country,
workMode ("remote"|"onsite"|"hybrid"),
geoScope ("global"|"us"|"eu"|"uk"|"apac"|"other"),
employmentType ("full-time"|"contract"|"part-time"|"internship"|"temporary"),
salaryMin (number, 0 if unknown), salaryMax (number, 0 if unknown),
salaryCurrency (string), salaryPeriod ("year"|"month"|"hour"|""),
visaSponsorship (boolean), visaRequirement (string, "US" if US-only),
locationRestriction (string[], alpha-2 codes),
seniority ("junior"|"mid"|"senior"|"staff"|"principal"|"unknown"),
skills (string[], max 10 canonical names),
isRemoteFriendly (boolean), equityOffered (boolean)`;

export async function structureJob(raw: RawJob, markdown: string): Promise<StructuredJob | null> {
  const prompt = [
    `Posted: ${raw.date ?? "unknown"}`,
    `Title: ${raw.title}`,
    `Data: ${JSON.stringify(raw.data ?? {})}`,
    `Content:\n${markdown.slice(0, 8000)}`,
  ].join("\n");

  try {
    const response = await getClient().chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "You are a deterministic data converter. Reply with valid JSON only. No markdown, no backticks.",
        },
        { role: "user", content: `${SCHEMA}\n\n${prompt}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    }, { signal: AbortSignal.timeout(30_000) });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as Partial<StructuredJob>;

    if (!parsed.title || !parsed.company || !parsed.workMode) {
      logger.error("structureJob: missing required fields", { url: raw.url });
      return null;
    }

    const now = Date.now();
    return {
      url: raw.url,
      title: parsed.title,
      company: parsed.company,
      city: parsed.city ?? "",
      country: parsed.country ?? "",
      workMode: parsed.workMode,
      geoScope: parsed.geoScope ?? "other",
      employmentType: parsed.employmentType ?? "full-time",
      salaryMin: parsed.salaryMin ?? 0,
      salaryMax: parsed.salaryMax ?? 0,
      salaryCurrency: parsed.salaryCurrency ?? "",
      salaryPeriod: parsed.salaryPeriod ?? "",
      visaSponsorship: parsed.visaSponsorship ?? false,
      visaRequirement: parsed.visaRequirement ?? "",
      locationRestriction: Array.isArray(parsed.locationRestriction) ? parsed.locationRestriction : [],
      seniority: parsed.seniority ?? "unknown",
      skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 10) : [],
      isRemoteFriendly: parsed.isRemoteFriendly ?? false,
      equityOffered: parsed.equityOffered ?? false,
      scrapedAt: now,
      datePosted: parseDatePosted(raw.date, raw.source, now),
      source: raw.source,
      body: markdown.slice(0, 8000),
    };
  } catch (err) {
    logger.error("structureJob failed", { url: raw.url, error: err });
    return null;
  }
}
