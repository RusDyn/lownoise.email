import { Resend } from "resend";
import { welcomeHtml } from "@/lib/email/welcome";

export const runtime = "edge";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SubscribeBody {
  email: string;
  stack: string[];
  keywords: string[];
  remote: string;
  location: string;
  authCountries: string[];
}

export async function POST(req: Request) {
  let body: SubscribeBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid request body" }, { status: 400 });
  }

  const { email, stack = [], keywords = [], remote = "", location = "", authCountries = [] } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "valid email required" }, { status: 400 });
  }

  if (!Array.isArray(stack) || !Array.isArray(keywords) || !Array.isArray(authCountries)) {
    return Response.json({ error: "invalid field types" }, { status: 400 });
  }

  if (stack.length > 20 || keywords.length > 12 || authCountries.length > 30) {
    return Response.json({ error: "too many values" }, { status: 400 });
  }

  if (
    typeof location !== "string" || location.length > 200 ||
    stack.some((s) => typeof s !== "string" || s.length > 100) ||
    keywords.some((k) => typeof k !== "string" || k.length > 100) ||
    authCountries.some((c) => typeof c !== "string" || c.length > 10)
  ) {
    return Response.json({ error: "invalid field values" }, { status: 400 });
  }

  const segmentId = process.env.RESEND_SEGMENT_ID;
  if (!segmentId) {
    return Response.json({ error: "segment not configured" }, { status: 500 });
  }

  const { error: contactError } = await resend.contacts.create({
    segments: [{ id: segmentId }],
    email,
    unsubscribed: false,
    properties: {
      keywords: [...stack, ...keywords].join(","),
      remote,
      location,
      auth_countries: authCountries.join(","),
    },
  });

  if (contactError) {
    console.error("resend contact error", contactError);
    return Response.json({ error: "failed to subscribe, please try again" }, { status: 502 });
  }

  const { error: emailError } = await resend.emails.send({
    from: "lownoise.email <jobs@lownoise.email>",
    to: email,
    subject: "you're subscribed — first digest lands tomorrow",
    headers: {
      "List-Unsubscribe": "<mailto:hi@lownoise.email?subject=unsubscribe>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    html: welcomeHtml({ email, stack, keywords, remote, location, authCountries }),
  });

  if (emailError) {
    // Contact was created — don't fail the request, just log
    console.error("resend welcome email error", emailError);
  }

  return Response.json({ ok: true });
}
