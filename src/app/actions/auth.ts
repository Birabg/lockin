"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { checkNewEmail } from "@/lib/email-domain";
import { sendVerificationEmail } from "@/lib/email-verify";
import { BANNED_MESSAGE, providerName } from "@/lib/oauth-flow";
import { clearPending, finishPendingLink, readPending } from "@/lib/oauth-session";
import { allow, clientIp, limits } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-next";
import { isValidTimeZone } from "@/lib/time";
import { usernameSchema } from "@/lib/username";

export type FormState = { error?: string; suggestion?: string } | undefined;

const TOO_MANY = "Too many attempts. Try again in a few minutes.";
const WRONG_LOGIN = "Wrong email/username or password";

// made once per server instance, at the same cost as real hashes
let dummy: Promise<string> | undefined;
const dummyHash = () => (dummy ??= bcrypt.hash("lockin-no-such-account", 10));

const timeZoneSchema = z
  .string()
  .max(64)
  .optional()
  .transform((tz) => (tz && isValidTimeZone(tz) ? tz : brand.timeZone));

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(40),
  username: usernameSchema,
  email: z.string().max(254),
  // bcrypt only reads the first 72 bytes
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be 72 characters or fewer"),
  timeZone: timeZoneSchema,
});

export async function signup(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, username, password, timeZone } = parsed.data;

  if (!(await allow(`signup:${await clientIp()}`, limits.signup))) return { error: TOO_MANY };

  // format, throwaway domains, and whether the domain can receive mail at all
  const checked = await checkNewEmail(parsed.data.email);
  if (!checked.ok) return { error: checked.error, suggestion: checked.suggestion };
  const { email } = checked;

  const taken = await db.user.findFirst({ where: { OR: [{ email }, { username }] }, select: { email: true } });
  if (taken) return { error: taken.email === email ? "That email already has an account" : "That username is taken" };

  try {
    const user = await db.user.create({
      data: { name, username, email, timeZone, passwordHash: await bcrypt.hash(password, 10), dailyGoalMin: brand.defaultDailyGoalMin },
    });
    await createSession(user.id);
    // sent after the response, so a slow email provider doesn't hold up signup
    after(() => sendVerificationEmail(user).catch((e) => console.error("Verification email failed", e)));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "That email or username is taken" };
    throw e;
  }
  redirect(safeNext(form.get("next")));
}

const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1).max(254),
  password: z.string().min(1).max(200),
});

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your email or username and password" };
  const { identifier, password } = parsed.data;

  const allowed =
    (await allow(`login-ip:${await clientIp()}`, limits.loginIp)) && (await allow(`login:${identifier}`, limits.loginAccount));
  if (!allowed) return { error: TOO_MANY };

  const user = await db.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      bannedAt: true,
      oauthAccounts: { select: { provider: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (user && !user.passwordHash) {
    const names = user.oauthAccounts.map((a) => providerName(a.provider === "github" ? "github" : "google"));
    return { error: `This account uses ${names.join(" or ") || "Google"} sign-in. Use the button above.` };
  }
  if (!user) {
    // still spend a bcrypt compare, so the response time doesn't tell which emails and usernames have accounts
    await bcrypt.compare(password, await dummyHash());
    return { error: WRONG_LOGIN };
  }
  if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) return { error: WRONG_LOGIN };
  // only said after the right password, so it doesn't tell strangers which accounts are suspended
  if (user.bannedAt) return { error: BANNED_MESSAGE };

  await createSession(user.id);
  // they may have come from "sign in with your password to connect Google"
  const linked = await finishPendingLink(user);
  redirect(linked ? `/dashboard/settings?connected=${linked}` : safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/dashboard");
}

/** For the username picker's live check. */
export async function checkUsername(raw: string): Promise<{ ok: boolean; message: string }> {
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (!(await allow(`username-check:${await clientIp()}`, limits.usernameCheck))) return { ok: false, message: "Slow down a little" };
  const taken = await db.user.findUnique({ where: { username: parsed.data }, select: { id: true } });
  return taken ? { ok: false, message: "That username is taken" } : { ok: true, message: `@${parsed.data} is free` };
}

const welcomeSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(40),
  username: usernameSchema,
  timeZone: timeZoneSchema,
});

/** The last step of a first Google/GitHub sign-in: pick a username, and the account is made. */
export async function completeOAuthSignup(_prev: FormState, form: FormData): Promise<FormState> {
  const pending = await readPending("signup");
  if (!pending) return { error: "That sign-in took too long. Start again from the sign-up page." };
  if (await getCurrentUser()) return { error: "You're already signed in." };
  const parsed = welcomeSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, username, timeZone } = parsed.data;
  if (!(await allow(`signup:${await clientIp()}`, limits.signup))) return { error: TOO_MANY };

  try {
    const user = await db.user.create({
      data: {
        name,
        username,
        email: pending.email,
        timeZone,
        passwordHash: null,
        dailyGoalMin: brand.defaultDailyGoalMin,
        // the provider verified this address
        emailVerifiedAt: new Date(),
        oauthAccounts: { create: { provider: pending.provider, providerUserId: pending.providerUserId, email: pending.email } },
      },
    });
    await createSession(user.id);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String(e.meta?.target ?? "");
      if (target.includes("username")) return { error: "That username was just taken. Try another." };
      return { error: "An account with this email or login already exists. Sign in instead." };
    }
    throw e;
  }
  await clearPending();
  redirect(safeNext(pending.next));
}
