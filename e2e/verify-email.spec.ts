import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
test.afterAll(() => db.$disconnect());

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

test("a new account sees the banner, resends, verifies once, and the banner goes", async ({ page }) => {
  const username = `v${randomBytes(3).toString("hex")}`;
  await page.goto("/signup");
  await page.fill("[name=name]", "Verify Me");
  await page.fill("[name=username]", username);
  await page.fill("[name=email]", `${username}@example.com`);
  await page.fill("[name=password]", "password123");
  await page.getByRole("button", { name: "Join free" }).click();
  await page.waitForURL("**/dashboard**");

  const banner = page.locator("[data-verify-banner]");
  await expect(banner).toContainText("Verify your email");
  await expect(banner).toContainText(`${username}@example.com`);

  // signup sent the first link; the button sends a fresh one and replaces it
  const user = await db.user.findUniqueOrThrow({ where: { username } });
  expect(user.emailVerifiedAt).toBeNull();
  expect(user.legacyUnverified).toBe(false);
  await expect.poll(() => db.emailVerification.count({ where: { userId: user.id } })).toBe(1);
  const first = await db.emailVerification.findFirstOrThrow({ where: { userId: user.id } });

  await banner.getByRole("button", { name: "Resend email" }).click();
  await expect(banner.getByRole("button", { name: "Sent ✓" })).toBeDisabled();
  await expect.poll(async () => (await db.emailVerification.findFirst({ where: { userId: user.id } }))?.id).not.toBe(first.id);

  // only hashes are stored, so swap in a token we know, the way a real email would carry one
  const token = randomBytes(32).toString("base64url");
  await db.emailVerification.updateMany({ where: { userId: user.id }, data: { tokenHash: hash(token) } });

  await page.goto(`/verify-email?token=${token}`);
  await expect(page.getByRole("heading", { name: "Email verified ✓" })).toBeVisible();
  expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).not.toBeNull();
  expect(await db.emailVerification.count({ where: { userId: user.id } })).toBe(0);

  await page.goto("/dashboard");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("[data-verify-banner]")).toHaveCount(0);

  // the link only works once; signed out, a used link says so
  await page.context().clearCookies();
  await page.goto(`/verify-email?token=${token}`);
  await expect(page.getByRole("heading", { name: "That link doesn't work" })).toBeVisible();
});

test("an expired link doesn't verify", async ({ page }) => {
  const username = `x${randomBytes(3).toString("hex")}`;
  const user = await db.user.create({
    data: { username, name: "Expired", email: `${username}@example.com`, passwordHash: "x" },
  });
  const token = randomBytes(32).toString("base64url");
  await db.emailVerification.create({
    data: { userId: user.id, email: user.email, tokenHash: hash(token), expiresAt: new Date(Date.now() - 1000) },
  });

  await page.goto(`/verify-email?token=${token}`);
  await expect(page.getByRole("heading", { name: "That link doesn't work" })).toBeVisible();
  expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).toBeNull();
  await db.user.delete({ where: { id: user.id } });
});

test("resetting a password by email also verifies the address", async ({ page }) => {
  const username = `r${randomBytes(3).toString("hex")}`;
  const user = await db.user.create({
    data: { username, name: "Reset", email: `${username}@example.com`, passwordHash: "x", legacyUnverified: true },
  });
  const token = randomBytes(32).toString("base64url");
  await db.passwordReset.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 60_000) } });

  await page.goto(`/reset-password?token=${token}`);
  await page.locator("[name=password]").fill("newpassword123");
  await page.getByRole("button", { name: /password/i }).click();
  await page.waitForURL("**/login?reset=1");
  expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).not.toBeNull();
  await db.user.delete({ where: { id: user.id } });
});
