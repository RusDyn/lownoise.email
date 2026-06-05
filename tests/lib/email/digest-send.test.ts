import { describe, expect, it, vi } from "vitest";
import {
  isHourlySubscriber,
  mapContactToSubscriber,
  normalizeDailySendHourUtc,
  prepareDigestRecipients,
  selectDailySubscribers,
  selectHourlySubscribers,
} from "@/lib/email/digest-send";
import type { Resend } from "resend";
import type { ResendContact } from "@/lib/contacts";
import type { StructuredJob, Subscriber } from "@/lib/jobs/types";

function contact(properties: Record<string, string>): ResendContact {
  return {
    id: "contact-id",
    email: "test@example.com",
    properties,
    unsubscribed: false,
  };
}

const nonMatchingJob: StructuredJob = {
  url: "https://example.com/job",
  title: "Backend Engineer",
  company: "Example",
  city: "",
  country: "",
  workMode: "remote",
  geoScope: "global",
  employmentType: "full-time",
  salaryMin: 0,
  salaryMax: 0,
  salaryCurrency: "",
  salaryPeriod: "",
  visaSponsorship: false,
  visaRequirement: "",
  locationRestriction: [],
  seniority: "unknown",
  skills: ["go"],
  isRemoteFriendly: true,
  equityOffered: false,
  scrapedAt: Date.now(),
  source: "other",
  body: "",
};

function subscriber(overrides: Partial<Subscriber>): Subscriber {
  return {
    id: "sub-id",
    email: "test@example.com",
    keywords: [],
    remote: "remote",
    location: "",
    timezone: "",
    authCountries: [],
    hasUSVisa: false,
    dailySendHourUtc: "16",
    premium: "",
    hourly: "",
    ...overrides,
  };
}

describe("digest send helpers", () => {
  it("defaults a missing daily send hour to 16", () => {
    expect(mapContactToSubscriber(contact({})).dailySendHourUtc).toBe("16");
  });

  it("defaults an invalid daily send hour to 16", () => {
    expect(normalizeDailySendHourUtc("24")).toBe("16");
    expect(normalizeDailySendHourUtc("-1")).toBe("16");
    expect(normalizeDailySendHourUtc("nope")).toBe("16");
  });

  it("selects only daily contacts matching the current UTC hour", () => {
    const matching = subscriber({ id: "matching", dailySendHourUtc: "9" });
    const padded = subscriber({ id: "padded", dailySendHourUtc: "09" });
    const defaulted = subscriber({ id: "defaulted", dailySendHourUtc: "bad" });
    const other = subscriber({ id: "other", dailySendHourUtc: "10" });

    expect(selectDailySubscribers([matching, padded, defaulted, other], 9).map((s) => s.id)).toEqual([
      "matching",
      "padded",
    ]);
    expect(selectDailySubscribers([matching, padded, defaulted, other], 16).map((s) => s.id)).toEqual([
      "defaulted",
    ]);
  });

  it("requires premium and hourly for hourly subscribers case-insensitively", () => {
    expect(isHourlySubscriber(subscriber({ premium: "TRUE", hourly: "true" }))).toBe(true);
    expect(isHourlySubscriber(subscriber({ premium: "true", hourly: "FALSE" }))).toBe(false);
    expect(isHourlySubscriber(subscriber({ premium: "false", hourly: "true" }))).toBe(false);

    expect(selectHourlySubscribers([
      subscriber({ id: "yes", premium: "TRUE", hourly: "true" }),
      subscriber({ id: "no-premium", premium: "false", hourly: "true" }),
      subscriber({ id: "no-hourly", premium: "true", hourly: "false" }),
    ]).map((s) => s.id)).toEqual(["yes"]);
  });

  it("skips hourly recipients with zero ranked jobs", async () => {
    const update = vi.fn();
    const add = vi.fn();
    const resend = {
      contacts: {
        update,
        segments: { add },
      },
    } as unknown as Resend;

    const recipients = await prepareDigestRecipients({
      resend,
      subscribers: [subscriber({ keywords: ["rust"], premium: "true", hourly: "true" })],
      jobs: [nonMatchingJob],
      segmentId: "send-segment",
      includeEmptyMatches: false,
    });

    expect(recipients).toBe(0);
    expect(update).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });
});
