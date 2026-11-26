import { createHash, randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
test.afterAll(() => db.$disconnect());

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

async function signup(page: Page, prefix: string) {
  const username = `${prefix}${randomBytes(3).toString("hex")}`;
  await page.goto("/signup");
  await page.fill("[name=name]", "Security Test");
  await page.fill("[name=username]", username);
  await page.fill("[name=email]", `${username}@example.com`);
  await page.fill("[name=password]", "password123");
  await page.getByRole("button", { name: "Join free" }).click();
  await page.waitForURL("**/dashboard**");
  return username;
}

async function login(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.fill("[name=identifier]", identifier);
  await page.fill("[name=password]", password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("changing the password checks the old one, signs out other devices and keeps this one in", async ({ page, browser }) => {
  const username = await signup(page, "p");

  // a second device, signed in with the old password
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await login(otherPage, username, "password123");
  await otherPage.waitForURL("**/dashboard**");

  await page.goto("/dashboard/settings");
  await page.getByText("Change password").first().click();
  await page.getByLabel("Current password").fill("wrong-password");
  await page.getByLabel("New password", { exact: true }).fill("newpassword456");
  await page.getByLabel("Confirm new password").fill("newpassword456");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Your current password isn't right")).toBeVisible();

  await page.getByLabel("Current password").fill("password123");
  await page.getByLabel("New password", { exact: true }).fill("newpassword456");
  await page.getByLabel("Confirm new password").fill("different789");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("The new passwords don't match")).toBeVisible();

  await page.getByLabel("Current password").fill("password123");
  await page.getByLabel("New password", { exact: true }).fill("newpassword456");
  await page.getByLabel("Confirm new password").fill("newpassword456");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed. Other devices were signed out.")).toBeVisible();

  // this device stays in, the other one is out
  await page.goto("/dashboard/settings");
  await expect(page).toHaveURL(/\/dashboard\/settings/);
  await otherPage.goto("/dashboard/settings");
  await otherPage.waitForURL("**/login**");
  await other.close();

  // the old password no longer works, the new one does
  await page.context().clearCookies();
  await login(page, username, "password123");
  await expect(page.getByText("Wrong email/username or password")).toBeVisible();
  await login(page, username, "newpassword456");
  await page.waitForURL("**/dashboard**");
});

test("sign out other devices keeps only this one", async ({ page, browser }) => {
  const username = await signup(page, "o");
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await login(otherPage, username, "password123");
  await otherPage.waitForURL("**/dashboard**");

  await page.goto("/dashboard/settings");
  await page.getByRole("button", { name: "Sign out others" }).click();
  await expect(page.getByText("Signed out on every other device")).toBeVisible();

  await otherPage.goto("/dashboard/settings");
  await otherPage.waitForURL("**/login**");
  await other.close();
  await page.goto("/dashboard/settings");
  await expect(page).toHaveURL(/\/dashboard\/settings/);
});

test("changing email waits for the new address to confirm", async ({ page }) => {
  const username = await signup(page, "e");
  const user = await db.user.findUniqueOrThrow({ where: { username } });
  const newEmail = `${username}-new@example.com`;

  await page.goto("/dashboard/settings");
  await page.locator("[data-security=Email] summary").click();
  await page.getByLabel("New email").fill(newEmail);
  await page.getByLabel("Password to confirm the change").fill("wrong-password");
  await page.getByRole("button", { name: "Send confirmation link" }).click();
  await expect(page.getByText("That password isn't right")).toBeVisible();

  await page.getByLabel("Password to confirm the change").fill("password123");
  await page.getByRole("button", { name: "Send confirmation link" }).click();
  await expect(page.getByText("Check your new inbox for a link")).toBeVisible();

  // nothing changes until the link is clicked
  expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(user.email);
  const row = await db.emailVerification.findFirstOrThrow({ where: { userId: user.id, email: newEmail } });
  const token = randomBytes(32).toString("base64url");
  await db.emailVerification.update({ where: { id: row.id }, data: { tokenHash: hash(token) } });

  await page.goto(`/verify-email?token=${token}`);
  await expect(page.getByRole("heading", { name: "Email updated ✓" })).toBeVisible();
  const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(after.email).toBe(newEmail);
  expect(after.emailVerifiedAt).not.toBeNull();
  // the signup link to the old address is gone with it
  expect(await db.emailVerification.count({ where: { userId: user.id } })).toBe(0);

  // and the new address signs in
  await page.context().clearCookies();
  await login(page, newEmail, "password123");
  await page.waitForURL("**/dashboard**");
});

test("a Google/GitHub-only account can add a password and then sign in with it", async ({ page }) => {
  const tag = randomBytes(3).toString("hex");
  const username = `g${tag}`;
  const email = `${username}@example.com`;
  await db.user.create({
    data: {
      username,
      name: "OAuth Only",
      email,
      passwordHash: null,
      emailVerifiedAt: new Date(),
      oauthAccounts: { create: { provider: "github", providerUserId: `github-${tag}`, email } },
    },
  });

  // sign in through the fake provider (OAUTH_TEST_MODE, set in playwright.config.ts)
  const profile = Buffer.from(JSON.stringify({ id: `github-${tag}`, email, name: "OAuth Only" })).toString("base64url");
  await page.goto(`/api/auth/github/start?next=/dashboard&test_profile=${profile}`);
  await page.waitForURL("**/dashboard**");

  await page.goto("/dashboard/settings");
  await page.getByText("Add a password").first().click();
  await expect(page.getByLabel("Current password")).toHaveCount(0);
  await page.getByLabel("New password", { exact: true }).fill("addedpass123");
  await page.getByLabel("Confirm new password").fill("addedpass123");
  await page.getByRole("button", { name: "Add password" }).click();
  await expect(page.getByText("Password added")).toBeVisible();

  await page.context().clearCookies();
  await login(page, username, "addedpass123");
  await page.waitForURL("**/dashboard**");
});

test("unknown accounts and wrong passwords get the same answer", async ({ page }) => {
  await login(page, `nobody${randomBytes(3).toString("hex")}`, "password123");
  await expect(page.getByText("Wrong email/username or password")).toBeVisible();
});
