import OpenAI from "openai";
import type { RawJob, StructuredJob } from "./types";

function getClient() {
  return new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY!,
  });
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
      console.error("structureJob: missing required fields for", raw.url);
      return null;
    }

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
      scrapedAt: Date.now(),
      source: raw.source,
      body: markdown.slice(0, 8000),
    };
  } catch (err) {
    console.error("structureJob error for", raw.url, err);
    return null;
  }
}
