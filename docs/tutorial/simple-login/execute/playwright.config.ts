import { defineConfig } from "@playwright/test";

// The browser suite: the real backend (a worker fixture in e2e/fixtures.ts,
// so a test can restart it) and the real web dev server (below), driven
// through the installed Chrome.
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    channel: process.env.PW_CHANNEL ?? "chrome",
  },
  webServer: {
    command: "npm --prefix web run dev -- --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
