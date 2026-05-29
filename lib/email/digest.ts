import type { StructuredJob } from "../jobs/types";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function formatJobHtml(job: StructuredJob, index: number): string {
  const location = [job.city, job.country].filter(Boolean).map(esc).join(" • ");
  const salary =
    job.salaryMin > 0
      ? `${job.salaryMin.toLocaleString()}–${job.salaryMax.toLocaleString()} ${esc(job.salaryCurrency)}/${esc(job.salaryPeriod)}`
      : "";
  const skills = job.skills.length > 0 ? job.skills.map(esc).join(" • ") : "";

  const lines = [
    `${index}. <b>${esc(job.title)}</b> / ${esc(job.company)}`,
    location,
    salary,
    skills,
    `<a href="${esc(job.url)}">[Apply]</a>`,
  ].filter(Boolean);

  return lines.join("<br />");
}

// The broadcast HTML uses Resend template variables ({{{contact.jobs}}} triple-brace = unescaped HTML)
// so each recipient sees their personalized job list set via contacts.update before send.
export function buildBroadcastHtml(): string {
  return (
    "Remote backend/platform jobs posted in the last 24h<br /><br />" +
    "{{{contact.jobs}}}<br /><br />" +
    "Scanned: Ashby • Greenhouse • Lever • LinkedIn external postings<br />" +
    "Filtered for: Remote engineering roles • No Easy Apply spam • Fresh postings only<br />" +
    '<a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a><br />' +
    "Low Noise Email. From Lisbon with love."
  );
}
