import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import type { StructuredJob } from "./types";

const TTL_SECONDS = 7 * 24 * 60 * 60;
const SEVEN_DAYS_MS = TTL_SECONDS * 1000;

let _redis: Redis | undefined;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

function urlHash(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

export async function isKnownUrl(url: string): Promise<boolean> {
  const result = await getRedis().zscore("jobs:urls", url);
  return result !== null;
}

export async function storeJob(job: StructuredJob, markdown: string): Promise<void> {
  const hash = urlHash(job.url);
  const redis = getRedis();
  await Promise.all([
    redis.set(`job:${hash}`, JSON.stringify(job), { ex: TTL_SECONDS }),
    redis.set(`job:${hash}:raw`, markdown, { ex: TTL_SECONDS }),
    redis.zadd("jobs:index", { score: job.scrapedAt, member: hash }),
    redis.zadd("jobs:urls", { score: job.scrapedAt, member: job.url }),
  ]);
}

export async function getJobsSince(sinceMs: number): Promise<StructuredJob[]> {
  const redis = getRedis();
  // Prune entries older than 7 days to prevent unbounded growth
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  await Promise.all([
    redis.zremrangebyscore("jobs:index", 0, cutoff),
    redis.zremrangebyscore("jobs:urls", 0, cutoff),
  ]);

  const hashes = await redis.zrange("jobs:index", sinceMs, "+inf", { byScore: true });
  if (!hashes.length) return [];

  const keys = (hashes as string[]).map((h) => `job:${h}`);
  const values = await redis.mget<(string | null)[]>(...keys);

  return values
    .filter((v): v is string => v !== null)
    .map((v) => JSON.parse(v) as StructuredJob);
}
