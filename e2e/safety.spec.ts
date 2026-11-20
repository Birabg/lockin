import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
test.afterAll(() => db.$disconnect());

const PASSWORD = "password123";

async function person(prefix: string) {
  const username = `${prefix}${randomBytes(3).toString("hex")}`;
  return db.user.create({
    data: {
      username,
      name: `${prefix.toUpperCase()} ${username}`,
      email: `${username}@example.com`,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      emailVerifiedAt: new Date(),
    },
  });
}

async function signIn(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill(username);
  await page.locator("[name=password]").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard**");
}

const card = (page: Page, body: string) => page.locator("article", { hasText: body });

async function openPostMenu(page: Page, body: string) {
  await card(page, body).getByRole("button", { name: "Post options" }).click();
  return card(page, body).getByRole("menu");
}

test("report with a reason, mute, block from a profile, then unblock in settings", async ({ page }) => {
  // many page loads against a remote dev database
  test.setTimeout(240_000);
  const [me, them, r1, r2] = await Promise.all([person("me"), person("them"), person("ra"), person("rb")]);
  const tag = randomBytes(3).toString("hex");
  const reported = await db.post.create({ data: { userId: them.id, body: `Reported post ${tag}` } });
  await db.post.create({ data: { userId: them.id, body: `Muted post ${tag}` } });
  // two people already reported it, so this report is the third
  await db.report.createMany({
    data: [r1, r2].map((r) => ({ reporterId: r.id, targetType: "post", targetId: reported.id, reason: "spam" })),
  });
  await db.follow.createMany({
    data: [
      { followerId: me.id, followingId: them.id },
      { followerId: them.id, followingId: me.id },
    ],
  });

  await signIn(page, me.username);
  await page.goto("/dashboard?tab=global");
  await expect(card(page, `Reported post ${tag}`)).toBeVisible();

  // report: pick a reason, and the post is gone for me now and, as the third report, hidden for everyone
  await (await openPostMenu(page, `Reported post ${tag}`)).getByRole("menuitem", { name: "Report post" }).click();
  const dialog = page.getByRole("dialog", { name: "Report this post" });
  await expect(dialog.getByRole("button", { name: "Report" })).toBeDisabled();
  await dialog.getByLabel("Harassment or bullying").check();
  await dialog.getByRole("button", { name: "Report" }).click();
  await expect(card(page, `Reported post ${tag}`)).toHaveCount(0);
  await expect
    .poll(() => db.report.findFirst({ where: { reporterId: me.id, targetId: reported.id } }).then((r) => r?.reason))
    .toBe("harassment");
  await expect.poll(() => db.post.findUniqueOrThrow({ where: { id: reported.id } }).then((p) => p.hidden)).toBe(true);

  // mute: their posts leave my feed, quietly
  await (await openPostMenu(page, `Muted post ${tag}`)).getByRole("menuitem", { name: `Mute @${them.username}` }).click();
  await expect(card(page, `Muted post ${tag}`)).toHaveCount(0);
  await expect.poll(() => db.mute.count({ where: { muterId: me.id, mutedId: them.id } })).toBe(1);
  await page.reload();
  await expect(page.locator("main")).toBeVisible();
  await expect(card(page, `Muted post ${tag}`)).toHaveCount(0);

  // their profile still shows the muted post: going there is on purpose
  await page.goto(`/dashboard/u/${them.username}`);
  await expect(card(page, `Muted post ${tag}`)).toBeVisible();

  // block from the profile: follows both ways go, and the profile is gone for me
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: `Block @${them.username}` }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard");
  await expect.poll(() => db.block.count({ where: { blockerId: me.id, blockedId: them.id } })).toBe(1);
  expect(await db.follow.count({ where: { OR: [{ followerId: me.id }, { followingId: me.id }] } })).toBe(0);
  expect(await db.mute.count({ where: { muterId: me.id } })).toBe(0);

  // the dashboard streams, so the 404 shows as the page rather than the status code
  await page.goto(`/dashboard/u/${them.username}`);
  await expect(page.getByText("That page doesn’t exist.")).toBeVisible();

  // settings lists them, and unblocking brings the profile back
  await page.goto("/dashboard/settings");
  const blocked = page.locator("[data-list=block]");
  await expect(blocked).toContainText(`@${them.username}`);
  await blocked.getByRole("button", { name: "Unblock" }).click();
  await expect(page.getByText("You haven't blocked anyone.")).toBeVisible();
  expect(await db.block.count({ where: { blockerId: me.id } })).toBe(0);
  await page.goto(`/dashboard/u/${them.username}`);
  await expect(page.getByRole("heading", { name: them.name })).toBeVisible();
});

test("a blocked person sees nothing of mine and can't follow me", async ({ page }) => {
  const [me, them] = await Promise.all([person("bk"), person("bd")]);
  const tag = randomBytes(3).toString("hex");
  await db.post.create({ data: { userId: me.id, body: `Hidden from them ${tag}` } });
  await db.block.create({ data: { blockerId: me.id, blockedId: them.id } });

  await signIn(page, them.username);
  await page.goto("/dashboard?tab=global");
  await expect(page.locator("main")).toBeVisible();
  await expect(card(page, `Hidden from them ${tag}`)).toHaveCount(0);
  await page.goto(`/dashboard/u/${me.username}`);
  await expect(page.getByText("That page doesn’t exist.")).toBeVisible();
  await page.goto(`/dashboard/people?q=${me.username}`);
  await expect(page.getByText(`No one matches`)).toBeVisible();
});
