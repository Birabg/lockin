import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function signUp(page: Page) {
  const username = `m${randomBytes(3).toString("hex")}`;
  await page.goto("/signup");
  await page.fill("[name=name]", `Music ${username}`);
  await page.fill("[name=username]", username);
  await page.fill("[name=email]", `${username}@example.com`);
  await page.fill("[name=password]", "password123");
  await page.getByRole("button", { name: "Join free" }).click();
  await page.waitForURL("**/dashboard**");
}

async function holdToStart(page: Page) {
  await page.getByRole("button", { name: "Hold to lock in" }).hover();
  await page.mouse.down();
  await page.locator("[data-immersive-view]").waitFor();
  await page.mouse.up();
}

test("pick a sound on the focus screen, keep it through a session, and come back to it", async ({ page }) => {
  await signUp(page);

  // the session dock hides after a few idle seconds; moving the mouse brings it back
  const wake = async () => {
    await page.mouse.move(300, 300);
    await page.mouse.move(320, 320);
  };

  await page.goto("/dashboard/timer");
  const setupDock = page.getByRole("toolbar", { name: "Focus tools" });
  const music = setupDock.getByRole("button", { name: "Music" });
  await music.click();
  const panel = page.getByRole("dialog", { name: "Music" });
  await panel.getByRole("button", { name: /^Rain/ }).click();
  await expect(panel.getByRole("button", { name: /^Rain/ })).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByRole("button", { name: /^Off/ })).toHaveAttribute("aria-pressed", "false");
  // lit once the browser has really started the audio
  await expect(music).toHaveAttribute("data-on", "true");

  // the instruments are generated too
  for (const name of [/^Piano/, /^Violin/, /^Saxophone/, /^Acoustic guitar/]) {
    await panel.getByRole("button", { name }).click();
    await expect(panel.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
    await expect(music).toHaveAttribute("data-on", "true");
  }

  await panel.getByRole("button", { name: /^Lo-fi keys/ }).click();
  await panel.getByLabel("Volume").fill("30");
  await expect(panel.getByRole("button", { name: /^Lo-fi keys/ })).toHaveAttribute("aria-pressed", "true");

  // starting a session doesn't stop it
  await page.keyboard.press("Escape");
  await holdToStart(page);
  const sessionMusic = page.getByRole("toolbar", { name: "Session tools" }).getByRole("button", { name: "Music" });
  await expect(sessionMusic).toHaveAttribute("data-on", "true");
  await wake();
  await sessionMusic.click();
  await expect(page.getByRole("dialog", { name: "Music" }).getByRole("button", { name: /^Lo-fi keys/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("dialog", { name: "Music" }).getByRole("button", { name: /^Off/ }).click();
  await expect(sessionMusic).not.toHaveAttribute("data-on");

  // the choice and volume are remembered, and nothing plays until a press
  await page
    .getByRole("dialog", { name: "Music" })
    .getByRole("button", { name: /^Brown noise/ })
    .click();
  await page.reload();
  const again = page.getByRole("toolbar", { name: "Session tools" }).getByRole("button", { name: "Music" });
  await expect(again).not.toHaveAttribute("data-on");
  await page.mouse.click(5, 450);
  await expect(again).toHaveAttribute("data-on", "true");
  await wake();
  await again.click();
  const after = page.getByRole("dialog", { name: "Music" });
  await expect(after.getByRole("button", { name: /^Brown noise/ })).toHaveAttribute("aria-pressed", "true");
  await expect(after.getByLabel("Volume")).toHaveValue("30");
});

test("paste a YouTube link and it plays as sound only, with a now-playing pill above the dock that stays through the session", async ({
  page,
}) => {
  // keep the test off the network: the hidden player frame just fails to load
  await page.route(/^https:\/\/[^/]*youtube(-nocookie)?\.com\//, (route) => route.abort());
  await signUp(page);
  await page.goto("/dashboard/timer");

  const music = page.getByRole("toolbar", { name: "Focus tools" }).getByRole("button", { name: "Music" });
  await music.click();
  const panel = page.getByRole("dialog", { name: "Music" });
  const input = panel.getByLabel("YouTube link");
  const bar = page.getByRole("region", { name: "YouTube now playing" });
  const frame = page.locator("iframe[data-youtube-frame]");

  await input.fill("lofi beats to study to");
  await panel.getByRole("button", { name: "Play", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("doesn’t look like a YouTube");
  await expect(bar).toHaveCount(0);
  await expect(frame).toHaveCount(0);

  await input.fill("https://youtu.be/jfKfPfyJRdk?si=share");
  await panel.getByRole("button", { name: "Play", exact: true }).click();
  // the embed is there but out of sight; the pill stands in for it
  await expect(frame).toHaveAttribute("src", /^https:\/\/www\.youtube-nocookie\.com\/embed\/jfKfPfyJRdk\?/);
  await expect(frame).toHaveAttribute("aria-hidden", "true");
  await expect(frame).not.toBeInViewport();
  await expect(music).toHaveAttribute("data-on", "true");
  await expect(panel.getByRole("button", { name: /^Your YouTube link/ })).toHaveAttribute("aria-pressed", "true");
  await expect(input).toHaveValue("");
  // the pill makes way while a dock menu is open, and sits just above the dock otherwise
  await expect(bar).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(bar).toBeVisible();
  const [pillBox, dockBox] = await Promise.all([bar.boundingBox(), page.getByRole("toolbar", { name: "Focus tools" }).boundingBox()]);
  expect(pillBox!.y + pillBox!.height).toBeLessThanOrEqual(dockBox!.y);
  expect(Math.abs(pillBox!.x + pillBox!.width / 2 - (dockBox!.x + dockBox!.width / 2))).toBeLessThan(2);
  await expect(bar).toContainText("YouTube");
  await expect(bar.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(bar.getByRole("link", { name: "Open on YouTube" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=jfKfPfyJRdk");

  // picking a generated sound stops YouTube, and the link stays for later
  await music.click();
  await panel.getByRole("button", { name: /^Rain/ }).click();
  await expect(frame).toHaveCount(0);
  await panel.getByRole("button", { name: /^Your YouTube link/ }).click();
  await expect(frame).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(bar).toBeVisible();

  // a session doesn’t interrupt it
  await holdToStart(page);
  await expect(bar).toBeVisible();
  await expect(frame).toHaveCount(1);

  // stop removes the pill and the player
  await page.mouse.move(300, 300);
  await page.mouse.move(320, 320);
  await bar.getByRole("button", { name: "Stop YouTube" }).click();
  await expect(bar).toHaveCount(0);
  await expect(frame).toHaveCount(0);

  // after a reload the saved link is still there to pick
  await page.reload();
  await page.locator("[data-immersive-view]").waitFor();
  // the dock shows on mouse movement and hides when idle, so keep nudging until the click lands
  await expect(async () => {
    await page.mouse.move(300, 300);
    await page.mouse.move(320, 320);
    await page.getByRole("toolbar", { name: "Session tools" }).getByRole("button", { name: "Music" }).click({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await page
    .getByRole("dialog", { name: "Music" })
    .getByRole("button", { name: /^Your YouTube link/ })
    .click();
  await expect(frame).toHaveAttribute("src", /embed\/jfKfPfyJRdk/);
  await page.keyboard.press("Escape");
  await expect(bar).toBeVisible();
});
