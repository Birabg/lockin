import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Google/GitHub sign-in against the fake provider (OAUTH_TEST_MODE, set in playwright.config.ts).
 * Everything after the provider is real: the state cookie, the callback, linking, the username picker and the session.
 */

const db = new PrismaClient();
test.afterAll(() => db.$disconnect());

const hex = () => randomBytes(4).toString("hex");

/** Starts sign-in the way the button does, with the profile the fake provider will hand back. */
async function continueWith(
  page: Page,
  provider: "google" | "github",
  profile: { id: string; email: string | null; name: string },
  intent?: "link",
) {
  const q = new URLSearchParams({ next: "/dashboard", test_profile: Buffer.from(JSON.stringify(profile)).toString("base64url") });
  if (intent) q.set("intent", intent);
  await page.goto(`/api/auth/${provider}/start?${q}`);
}

test("first Google sign-in picks a username, then password login is refused cleanly", async ({ page }) => {
  const tag = hex();
  const email = `g${tag}@example.com`;

  // the buttons are on both pages
  await page.goto("/signup");
  await expect(page.locator("[data-oauth=google]")).toHaveText("Continue with Google");
  await expect(page.locator("[data-oauth=github]")).toHaveText("Continue with GitHub");
  await expect(page.getByRole("separator", { name: "or" })).toBeVisible();

  await continueWith(page, "google", { id: `google-${tag}`, email, name: "Gina Oauth" });
  await page.waitForURL("**/welcome");
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Gina Oauth");
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue("gina_oauth");

  // a taken name is caught as they type
  const taken = await db.user.create({ data: { username: `t_${tag}`, name: "Taken", email: `t${tag}@example.com`, passwordHash: "x" } });
  await page.getByLabel("Username", { exact: true }).fill(taken.username);
  await expect(page.getByText("That username is taken")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create my account" })).toBeDisabled();
  await db.user.delete({ where: { id: taken.id } });

  const username = `g_${tag}`;
  await page.getByLabel("Username", { exact: true }).fill(username.toUpperCase());
  await expect(page.getByText(`@${username} is free`)).toBeVisible();
  await page.getByRole("button", { name: "Create my account" }).click();
  await page.waitForURL("**/dashboard**");

  const user = await db.user.findUniqueOrThrow({ where: { username }, include: { oauthAccounts: true } });
  expect(user.email).toBe(email);
  expect(user.passwordHash).toBeNull();
  expect(user.emailVerifiedAt).not.toBeNull();
  expect(user.oauthAccounts).toMatchObject([{ provider: "google", providerUserId: `google-${tag}` }]);
  // verified, so no banner
  await expect(page.locator("[data-verify-banner]")).toHaveCount(0);

  // settings: the only way in can't be removed
  await page.goto("/dashboard/settings");
  const row = page.locator("[data-linked=google]");
  await expect(row).toContainText(email);
  await expect(row.getByRole("button", { name: "Disconnect" })).toBeDisabled();

  // signed out, a password login for this account explains itself
  await page.context().clearCookies();
  await page.goto("/login");
  await expect(page.getByText("Email or username")).toBeVisible();
  await page.fill("[name=identifier]", username);
  await page.fill("[name=password]", "anything-at-all");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("form [role=alert]")).toHaveText("This account uses Google sign-in. Use the button above.");

  // signing in again with Google goes straight in
  await continueWith(page, "google", { id: `google-${tag}`, email, name: "Gina Oauth" });
  await page.waitForURL("**/dashboard**");

  // and the account can be deleted by typing the username
  await page.goto("/dashboard/settings");
  await page.getByText("Delete account").click();
  await page.getByLabel("Type your username to confirm").fill("wrong");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText("Type your username exactly to confirm")).toBeVisible();
  await page.getByLabel("Type your username to confirm").fill(username);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect.poll(() => db.user.count({ where: { username } })).toBe(0);
  expect(await db.oAuthAccount.count({ where: { providerUserId: `google-${tag}` } })).toBe(0);
});

test("GitHub links to a verified account with the same email", async ({ page }) => {
  const tag = hex();
  const user = await db.user.create({
    data: {
      username: `v_${tag}`,
      name: "Verified",
      email: `v${tag}@example.com`,
      passwordHash: await bcrypt.hash("password123", 10),
      emailVerifiedAt: new Date(),
    },
  });

  await continueWith(page, "github", { id: `gh-${tag}`, email: user.email, name: "Verified" });
  await page.waitForURL("**/dashboard**");
  expect(await db.oAuthAccount.findFirst({ where: { userId: user.id, provider: "github" } })).toMatchObject({
    providerUserId: `gh-${tag}`,
  });

  // with a password and GitHub, either one can go
  await page.goto("/dashboard/settings");
  await page.locator("[data-linked=github]").getByRole("button", { name: "Disconnect" }).click();
  await expect(page.locator("[data-linked=github]")).toHaveCount(0);
  expect(await db.oAuthAccount.count({ where: { userId: user.id } })).toBe(0);
  await db.user.delete({ where: { id: user.id } });
});

test("an unverified account with the same email must sign in with its password first", async ({ page }) => {
  const tag = hex();
  const user = await db.user.create({
    data: { username: `u_${tag}`, name: "Unverified", email: `u${tag}@example.com`, passwordHash: await bcrypt.hash("password123", 10) },
  });

  await continueWith(page, "google", { id: `google-${tag}`, email: user.email, name: "Unverified" });
  await page.waitForURL("**/login?link=google**");
  await expect(page.getByText("Sign in with its password once to connect Google")).toBeVisible();
  // nothing is linked until the password proves it
  expect(await db.oAuthAccount.count({ where: { userId: user.id } })).toBe(0);

  await page.fill("[name=identifier]", user.email);
  await page.fill("[name=password]", "password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard/settings?connected=google");
  await expect(page.getByText("Google is connected")).toBeVisible();

  const after = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { oauthAccounts: true } });
  expect(after.oauthAccounts).toMatchObject([{ provider: "google", providerUserId: `google-${tag}` }]);
  // Google vouched for the address
  expect(after.emailVerifiedAt).not.toBeNull();
  await db.user.delete({ where: { id: user.id } });
});

test("a callback without this browser's state is refused", async ({ page }) => {
  await page.goto(
    `/api/auth/google/callback?state=forged&code=${Buffer.from(JSON.stringify({ id: "x", email: "x@example.com" })).toString("base64url")}`,
  );
  await page.waitForURL("**/login?oauth_error=failed**");
  await expect(page.getByText("Google sign-in didn't work. Try again.")).toBeVisible();
});

test("a GitHub account with no verified email can't sign up", async ({ page }) => {
  await continueWith(page, "github", { id: `gh-${hex()}`, email: null, name: "No Email" });
  await page.waitForURL("**/login?oauth_error=no-email**");
  await expect(page.getByText("Your GitHub account has no verified email.")).toBeVisible();
});
