import { Resend } from "resend";
import { escHtml } from "@/lib/html";

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


function welcomeHtml(b: SubscribeBody): string {
  const remoteLabel: Record<string, string> = {
    remote: "remote only",
    hybrid: "hybrid ok",
    onsite: "onsite ok",
  };

  const row = (label: string, value: string) =>
    value
      ? `<tr>
          <td style="padding:4px 0;color:#7a7a6e;width:140px;vertical-align:top">&gt; ${escHtml(label)}</td>
          <td style="padding:4px 0;color:#14140f">${escHtml(value)}</td>
        </tr>`
      : "";

  const prefs = [
    row("keywords", [...b.stack, ...b.keywords].join(", ")),
    row("remote", remoteLabel[b.remote] ?? b.remote),
    row("location", b.location),
    row("auth_countries", b.authCountries.join(", ")),
  ]
    .filter(Boolean)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>you're subscribed — lownoise.email</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:14px;line-height:1.65;color:#14140f">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:40px 16px">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px" cellpadding="0" cellspacing="0">

          <!-- header -->
          <tr>
            <td style="padding-bottom:24px">
              <span style="font-weight:700;font-size:15px">lownoise<span style="color:#3d8a4e">.</span>email</span>
            </td>
          </tr>

          <!-- terminal card -->
          <tr>
            <td style="background:#ece8df;border:1px solid #d8d3c6;border-radius:8px;overflow:hidden">
              <!-- chrome bar -->
              <div style="padding:10px 14px;border-bottom:1px solid #d8d3c6;font-size:11px;color:#7a7a6e">
                ~/lownoise.email — bash
              </div>
              <!-- body -->
              <div style="padding:22px">
                <div style="color:#7a7a6e;margin-bottom:2px"><span style="color:#3d8a4e">$ </span>echo "subscribed"</div>
                <h1 style="margin:10px 0 6px;font-size:22px;font-weight:700;letter-spacing:-0.02em;line-height:1.2">
                  queued. <span style="color:#3d8a4e">/</span> you're in.
                </h1>
                <p style="margin:0 0 20px;color:#4a4a40;font-size:14px">
                  Your first digest lands <strong>tomorrow at 8 AM PT · 4 PM UTC</strong>.<br>
                  Up to 10 hand-scored engineering roles, matched to your profile below.
                </p>

                <!-- preferences -->
                <div style="background:#f4f1ea;border:1px solid #d8d3c6;border-radius:6px;padding:14px 16px;margin-bottom:20px">
                  <div style="font-size:11px;color:#7a7a6e;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px">
                    <span style="color:#3d8a4e">##</span> your profile
                  </div>
                  <table cellpadding="0" cellspacing="0" style="font-size:13px;width:100%">
                    ${prefs}
                  </table>
                </div>

                <p style="margin:0;color:#7a7a6e;font-size:12px">
                  Wrong preferences? Just reply to any digest — we'll update your profile.<br>
                  Unsubscribe any time via the link in each email.
                </p>
              </div>
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="padding-top:24px;font-size:12px;color:#7a7a6e;border-top:1px solid #d8d3c6;margin-top:24px">
              <span style="color:#14140f;font-weight:700">lownoise.email</span> · high-signal engineering jobs, low-effort search<br>
              You're receiving this because you subscribed at lownoise.email.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!audienceId) {
    return Response.json({ error: "audience not configured" }, { status: 500 });
  }

  const { error: contactError } = await resend.contacts.create({
    audienceId,
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
