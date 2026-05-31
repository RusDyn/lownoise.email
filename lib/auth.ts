import { Redis } from "@upstash/redis";

const TOKEN_TTL = 24 * 60 * 60; // 24h in seconds

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export async function createPendingToken(email: string): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  await getRedis().set(`pending:${token}`, email, { ex: TOKEN_TTL });
  return token;
}

export async function validateAndConsumePendingToken(token: string): Promise<string | null> {
  // Lua script runs server-side on Redis — atomically GETs and DELetes in one round-trip.
  // This is the same pattern used in middleware.ts for rate limiting.
  const lua = [
    "local v = redis.call('GET', KEYS[1])",
    "if v then redis.call('DEL', KEYS[1]) end",
    "return v",
  ].join("\n");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const email = (await (getRedis() as any).eval(lua, [`pending:${token}`], [])) as string | null;
  return typeof email === "string" ? email : null;
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64Url(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + "=".repeat(padding));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = process.env.MANAGE_HMAC_SECRET;
  if (!secret) throw new Error("MANAGE_HMAC_SECRET is not configured");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Token format: base64url(email).hex(HMAC-SHA256(secret, base64url(email)))
// Deterministic — same email always produces the same token, no stored state needed.
export async function createManageToken(email: string): Promise<string> {
  const key = await getHmacKey();
  const emailB64 = toBase64Url(email);
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(emailB64));
  const sigHex = Array.from(new Uint8Array(sigBuf), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${emailB64}.${sigHex}`;
}

export async function verifyManageToken(token: string): Promise<string | null> {
  const dot = token.indexOf(".");
  if (dot === -1) return null;

  const emailB64 = token.slice(0, dot);
  const sigHex = token.slice(dot + 1);

  let email: string;
  try {
    email = fromBase64Url(emailB64);
  } catch {
    return null;
  }

  const pairs = sigHex.match(/.{2}/g);
  if (!pairs || pairs.length !== 32) return null;
  const sigBytes = new Uint8Array(pairs.map((h) => parseInt(h, 16)));

  const key = await getHmacKey();
  // crypto.subtle.verify is constant-time — prevents timing attacks
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(emailB64));
  return valid ? email : null;
}
