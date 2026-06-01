import { Resend } from "resend";
import { createManageToken } from "@/lib/auth";
import { findContactByEmail } from "@/lib/contacts";
import { manageLinkHtml } from "@/lib/email/manage-link";

export const runtime = "edge";

const resend = new Resend(process.env.RESEND_API_KEY);

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

  // Look up the contact (default: excludes unsubscribed — only send to active subscribers)
  const contact = await findContactByEmail(email);
  if (!contact) {
    // Non-enumeration: always return ok whether the email exists or not
    return Response.json({ ok: true });
  }

  const token = await createManageToken(email);
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? "https://lownoise.email").replace(/\/+$/, "");
  const manageUrl = `${base}/manage?token=${encodeURIComponent(token)}`;

  const { error } = await resend.emails.send({
    from: "lownoise.email <jobs@lownoise.email>",
    to: email,
    subject: "your manage preferences link — lownoise.email",
    html: manageLinkHtml(email, manageUrl),
  });

  if (error) {
    console.error("resend manage-link email error", error);
    // Still return ok — don't leak whether the send succeeded
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}
