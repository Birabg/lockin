import { brand } from "./brand";

/**
 * Transactional emails: one dark card with the Lockin logo, one button, and a plain-text twin.
 * Colors are set explicitly (not left to the client), so dark-mode mail apps have nothing to invert badly.
 * The logo's padlock comes from /email-mark as a PNG, because mail apps won't show SVG.
 */

export type EmailContent = { subject: string; text: string; html: string };

const COLORS = {
  page: "#0a0a0b",
  card: "#141416",
  border: "#26262b",
  text: "#ececf1",
  muted: "#a1a1aa",
  faint: "#71717a",
  primary: "#4f8ff7",
  primaryShadow: "#2563c9",
  buttonText: "#111113",
  live: "#4ade80",
  liveShadow: "#22a355",
  liveBg: "#0f1f15",
  liveBorder: "#1f4a2c",
};

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
/** The logo's round face. Mail apps that can't load Fredoka fall back to the nearest rounded bold. */
const BRAND_FONT = "Fredoka,'Arial Rounded MT Bold','Helvetica Rounded',Arial,sans-serif";

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
  /** The "lock in" emails: an open green padlock over the heading, waiting to be shut, with a pill above it. */
  hero?: { badge: string };
};

/** The logo as the app shows it: the padlock, then "lock" in blue and "in" in white, in the round face. */
function logo(site: string, size: number) {
  const name = brand.name.toLowerCase();
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;"><img src="${site}/email-mark/mark" width="${size}" height="${size}" alt="" style="display:block;"></td>
<td style="vertical-align:middle;padding-left:${Math.round(size * 0.3)}px;font-family:${BRAND_FONT};font-size:${Math.round(size * 0.86)}px;line-height:1;font-weight:700;letter-spacing:-0.01em;color:${COLORS.text};"><span style="color:${COLORS.primary};">${escapeHtml(name.slice(0, 4))}</span>${escapeHtml(name.slice(4))}</td>
</tr></table>`;
}

export function renderEmail(l: Layout): string {
  const e = escapeHtml;
  const site = e(l.siteUrl);
  const url = e(l.button.url);
  const hero = !!l.hero;
  const accent = hero ? COLORS.live : COLORS.primary;
  const accentShadow = hero ? COLORS.liveShadow : COLORS.primaryShadow;
  const align = hero ? "center" : "left";
  const p = (s: string) =>
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${COLORS.muted};text-align:${align};">${e(s)}</p>`;
  const heroBlock = l.hero
    ? `<tr><td style="padding:8px 24px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.liveBg};background-image:radial-gradient(circle at 50% 0%,#1d3d27 0%,${COLORS.liveBg} 70%);border:1px solid ${COLORS.liveBorder};border-radius:20px;">
<tr><td align="center" style="padding:28px 16px 24px;">
<img src="${site}/email-mark/open" width="72" height="72" alt="" style="display:block;margin:0 auto;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px auto 0;"><tr>
<td style="border-radius:999px;border:1px solid ${COLORS.liveBorder};background:${COLORS.card};padding:6px 14px;font-family:${SANS};font-size:11px;line-height:1;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.live};">${e(l.hero.badge)}</td>
</tr></table>
</td></tr></table>
</td></tr>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@700&display=swap" rel="stylesheet">
<title>${e(l.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(l.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:24px;font-family:${SANS};">
<tr><td align="${align}" style="padding:28px 28px 20px;">
${logo(site, 28)}
</td></tr>
${heroBlock}
<tr><td style="padding:${hero ? 24 : 4}px 28px 4px;">
<h1 style="margin:0 0 12px;font-size:${hero ? 26 : 22}px;line-height:1.25;font-weight:800;letter-spacing:-0.01em;color:${COLORS.text};text-align:${align};">${e(l.heading)}</h1>
${l.paragraphs.map(p).join("\n")}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px ${hero ? "auto" : "0"} 24px;"><tr>
<td style="border-radius:999px;background:${accent};border-bottom:4px solid ${accentShadow};">
<a href="${url}" style="display:inline-block;padding:14px 32px;font-size:16px;line-height:1;font-weight:800;color:${COLORS.buttonText};text-decoration:none;border-radius:999px;">${e(l.button.label)}</a>
</td></tr></table>
<p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${COLORS.faint};text-align:${align};">Button not working? Paste this link into your browser:</p>
<p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;text-align:${align};"><a href="${url}" style="color:${accent};">${url}</a></p>
</td></tr>
<tr><td style="padding:18px 28px 24px;border-top:1px solid ${COLORS.border};">
<p style="margin:0;font-size:12px;line-height:1.6;color:${COLORS.faint};text-align:${align};">${e(l.footer)}</p>
</td></tr>
</table>
<p style="margin:18px 0 0;font-family:${SANS};font-size:12px;color:${COLORS.faint};">${e(brand.name)} · ${e(brand.tagline)}</p>
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

/** A buddy nudged you: the open padlock waiting to be shut, their name, and one button straight to the timer. */
export function nudgeEmail(o: { name: string; actorName: string; url: string; siteUrl: string }): EmailContent {
  const first = o.actorName.split(" ")[0] || o.actorName;
  const intro = `Hey ${o.name.split(" ")[0] || o.name}, ${o.actorName} thinks it's time to lock in. Put your phone face down, pick a length and start a session.`;
  const push = `Every minute counts toward your streak, and ${first} will see you go live.`;
  const footer = `You're getting this because ${o.actorName} is your buddy on ${brand.name}. Each buddy can nudge you once a day.`;
  return {
    subject: `${o.actorName} nudged you to lock in`,
    text: `${o.actorName} nudged you to lock in\n\n${intro}\n\n${push}\n\nLock in now: ${o.url}\n\n${footer}\n`,
    html: renderEmail({
      siteUrl: o.siteUrl,
      preheader: `${first} is waiting on you. Time to lock in.`,
      heading: `${first} nudged you to lock in`,
      paragraphs: [intro, push],
      button: { label: "Lock in now", url: o.url },
      footer,
      hero: { badge: "👋 Nudge" },
    }),
  };
}

