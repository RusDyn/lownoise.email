import { Resend } from "resend";
import { createPendingToken } from "@/lib/auth";
import { confirmationHtml } from "@/lib/email/confirm";
import { logger } from "@/lib/logger";

export const runtime = "edge";

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid request body" }, { status: 400 });
  }

  const { email } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "valid email required" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "API key not configured" }, { status: 500 });
  }

  const resend = new Resend(apiKey);

  const token = await createPendingToken(email);
  const origin = new URL(req.url).origin;
  const confirmUrl = `${origin}/confirm?token=${token}`;

  const { error } = await resend.emails.send({
    from: "lownoise.email <jobs@lownoise.email>",
    to: email,
    subject: "confirm your email — lownoise.email",
    html: confirmationHtml(email, confirmUrl),
  });

  if (error) {
    logger.error("resend confirmation email failed", { error });
    return Response.json({ error: "failed to send confirmation email, please try again" }, { status: 502 });
  }

  return Response.json({ ok: true });
}
