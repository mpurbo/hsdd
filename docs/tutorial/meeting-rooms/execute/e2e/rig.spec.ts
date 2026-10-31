// The rig's own properties: the run's time zone, the database of its own,
// the service's start and stop, and the helpers in e2e/api.ts.
import { expect, test } from "./fixtures.ts";

// ICU reports a link's canonical name (Asia/Kolkata is Asia/Calcutta on some
// builds), so the expected name comes from the same runtime's Intl, not a literal.
const KOLKATA = new Intl.DateTimeFormat("en", { timeZone: "Asia/Kolkata" }).resolvedOptions().timeZone;

test("the run is in Asia/Kolkata: the worker and the browser", async ({ page }) => {
  expect(process.env.TZ).toBe("Asia/Kolkata");
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(KOLKATA);
  expect(new Date("2026-11-05T00:00:00.000Z").getHours()).toBe(5); // +05:30
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(KOLKATA);
});
