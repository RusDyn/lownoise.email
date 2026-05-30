import { escHtml as esc } from "../html";
import type { StructuredJob } from "../jobs/types";

export const JOB_DIVIDER_HTML =
  '<div style="border-top:1px dashed #d8d3c6;margin:14px 0"></div>';

function timeAgo(ts: number | undefined): string {
  if (!ts || !Number.isFinite(ts)) return "";
  const diffMs = Date.now() - ts;
  if (diffMs <= 0) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return "just now";
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diffMs / 86_400_000);
  return `${days}d ago`;
}

export function formatJobHtml(job: StructuredJob, index: number): string {
  const location = [job.city, job.country].filter(Boolean).map(esc).join(" · ");
  const salary =
    job.salaryMin > 0
      ? `${job.salaryMin.toLocaleString()}–${job.salaryMax.toLocaleString()} ${esc(job.salaryCurrency)}/${esc(job.salaryPeriod)}`
      : "";
  const ago = timeAgo(job.datePosted);

  const titleLine = `<b style="color:#14140f">${index}. ${esc(job.title)}</b> <span style="color:#7a7a6e">/ ${esc(job.company)}</span>`;
  const subLine = [location, salary].filter(Boolean).join(" · ");

  return (
    `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.5">` +
    `<tr>` +
    `<td style="vertical-align:top;color:#14140f">${titleLine}` +
    (subLine ? `<br><span style="color:#7a7a6e;font-size:12px">${subLine}</span>` : "") +
    `</td>` +
    `<td style="vertical-align:top;text-align:right;white-space:nowrap;padding-left:12px">` +
    (ago ? `<span style="color:#3d8a4e;font-size:12px">${esc(ago)}</span><br>` : "") +
    `<a href="${esc(job.url)}" style="color:#3d8a4e;text-decoration:none;font-size:12px">apply ↗</a>` +
    `</td>` +
    `</tr>` +
    `</table>`
  );
}

// The broadcast HTML uses Resend template variables ({{{contact.jobs}}} triple-brace = unescaped HTML)
// so each recipient sees their personalized job list set via contacts.update before send.
export function buildBroadcastHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>your matches — lownoise.email</title>
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
                <div style="color:#7a7a6e;margin-bottom:2px"><span style="color:#3d8a4e">$ </span>cat today's picks</div>
                <div style="font-size:11px;color:#7a7a6e;text-transform:uppercase;letter-spacing:0.04em;margin:14px 0 16px">
                  <span style="color:#3d8a4e">##</span> your matches
                </div>

                {{{contact.jobs}}}

                <div style="margin-top:20px;padding-top:16px;border-top:1px solid #d8d3c6;font-size:11px;color:#7a7a6e">
                  Scanned: Ashby · Greenhouse · Lever · LinkedIn external postings<br>
                  Filtered for: Remote engineering roles · No Easy Apply spam · Fresh postings only
                </div>
              </div>
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="padding-top:24px;font-size:12px;color:#7a7a6e;border-top:1px solid #d8d3c6;margin-top:24px">
              <span style="color:#14140f;font-weight:700">lownoise.email</span> · high-signal engineering jobs, low-effort search<br>
              <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#7a7a6e">Unsubscribe</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
