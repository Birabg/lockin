"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { allow, limits } from "@/lib/rate-limit";
import { isClockStyle } from "@/lib/clock-styles";
import { isSceneId } from "@/lib/scenes";

export async function saveScene(sceneId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first" };
  if (!isSceneId(sceneId)) return { error: "That background is gone" };
  if (!(await allow(`scene:${user.id}`, limits.scene))) return { error: "You're doing that too fast. Try again in a bit." };
  await db.user.update({ where: { id: user.id }, data: { sceneId } });
  return {};
}

export async function saveClockStyle(clockStyle: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first" };
  if (!isClockStyle(clockStyle)) return { error: "That clock style is gone" };
  if (!(await allow(`clock:${user.id}`, limits.scene))) return { error: "You're doing that too fast. Try again in a bit." };
  await db.user.update({ where: { id: user.id }, data: { clockStyle } });
  return {};
}
