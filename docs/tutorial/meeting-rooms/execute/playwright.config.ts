import { defineConfig } from "@playwright/test";

// ADR-002: the run's zone is neither account's nor UTC, so a result that
// depends on the ambient zone shows up here. The runner, its workers and
// the service they start inherit it.
process.env.TZ = "Asia/Kolkata";

// The browser suite: PostgreSQL through the backend's db:up and a database of
// its own, re-created every run (globalSetup); the real service on it (a worker
// fixture in e2e/fixtures.ts, so a test can restart it); and the real web dev
// server (below), driven through the installed Chrome.
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    channel: process.env.PW_CHANNEL ?? "chrome",
    timezoneId: "Asia/Kolkata",
  },
  webServer: {
    command: "npm --prefix web run dev -- --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
