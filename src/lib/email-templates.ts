import { brand } from "./brand";

/**
 * Transactional emails: one dark card, the logo, one button, and a plain-text twin.
 * Colors are set explicitly (not left to the client), so dark-mode mail apps have nothing to invert badly.
 */

export type EmailContent = { subject: string; text: string; html: string };

const COLORS = {
  page: "#0d0d0f",
  card: "#1c1c20",
  border: "#2a2a30",
  text: "#ececf1",
  muted: "#a1a1aa",
  button: "#4f8ff7",
  buttonText: "#111113",
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

type Layout = {
  siteUrl: string;
  /** Shown by mail apps next to the subject. */
  preheader: string;
  heading: string;
  paragraphs: string[];
  button: { label: string; url: string };
  footer: string;
};

export function renderEmail(l: Layout): string {
  const e = escapeHtml;
  const url = e(l.button.url);
  const p = (s: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text}">${e(s)}</p>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${e(l.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(l.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="padding:32px 32px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;"><img src="${e(l.siteUrl)}/pwa-icon/192" width="36" height="36" alt="" style="display:block;border-radius:10px;"></td>
<td style="vertical-align:middle;padding-left:10px;font-size:18px;font-weight:800;color:${COLORS.text};">${e(brand.name.toLowerCase())}</td>
</tr></table>
</td></tr>
<tr><td style="padding:16px 32px 8px;">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:800;color:${COLORS.text}">${e(l.heading)}</h1>
${l.paragraphs.map(p).join("\n")}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr>
<td style="border-radius:999px;background:${COLORS.button};">
<a href="${url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:${COLORS.buttonText};text-decoration:none;border-radius:999px;">${e(l.button.label)}</a>
</td></tr></table>
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${COLORS.muted}">Button not working? Paste this link into your browser:</p>
<p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${url}" style="color:${COLORS.button};">${url}</a></p>
</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid ${COLORS.border};">
<p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.muted}">${e(l.footer)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function verificationEmail(o: { name: string; url: string; siteUrl: string }): EmailContent {
  const intro = `Hi ${o.name}, confirm this is your email address and you're all set to post, comment and climb the leaderboard on ${brand.name}.`;
  const expiry = "The link works once and expires in 24 hours.";
  const footer = `You're getting this because someone signed up for ${brand.name} with this address. If it wasn't you, ignore this email and nothing will happen.`;
  return {
    subject: `Verify your email for ${brand.name}`,
    text: `${intro}\n\n${expiry}\n\n${o.url}\n\n${footer}\n`,
    html: renderEmail({
      siteUrl: o.siteUrl,
      preheader: "One click to confirm your email address.",
      heading: "Verify your email",
      paragraphs: [intro, expiry],
      button: { label: "Verify email", url: o.url },
      footer,
    }),
  };
}

export function passwordResetEmail(o: { url: string; siteUrl: string }): EmailContent {
  const intro = `Use the button below to choose a new password for ${brand.name}. It also confirms this email address.`;
  const expiry = "The link works once and expires in 1 hour. Resetting signs you out on every device.";
  const footer = "If you didn't ask for this, ignore this email. Your password won't change.";
  return {
    subject: `Reset your ${brand.name} password`,
    text: `${intro}\n\n${expiry}\n\n${o.url}\n\n${footer}\n`,
    html: renderEmail({
      siteUrl: o.siteUrl,
      preheader: "Choose a new password.",
      heading: "Reset your password",
      paragraphs: [intro, expiry],
      button: { label: "Choose a new password", url: o.url },
      footer,
    }),
  };
}
