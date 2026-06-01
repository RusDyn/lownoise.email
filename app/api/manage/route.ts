import { Resend } from "resend";
import { verifyManageToken } from "@/lib/auth";
import { welcomeHtml } from "@/lib/email/welcome";

export const runtime = "edge";

interface ManageBody {
  token: string;
  stack: string[];
  keywords: string[];
  remote: string;
  location: string;
  timezone: string;
  authCountries: string[];
}

async function findContactByEmail(resend: Resend, segmentId: string, email: string) {
  let after: string | undefined;
  while (true) {
    const { data, error } = await resend.contacts.list({
      segmentId,
      limit: 100,
      ...(after ? { after } : {}),
    });
    if (error || !data || data.data.length === 0) break;
    const found = data.data.find((c) => c.email?.trim().toLowerCase() === email.trim().toLowerCase());
    if (found) return found;
    if (!data.has_more) break;
    after = data.data.at(-1)?.id;
  }
  return null;
}

export async function POST(req: Request) {
  let body: ManageBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid request body" }, { status: 400 });
  }

  const { token, stack = [], keywords = [], remote = "", location = "", timezone = "", authCountries = [] } = body;

  if (!token) {
    return Response.json({ error: "missing token" }, { status: 400 });
  }

  const email = await verifyManageToken(token);
  if (!email) {
    return Response.json({ error: "invalid or expired token" }, { status: 401 });
  }

  if (!Array.isArray(stack) || !Array.isArray(keywords) || !Array.isArray(authCountries)) {
    return Response.json({ error: "invalid field types" }, { status: 400 });
  }

  if (stack.length > 20 || keywords.length > 12 || authCountries.length > 30) {
    return Response.json({ error: "too many values" }, { status: 400 });
  }

  if (
    typeof location !== "string" || location.length > 200 ||
    typeof timezone !== "string" || timezone.length > 20 ||
    typeof remote !== "string" || !["remote", "hybrid", "onsite"].includes(remote) ||
    stack.some((s) => typeof s !== "string" || s.length > 100) ||
    keywords.some((k) => typeof k !== "string" || k.length > 100) ||
    authCountries.some((c) => typeof c !== "string" || c.length > 10)
  ) {
    return Response.json({ error: "invalid field values" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "API key not configured" }, { status: 500 });
  }

  const segmentId = process.env.RESEND_SEGMENT_ID;
  if (!segmentId) {
    return Response.json({ error: "segment not configured" }, { status: 500 });
  }

  const resend = new Resend(apiKey);

  const properties = {
    keywords: [...stack, ...keywords].join(","),
    remote,
    location,
    timezone,
    auth_countries: authCountries.join(","),
  };

  const existing = await findContactByEmail(resend, segmentId, email);

  if (existing) {
    const { error } = await resend.contacts.update({
      id: existing.id,
      properties,
    });
    if (error) {
      console.error("resend contacts.update error", error);
      return Response.json({ error: "failed to update preferences, please try again" }, { status: 502 });
    }
  } else {
    const { error: contactError } = await resend.contacts.create({
      segments: [{ id: segmentId }],
      email,
      unsubscribed: false,
      properties,
    });
    if (contactError) {
      console.error("resend contacts.create error", contactError);
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
      console.error("resend welcome email error", emailError);
    }
  }

  return Response.json({ ok: true });
}
