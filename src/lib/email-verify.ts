import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { canSendEmail, sendEmail } from "./email";
import { emailChangeEmail, securityNoticeEmail, verificationEmail, type SecurityEvent } from "./email-templates";
import { siteUrl } from "./site";
import { VERIFY_FIRST, VERIFY_LINK_TTL_MS, isRestricted, verificationEnforced, type VerifyFields } from "./verification";

// only the hash is stored, so a leaked database can't be used to verify addresses
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * One table holds two kinds of link. A row whose `email` is the account's current address verifies it; a row with
 * any other address is a pending change of email to that address. Changing the email clears every row, so a link
 * sent to an old address can never be read as a change back to it.
 */
async function issueLink(userId: string, email: string, replace: Prisma.EmailVerificationWhereInput): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.emailVerification.deleteMany({ where: { userId, ...replace } }),
    db.emailVerification.create({
      data: { userId, email, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + VERIFY_LINK_TTL_MS) },
    }),
  ]);
  return token;
}

/** Sends a fresh link. Older links for this address stop working, so only the newest email counts. */
export async function sendVerificationEmail(user: { id: string; email: string; name: string }) {
  if (!canSendEmail()) return;
  const token = await issueLink(user.id, user.email, { email: user.email });
  const site = siteUrl();
  await sendEmail({ to: user.email, ...verificationEmail({ name: user.name, url: `${site}/verify-email?token=${token}`, siteUrl: site }) });
}

/** Sends a confirmation link to the new address. Only the newest change request counts. */
export async function sendEmailChangeLink(user: { id: string; email: string; name: string }, newEmail: string) {
  const token = await issueLink(user.id, newEmail, { email: { not: user.email } });
  const site = siteUrl();
  await sendEmail({
    to: newEmail,
    ...emailChangeEmail({ name: user.name, newEmail, url: `${site}/verify-email?token=${token}`, siteUrl: site }),
  });
}

/** A heads-up to an address after its account's sign-in details change. Never throws: it's a courtesy, not a step. */
export async function sendSecurityNotice(to: { email: string; name: string }, event: SecurityEvent, detail?: string) {
  if (!canSendEmail()) return;
  try {
    await sendEmail({ to: to.email, ...securityNoticeEmail({ name: to.name, event, detail, siteUrl: siteUrl() }) });
  } catch (e) {
    console.error("Security notice failed", e);
  }
}

export type VerifyResult =
  { kind: "verified" } | { kind: "changed"; oldEmail: string; newEmail: string; name: string } | { kind: "taken" } | { kind: "invalid" };

/** Uses up a link. Works signed in or out, and never signs anyone in. */
export async function consumeVerificationToken(token: string): Promise<VerifyResult> {
  if (token.length < 20 || token.length > 100) return { kind: "invalid" };
  try {
    return await db.$transaction(async (tx): Promise<VerifyResult> => {
      const row = await tx.emailVerification.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { user: { select: { email: true, name: true } } },
      });
      if (!row) return { kind: "invalid" };
      // whoever deletes the row wins, so a link can't be used twice
      const { count } = await tx.emailVerification.deleteMany({ where: { id: row.id } });
      if (count === 0 || row.expiresAt <= new Date()) return { kind: "invalid" };

      if (row.user.email === row.email) {
        await tx.user.updateMany({ where: { id: row.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
        await tx.emailVerification.deleteMany({ where: { userId: row.userId, email: row.email } });
        return { kind: "verified" };
      }

      // a change of email: the click proves they own the new address
      if (await tx.user.findUnique({ where: { email: row.email }, select: { id: true } })) return { kind: "taken" };
      await tx.user.update({ where: { id: row.userId }, data: { email: row.email, emailVerifiedAt: new Date() } });
      // links and reset tokens sent to the old address must stop working
      await tx.emailVerification.deleteMany({ where: { userId: row.userId } });
      await tx.passwordReset.deleteMany({ where: { userId: row.userId } });
      return { kind: "changed", oldEmail: row.user.email, newEmail: row.email, name: row.user.name };
    });
  } catch (e) {
    // someone else took the address between the check and the update
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { kind: "taken" };
    throw e;
  }
}

/** For actions that need a verified email: an error message, or null when allowed. */
export function verifyGate(user: VerifyFields): string | null {
  return isRestricted(user, new Date(), verificationEnforced()) ? VERIFY_FIRST : null;
}
