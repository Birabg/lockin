"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { allow, limits } from "@/lib/rate-limit";
import { isSceneId } from "@/lib/scenes";

export async function saveScene(sceneId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first" };
  if (!isSceneId(sceneId)) return { error: "That background is gone" };
  if (!(await allow(`scene:${user.id}`, limits.scene))) return { error: "You're doing that too fast. Try again in a bit." };
  await db.user.update({ where: { id: user.id }, data: { sceneId } });
  return {};
}
