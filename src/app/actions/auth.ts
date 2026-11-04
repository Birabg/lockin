"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { safeNext } from "@/lib/safe-next";

export type FormState = { error?: string } | undefined;

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(40),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "Username: 3–20 letters, numbers or _"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signup(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, username, email, password } = parsed.data;

  const taken = await db.user.findFirst({ where: { OR: [{ email }, { username }] }, select: { email: true } });
  if (taken) return { error: taken.email === email ? "That email already has an account" : "That username is taken" };

  const user = await db.user.create({
    data: { name, username, email, passwordHash: await bcrypt.hash(password, 10), dailyGoalMin: brand.defaultDailyGoalMin },
  });
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get("identifier") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!id || !password) return { error: "Enter your email or username and password" };

  const user = await db.user.findFirst({ where: { OR: [{ email: id }, { username: id }] } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return { error: "Wrong email/username or password" };

  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/dashboard");
}
