import "server-only";

const configured = () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;

/** In development a missing key is fine: the message is printed to the terminal instead. */
export const canSendEmail = () => configured() || process.env.NODE_ENV !== "production";

/** One POST to Resend, so this doesn't need their SDK. */
export async function sendEmail(message: { to: string; subject: string; text: string }) {
  if (!configured()) {
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
