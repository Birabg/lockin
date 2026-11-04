"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { allow, clientIp, limits } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-next";
import { isValidTimeZone } from "@/lib/time";

export type FormState = { error?: string } | undefined;

const TOO_MANY = "Too many attempts. Try again in a few minutes.";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(40),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "Username: 3–20 letters, numbers or _"),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  // bcrypt only reads the first 72 bytes
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be 72 characters or fewer"),
  timeZone: z
    .string()
    .max(64)
    .optional()
    .transform((tz) => (tz && isValidTimeZone(tz) ? tz : brand.timeZone)),
});

export async function signup(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, username, email, password, timeZone } = parsed.data;

  if (!(await allow(`signup:${await clientIp()}`, limits.signup))) return { error: TOO_MANY };

  const taken = await db.user.findFirst({ where: { OR: [{ email }, { username }] }, select: { email: true } });
  if (taken) return { error: taken.email === email ? "That email already has an account" : "That username is taken" };

  try {
    const user = await db.user.create({
      data: { name, username, email, timeZone, passwordHash: await bcrypt.hash(password, 10), dailyGoalMin: brand.defaultDailyGoalMin },
    });
    await createSession(user.id);
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

  const user = await db.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return { error: "Wrong email/username or password" };

  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/dashboard");
}
