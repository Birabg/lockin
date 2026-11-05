import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { db } from "./db";

const COOKIE = "lk_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const PLACEHOLDER_SECRET = "change-me-to-a-long-random-string"; // the value in .env.example

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing or too short (see .env.example)");
  // The placeholder is public, so anyone could forge a login with it.
  if (process.env.NODE_ENV === "production" && s === PLACEHOLDER_SECRET)
    throw new Error("Set a real AUTH_SECRET before running in production");
  return new TextEncoder().encode(s);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

async function readSession(): Promise<{ id: string; issuedAt: number } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? { id: payload.sub, issuedAt: payload.iat ?? 0 } : null;
  } catch {
    return null;
  }
}

export type CurrentUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  bio: string | null;
  avatar: string | null;
  dailyGoalMin: number;
  sceneId: string | null;
  clockStyle: string;
  timeZone: string;
};

/** The signed-in user, or null for guests. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const row = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      bio: true,
      avatar: true,
      dailyGoalMin: true,
      timeZone: true,
      sceneId: true,
      clockStyle: true,
      passwordChangedAt: true,
    },
  });
  if (!row) return null;
  const { passwordChangedAt, ...user } = row;
  // sessions are stateless, so this is what signs out every device after a password reset
  if (passwordChangedAt && session.issuedAt < Math.floor(passwordChangedAt.getTime() / 1000)) return null;
  return user;
});

export async function requireUser(next = "/dashboard"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
