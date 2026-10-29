// US-1, signing in, in a real browser against the real backend.
import { expect, signIn, test } from "./fixtures.ts";

test("AC-1.1: the right password reaches Home within 3 seconds", async ({ page }) => {
  await page.goto("/");
  const started = Date.now();
  await signIn(page, "ayu", "sunrise-42");
  await expect(page.getByRole("heading", { name: "Hello, Ayu Lestari" })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(3000);
});

test("AC-1.2: a wrong password shows the message and stays on Login", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "ayu", "sunset-42");
  await expect(page.getByText("Incorrect username or password.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("AC-1.2: an unknown user gets the same message", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "citra", "sunrise-42");
  await expect(page.getByText("Incorrect username or password.")).toBeVisible();
});

test("AC-1.3: Sign in is disabled while either field is empty", async ({ page }) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "Sign in" });
  await expect(button).toBeDisabled();
  await page.getByLabel("Username").fill("ayu");
  await expect(button).toBeDisabled();
  await page.getByLabel("Username").fill("");
  await page.getByLabel("Password").fill("sunrise-42");
  await expect(button).toBeDisabled();
});
