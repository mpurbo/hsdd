// US-2 and US-3: the profile, staying signed in, signing out.
import { expect, signIn, signOut, test } from "./fixtures.ts";

test("AC-2.1: Home shows the signed-in user's details", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "ayu", "sunrise-42");
  await expect(page.getByRole("heading", { name: "Hello, Ayu Lestari" })).toBeVisible();
  await expect(page.getByText("ayu@example.com")).toBeVisible();
  await expect(page.getByText("14 March 2024")).toBeVisible();
  await expect(page.getByText("ayu", { exact: true })).toBeVisible();
});

test("Budi sees Budi's profile, not Ayu's", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "budi", "harbor-17");
  await expect(page.getByRole("heading", { name: "Hello, Budi Santoso" })).toBeVisible();
  await expect(page.getByText("9 January 2025")).toBeVisible();
  await expect(page.getByText("ayu@example.com")).toHaveCount(0);
});

test("AC-2.2: reloading keeps the user signed in", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "ayu", "sunrise-42");
  await expect(page.getByRole("heading", { name: "Hello, Ayu Lestari" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hello, Ayu Lestari" })).toBeVisible();
});

test("AC-3.1: Sign out returns to Login, and a reload stays there", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "ayu", "sunrise-42");
  await expect(page.getByRole("heading", { name: "Hello, Ayu Lestari" })).toBeVisible();
  await signOut(page);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
