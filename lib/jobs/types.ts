export interface StructuredJob {
  url: string;
  title: string;
  company: string;
  city: string;
  country: string;
  workMode: "remote" | "onsite" | "hybrid";
  geoScope: "global" | "us" | "eu" | "uk" | "apac" | "other";
  employmentType: "full-time" | "contract" | "part-time" | "internship" | "temporary";
  salaryMin: number;
  salaryMax: number;
  salaryCurrency: string;
  salaryPeriod: "year" | "month" | "hour" | "";
  visaSponsorship: boolean;
  visaRequirement: string;
  locationRestriction: string[];
  seniority: "junior" | "mid" | "senior" | "staff" | "principal" | "unknown";
  skills: string[];
  isRemoteFriendly: boolean;
  equityOffered: boolean;
  scrapedAt: number;
  datePosted?: number;
  source: "ashby" | "linkedin" | "greenhouse" | "lever" | "recruitee" | "smartrecruiters" | "personio" | "other";
  body: string;
}

export interface RawJob {
  title: string;
  url: string;
  snippet?: string;
  date?: string;
  data?: Record<string, unknown>;
  source: "ashby" | "linkedin" | "greenhouse" | "lever" | "recruitee" | "smartrecruiters" | "personio";
}

export interface Subscriber {
  id: string;
  email: string;
  keywords: string[];
  remote: string;
  location: string;
  timezone: string;
  authCountries: string[];
  hasUSVisa: boolean;
  dailySendHourUtc?: string;
  premium?: string;
  hourly?: string;
}
