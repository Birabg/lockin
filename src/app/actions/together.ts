"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { allow, limits } from "@/lib/rate-limit";

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first");
  return user;
}

const idSchema = z.string().min(1).max(64);
const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{6}$/);

type Result = { error?: string };
const SLOW_DOWN = "You're doing that too fast. Try again in a bit.";

const refresh = () => revalidatePath("/dashboard", "layout");

/** Sends a request, or accepts straight away if they already asked you. */
export async function requestBuddy(targetId: string): Promise<Result> {
  const user = await me();
  const id = idSchema.parse(targetId);
  if (id === user.id) return { error: "You can't buddy yourself" };
  if (!(await allow(`buddy:${user.id}`, limits.buddy))) return { error: SLOW_DOWN };
  if (!(await db.user.findUnique({ where: { id }, select: { id: true } }))) return { error: "That account is gone" };

  const existing = await db.buddy.findFirst({
    where: {
      OR: [
        { requesterId: user.id, addresseeId: id },
        { requesterId: id, addresseeId: user.id },
      ],
    },
  });
  if (existing?.status === "PENDING" && existing.addresseeId === user.id) {
    await db.buddy.update({ where: { id: existing.id }, data: { status: "ACCEPTED" } });
    await notify({ userId: id, actorId: user.id, type: "BUDDY_ACCEPT" });
  } else if (!existing) {
    await db.buddy.create({ data: { requesterId: user.id, addresseeId: id } });
    await notify({ userId: id, actorId: user.id, type: "BUDDY_REQUEST" });
  }
  refresh();
  return {};
}

export async function acceptBuddy(requestId: string): Promise<Result> {
  const user = await me();
  const id = idSchema.parse(requestId);
  const row = await db.buddy.findFirst({ where: { id, addresseeId: user.id, status: "PENDING" } });
  if (!row) return { error: "That request is gone" };
  await db.buddy.update({ where: { id }, data: { status: "ACCEPTED" } });
  await notify({ userId: row.requesterId, actorId: user.id, type: "BUDDY_ACCEPT" });
  refresh();
  return {};
}

/** Declines, cancels or ends a pairing. Either side can do this. */
export async function removeBuddy(requestId: string): Promise<Result> {
  const user = await me();
  const id = idSchema.parse(requestId);
  await db.buddy.deleteMany({ where: { id, OR: [{ requesterId: user.id }, { addresseeId: user.id }] } });
  refresh();
  return {};
}

export async function nudgeBuddy(targetId: string): Promise<Result> {
  const user = await me();
  const id = idSchema.parse(targetId);
  const pair = await db.buddy.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: user.id, addresseeId: id },
        { requesterId: id, addresseeId: user.id },
      ],
    },
    select: { id: true },
  });
  if (!pair) return { error: "You can only nudge your buddies" };
  if (!(await allow(`nudge:${user.id}:${id}`, limits.nudge))) return { error: "You already nudged them this hour" };
  await notify({ userId: id, actorId: user.id, type: "NUDGE" });
  return {};
}

// no 0/O or 1/I, so codes survive being read out loud
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

type FormResult = { error?: string } | undefined;

export async function createRoom(_prev: FormResult, form: FormData): Promise<FormResult> {
  const user = await me();
  const name = z.string().trim().min(1).max(40).safeParse(form.get("name"));
  if (!name.success) return { error: "Give the room a name, up to 40 characters" };
  if (!(await allow(`room:${user.id}`, limits.room))) return { error: SLOW_DOWN };

  let code = newCode();
  for (let attempt = 0; ; attempt++) {
    try {
      await db.room.create({ data: { code, name: name.data, ownerId: user.id, members: { create: { userId: user.id } } } });
      break;
    } catch (e) {
      const clash = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!clash || attempt >= 4) throw e;
      code = newCode();
    }
  }
  refresh();
  redirect(`/dashboard/rooms/${code}`);
}

export async function joinRoom(_prev: FormResult, form: FormData): Promise<FormResult> {
  const user = await me();
  const code = codeSchema.safeParse(form.get("code"));
  if (!code.success) return { error: "Room codes are 6 letters and numbers" };
  if (!(await allow(`join:${user.id}`, limits.room))) return { error: SLOW_DOWN };
  const room = await db.room.findUnique({ where: { code: code.data }, select: { id: true } });
  if (!room) return { error: "No room has that code" };
  await db.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId: user.id } },
    create: { roomId: room.id, userId: user.id },
    update: {},
  });
  refresh();
  redirect(`/dashboard/rooms/${code.data}`);
}

export async function leaveRoom(roomId: string) {
  const user = await me();
  const id = idSchema.parse(roomId);
  await db.roomMember.deleteMany({ where: { roomId: id, userId: user.id } });
  if ((await db.roomMember.count({ where: { roomId: id } })) === 0) await db.room.deleteMany({ where: { id } });
  refresh();
  redirect("/dashboard/rooms");
}