/** Sent to the new address when someone asks to change their email. The change only happens when this is clicked. */
export function emailChangeEmail(o: { name: string; newEmail: string; url: string; siteUrl: string }): EmailContent {
  const intro = `Hi ${o.name}, confirm that ${o.newEmail} should be the email address for your ${brand.name} account.`;
  const expiry = "The link works once and expires in 24 hours. Until you click it, your old address stays in place.";
  const footer = `If you didn't ask for this, ignore this email and nothing will change.`;
  return {
    subject: `Confirm your new email for ${brand.name}`,
    text: `${intro}\n\n${expiry}\n\n${o.url}\n\n${footer}\n`,
    html: renderEmail({
      siteUrl: o.siteUrl,
      preheader: "One click to switch your account to this address.",
      heading: "Confirm your new email",
      paragraphs: [intro, expiry],
      button: { label: "Confirm new email", url: o.url },
      footer,
    }),
  };
}

export type SecurityEvent = "password-changed" | "password-set" | "email-change-requested" | "email-changed" | "signed-out-everywhere";

const SECURITY_COPY: Record<SecurityEvent, { subject: string; heading: string; body: (detail?: string) => string }> = {
  "password-changed": {
    subject: `Your ${brand.name} password was changed`,
    heading: "Your password was changed",
    body: () => "The password on your account was just changed, and every other device was signed out.",
  },
  "password-set": {
    subject: `A password was added to your ${brand.name} account`,
    heading: "A password was added",
    body: () => "Your account now has a password, so you can sign in with your email or username as well as Google or GitHub.",
  },
  "email-change-requested": {
    subject: `Someone asked to change your ${brand.name} email`,
    heading: "Email change requested",
    body: (detail) =>
      `Someone signed in to your account asked to change its email to ${detail ?? "a new address"}. It only changes once that address confirms.`,
  },
  "email-changed": {
    subject: `Your ${brand.name} email was changed`,
    heading: "Your email was changed",
    body: (detail) => `Your account's email is now ${detail ?? "a new address"}. This address won't get account emails any more.`,
  },
  "signed-out-everywhere": {
    subject: `You were signed out of ${brand.name} on other devices`,
    heading: "Signed out on other devices",
    body: () => "Every device except the one you used was just signed out of your account.",
  },
};

/** A heads-up to the account's address after something sensitive changes, with a way back in if it wasn't them. */
export function securityNoticeEmail(o: { name: string; event: SecurityEvent; detail?: string; siteUrl: string }): EmailContent {
  const copy = SECURITY_COPY[o.event];
  const intro = `Hi ${o.name}. ${copy.body(o.detail)}`;
  const advice = "If this was you, there's nothing to do. If it wasn't, reset your password straight away.";
  const url = `${o.siteUrl}/forgot-password`;
  const footer = `This is a security notice about your ${brand.name} account. We send these whenever your sign-in details change.`;
  return {
    subject: copy.subject,
    text: `${intro}\n\n${advice}\n\n${url}\n\n${footer}\n`,
    html: renderEmail({
      siteUrl: o.siteUrl,
      preheader: copy.heading,
      heading: copy.heading,
      paragraphs: [intro, advice],
      button: { label: "Reset password", url },
      footer,
    }),
  };
}
