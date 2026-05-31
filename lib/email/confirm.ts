import { escHtml } from "../html";

export function confirmationHtml(email: string, confirmUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>confirm your email — lownoise.email</title>
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
                <div style="color:#7a7a6e;margin-bottom:2px"><span style="color:#3d8a4e">$ </span>verify --email</div>
                <h1 style="margin:10px 0 6px;font-size:22px;font-weight:700;letter-spacing:-0.02em;line-height:1.2">
                  confirm your email.
                </h1>
                <p style="margin:0 0 20px;color:#4a4a40;font-size:14px">
                  Click below to confirm <strong>${escHtml(email)}</strong> and set your job preferences.
                </p>

                <a href="${escHtml(confirmUrl)}" style="display:inline-block;background:#3d8a4e;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 20px;border-radius:6px">
                  &rarr; confirm &amp; set preferences
                </a>

                <p style="margin:20px 0 0;color:#7a7a6e;font-size:12px">
                  Link expires in 24 hours. If you didn&apos;t sign up, ignore this email.
                </p>
              </div>
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="padding-top:24px;font-size:12px;color:#7a7a6e;border-top:1px solid #d8d3c6;margin-top:24px">
              <span style="color:#14140f;font-weight:700">lownoise.email</span> · high-signal engineering jobs, low-effort search
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
