import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { canSendEmail, sendEmail } from "./email";
import { verificationEmail } from "./email-templates";
import { siteUrl } from "./site";
import { VERIFY_FIRST, VERIFY_LINK_TTL_MS, isRestricted, verificationEnforced, type VerifyFields } from "./verification";

// only the hash is stored, so a leaked database can't be used to verify addresses
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Sends a fresh link. Older links for this person stop working, so only the newest email counts. */
export async function sendVerificationEmail(user: { id: string; email: string; name: string }) {
  if (!canSendEmail()) return;
  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.emailVerification.deleteMany({ where: { userId: user.id } }),
    db.emailVerification.create({
      data: { userId: user.id, email: user.email, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + VERIFY_LINK_TTL_MS) },
    }),
  ]);
  const site = siteUrl();
  await sendEmail({ to: user.email, ...verificationEmail({ name: user.name, url: `${site}/verify-email?token=${token}`, siteUrl: site }) });
}

export type VerifyResult = "verified" | "invalid";

/** Uses up a link. Works signed in or out, and never signs anyone in. */
export async function consumeVerificationToken(token: string): Promise<VerifyResult> {
  if (token.length < 20 || token.length > 100) return "invalid";
  return db.$transaction(async (tx) => {
    const row = await tx.emailVerification.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { email: true } } },
    });
    if (!row) return "invalid";
    // whoever deletes the row wins, so a link can't be used twice
    const { count } = await tx.emailVerification.deleteMany({ where: { id: row.id } });
    if (count === 0 || row.expiresAt <= new Date() || row.user.email !== row.email) return "invalid";
    await tx.user.updateMany({ where: { id: row.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
    await tx.emailVerification.deleteMany({ where: { userId: row.userId } });
    return "verified";
  });
}

/** For actions that need a verified email: an error message, or null when allowed. */
export function verifyGate(user: VerifyFields): string | null {
  return isRestricted(user, new Date(), verificationEnforced()) ? VERIFY_FIRST : null;
}
