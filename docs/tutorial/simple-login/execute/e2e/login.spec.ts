// US-1, signing in, in a real browser against the real backend.
import { expect, signIn, test } from "./fixtures.ts";

test("AC-1.1: the right password reaches Home within 3 seconds", async ({ page }) => {
  await page.goto("/");
  const started = Date.now();
  await signIn(page, "ayu", "sunrise-42");
  await expect(page.getByRole("heading", { name: "Hello, Ayu Lestari" })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(3000);
});
