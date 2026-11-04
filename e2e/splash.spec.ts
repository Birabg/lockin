import { expect, test } from "@playwright/test";

const splash = (page: import("@playwright/test").Page) => page.locator("html[data-splash]");

test("plays on the first visit of a session, and not again", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator(".splash")).toBeVisible();
  await expect(splash(page)).toHaveCount(0, { timeout: 7000 });
  await expect(page.locator(".splash")).toBeHidden();

  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(splash(page)).toHaveCount(0);
});

test("a key press skips it, and doesn't reach the page", async ({ page }) => {
  await page.goto("/login");
  await page.locator(".splash").waitFor();
  await page.waitForFunction(() => document.fonts.status === "loaded");
  await page.keyboard.press("a");
  await expect(splash(page)).toHaveCount(0, { timeout: 1000 });
  await expect(page.locator("[name=identifier]")).toHaveValue("");
});
