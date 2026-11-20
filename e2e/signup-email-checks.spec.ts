import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const id = () => `e${randomBytes(3).toString("hex")}`;

async function fillSignup(page: Page, email: string) {
  await page.goto("/signup");
  const username = id();
  await page.fill("[name=name]", "Email Check");
  await page.fill("[name=username]", username);
  await page.fill("[name=email]", email);
  await page.fill("[name=password]", "password123");
  return username;
}

test("throwaway email domains are turned away", async ({ page }) => {
  await fillSignup(page, `${id()}@mailinator.com`);
  await page.getByRole("button", { name: "Join free" }).click();
  await expect(page.locator("form [role=alert]")).toHaveText("Please use a permanent email address.");
  await expect(page).toHaveURL(/\/signup/);
});

test("a domain that can't receive mail is turned away", async ({ page }) => {
  // .invalid is reserved and never resolves, so this exercises the real DNS lookup
  await fillSignup(page, `${id()}@no-mail-here-${id()}.invalid`);
  await page.getByRole("button", { name: "Join free" }).click();
  await expect(page.locator("form [role=alert]")).toHaveText("This email domain can't receive mail. Check for typos.");
});

test("a typo'd domain gets a one-click fix, without blocking", async ({ page }) => {
  const local = id();
  await fillSignup(page, `${local}@yaho.com`);
  // the hint appears when they leave the field
  await page.locator("[name=password]").focus();
  const fix = page.getByRole("button", { name: `${local}@yahoo.com` });
  await expect(page.getByText("Did you mean")).toBeVisible();
  await fix.click();
  await expect(page.locator("[name=email]")).toHaveValue(`${local}@yahoo.com`);
  await expect(page.getByText("Did you mean")).toHaveCount(0);
});
