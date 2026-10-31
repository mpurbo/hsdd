// US-2 and US-3: the profile, staying signed in, signing out.
import { expect, profileFixture, signIn, signOut, test } from "./fixtures.ts";

const AYU = profileFixture("me-ayu");
const BUDI = profileFixture("me-budi");
/** The whole raw text, character for character: `exact: true` normalizes whitespace. */
const exactly = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

test("AC-2.1: Home shows the signed-in user's details", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "ayu", "sunrise-42");
  await expect(page.getByRole("heading", { name: "Hello, Ayu Lestari" })).toBeVisible();
  await expect(page.getByText("ayu@example.com")).toBeVisible();
  await expect(page.getByText("14 March 2024")).toBeVisible();
  await expect(page.getByText("ayu", { exact: true })).toBeVisible();
  await expect(page.getByText(exactly(AYU.phone!))).toBeVisible();
});

test("AC-2.4: Home shows each account's phone number exactly as stored", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "ayu", "sunrise-42");
  await expect(page.getByText(exactly(AYU.phone!))).toBeVisible();
  await signOut(page);
  await signIn(page, "budi", "harbor-17");
  await expect(page.getByText(exactly(BUDI.phone!))).toBeVisible();
});

test("Budi sees Budi's profile, not Ayu's", async ({ page }) => {
  await page.goto("/");
  await signIn(page, "budi", "harbor-17");
  await expect(page.getByRole("heading", { name: "Hello, Budi Santoso" })).toBeVisible();
  await expect(page.getByText("9 January 2025")).toBeVisible();
  await expect(page.getByText(exactly(BUDI.phone!))).toBeVisible();
  await expect(page.getByText("ayu@example.com")).toHaveCount(0);
  await expect(page.getByText(AYU.phone!)).toHaveCount(0);
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

test("AC-2.3: a session the backend no longer knows returns to Login with the expiry message", async ({ page, backend }) => {
  await page.goto("/");
  await signIn(page, "ayu", "sunrise-42");
  await expect(page.getByRole("heading", { name: "Hello, Ayu Lestari" })).toBeVisible();
  // ADR-001: a restart signs everyone out. profile-api@v2: every rejection
  // gives the same 401 body, so the now-unknown token answers like an expired one.
  await backend.restart();
  await page.reload();
  await expect(page.getByText("Your session has expired. Please sign in again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
