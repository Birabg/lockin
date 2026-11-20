import "server-only";

const configured = () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;

/**
 * Without a Resend key, emails are printed to the terminal instead: always in development,
 * and in a production build only when EMAIL_LOG_ONLY=1 (the Playwright tests set it).
 */
const logOnly = () => process.env.NODE_ENV !== "production" || process.env.EMAIL_LOG_ONLY === "1";

export const canSendEmail = () => configured() || logOnly();

/** One POST to Resend, so this doesn't need their SDK. */
export async function sendEmail(message: { to: string; subject: string; text: string; html?: string }) {
  if (!configured()) {
    if (!logOnly()) throw new Error("Email isn't set up (RESEND_API_KEY and EMAIL_FROM)");
    console.log(`[email to ${message.to}] ${message.subject}\n${message.text}`);
    return;
  }
  const res = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, ...message }),
  });
  if (!res.ok) throw new Error(`Email failed: ${res.status}`);
}
