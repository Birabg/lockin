import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // a remote dev database (e.g. Neon from far away) makes each server action take a second or more
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    // PW_CHANNEL=chrome uses an installed Chrome instead of Playwright's download
    channel: process.env.PW_CHANNEL,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    // run npm run build first
    command: `npx next start -p ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      // print emails to the log instead of needing a Resend key, so the verification banner and resend work
      EMAIL_LOG_ONLY: "1",
      // example.com has a "null MX" (it takes no mail), so the tests' throwaway accounts skip the DNS check
      EMAIL_TEST_DOMAINS: "example.com",
      // Google/GitHub sign-in with a fake provider; refused anywhere on Vercel
      OAUTH_TEST_MODE: "1",
    },
  },
});
