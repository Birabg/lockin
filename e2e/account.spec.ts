import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
test.afterAll(() => db.$disconnect());

test("deleting an account needs the password and removes it", async ({ page }) => {
  const username = `d${randomBytes(3).toString("hex")}`;
  await page.goto("/signup");
  await page.fill("[name=name]", "Delete Me");
  await page.fill("[name=username]", username);
  await page.fill("[name=email]", `${username}@example.com`);
  await page.fill("[name=password]", "password123");
  await page.getByRole("button", { name: "Join free" }).click();
  await page.waitForURL("**/dashboard**");

  await page.goto("/dashboard/settings");
  await page.getByText("Delete account").click();
  await page.getByLabel("Your password").fill("wrong-password");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText("That password isn't right")).toBeVisible();
  expect(await db.user.count({ where: { username } })).toBe(1);

  await page.getByLabel("Your password").fill("password123");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect.poll(() => db.user.count({ where: { username } })).toBe(0);

  await page.goto("/dashboard/settings");
  await page.waitForURL("**/login**");
});
