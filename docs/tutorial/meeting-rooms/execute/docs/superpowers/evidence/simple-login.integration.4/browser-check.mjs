// simple-login.integration.4 browser checks, against `npm run dev` (the real
// service on the developer database `meeting_rooms`, and the web dev server).
// Run from the repository root while `npm run dev` is up:
//   node docs/superpowers/evidence/simple-login.integration.4/browser-check.mjs
// Writes browser-check.out.json and the PNGs beside this file. It books only
// for budi, on London dates wholly in GMT at least 90 days ahead, and cancels
// every booking it made before it exits.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { LONDON, addDays, britishWinterDate, homeLine, todayIn, wallTimeInstants } from "../../../../e2e/time.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SERVICE = "http://127.0.0.1:3000";
const APP = "http://localhost:5173";
const PASSWORDS = { ayu: "sunrise-42", budi: "harbor-17" };
const results = [];
const record = (check, pass, detail) => {
  results.push({ check, pass, ...detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${check} ${JSON.stringify(detail)}`);
};
const normalize = (text) => text.replace(/\s+/g, " ").trim();

async function call(method, path, token, body) {
  const headers = { authorization: `Bearer ${token}` };
  if (body) headers["content-type"] = "application/json";
  const r = await fetch(SERVICE + path, { method, headers, body: body && JSON.stringify(body) });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
}
async function token(who) {
  const r = await fetch(`${SERVICE}/api/login`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: who, password: PASSWORDS[who] }),
  });
  return (await r.json()).token;
}

const budi = await token("budi");
const date = britishWinterDate(addDays(todayIn(LONDON), 90));
const made = [];
async function book(from, to, title) {
  const [start] = wallTimeInstants(date, from, LONDON);
  const [end] = wallTimeInstants(date, to, LONDON);
  const r = await call("POST", "/api/bookings", budi, { roomId: "kew", start, end, title });
  if (r.status !== 201) throw new Error(`book ${title}: ${r.status} ${JSON.stringify(r.body)}`);
  made.push(r.body);
  return r.body;
}
// Booked out of order, so the order on Home is the web app's or the service's, not ours.
const late = await book("15:00", "16:00", "Check late");
const early = await book("08:00", "09:00", "Check early");
const middle = await book("11:00", "12:00", "Check middle");
const item = (b) => normalize(`${homeLine(b.start, b.end, LONDON)} Kew · ${b.title}`);

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome" });
async function signedIn(who, options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(APP);
  await page.getByLabel("Username").fill(who);
  await page.getByLabel("Password").fill(PASSWORDS[who]);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText("My bookings").waitFor();
  return { context, page };
}
const bodyText = async (page) => normalize(await page.locator("body").innerText());
const myBookings = (text) => text.slice(text.indexOf("My bookings"), text.indexOf("Book a room"));

try {
  // integration.3, deferred: ayu signs in on the Login screen of npm run dev.
  {
    const { context, page } = await signedIn("ayu", { timezoneId: "Asia/Kolkata", viewport: { width: 1280, height: 800 } });
    const heading = await page.getByRole("heading", { name: "Hello, Ayu Lestari" }).isVisible();
    const zone = await page.getByText("Asia/Jakarta", { exact: true }).isVisible();
    await page.screenshot({ path: `${HERE}ayu-login-home-1280.png`, fullPage: true });
    record("ayu signs in on the Login screen of npm run dev and Home shows her profile", heading && zone, { heading, zone });
    await context.close();
  }

  // Phase Verification: budi's Home shows Europe/London and his bookings soonest first in London time.
  const texts = {};
  for (const timezoneId of ["Asia/Kolkata", "America/New_York", "Pacific/Auckland"]) {
    const { context, page } = await signedIn("budi", { timezoneId, viewport: { width: 1280, height: 800 } });
    await page.getByText(item(middle).split(" Kew")[0]).first().waitFor();
    const text = await bodyText(page);
    texts[timezoneId] = myBookings(text);
    if (timezoneId === "Asia/Kolkata") {
      const zone = await page.getByText("Europe/London", { exact: true }).isVisible();
      const at = [early, middle, late].map((b) => text.indexOf(item(b)));
      record("budi's Home shows Europe/London and his bookings soonest first in London time", zone && at.every((p) => p >= 0) && at[0] < at[1] && at[1] < at[2], { zone, positions: at, lines: [early, middle, late].map(item) });
      await page.screenshot({ path: `${HERE}budi-home-1280.png`, fullPage: true });
    }
    await context.close();
  }
  const same = new Set(Object.values(texts)).size === 1;
  record("the browser's time zone does not move a time on screen (Asia/Kolkata, America/New_York, Pacific/Auckland)", same, { myBookings: texts });

  // web.7, deferred: Home at 360 px against the real backend.
  {
    const { context, page } = await signedIn("budi", { timezoneId: "Asia/Kolkata", viewport: { width: 360, height: 800 } });
    await page.getByText(item(early).split(" Kew")[0]).first().waitFor();
    const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    const boxes = await Promise.all((await page.getByRole("button", { name: "Cancel" }).all()).map((b) => b.boundingBox()));
    const inside = boxes.every((b) => b && b.x >= 0 && b.x + b.width <= 360);
    await page.screenshot({ path: `${HERE}budi-home-360.png`, fullPage: true });
    record("360 px: no horizontal scroll and every Cancel inside the viewport", overflow.scrollWidth <= overflow.clientWidth && inside, { ...overflow, cancelBoxes: boxes });

    // Cancel's width while it reads Cancelling…, with the DELETE held back 2 s.
    await page.route("**/api/bookings/*", async (route) => {
      if (route.request().method() === "DELETE") await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });
    const row = page.locator("*").filter({ hasText: homeLine(early.start, early.end, LONDON) }).filter({ has: page.getByRole("button", { name: "Cancel" }) }).last();
    const button = row.getByRole("button");
    const line = page.getByText(normalize(homeLine(early.start, early.end, LONDON)), { exact: true });
    const before = { button: await button.boundingBox(), line: await line.boundingBox(), label: await button.innerText() };
    await button.click();
    await page.waitForTimeout(300);
    const during = { button: await button.boundingBox(), line: await line.boundingBox(), label: await button.innerText(), disabled: await button.isDisabled() };
    await page.screenshot({ path: `${HERE}budi-home-360-cancelling.png`, fullPage: true });
    const steady = before.button.width === during.button.width && before.line.y === during.line.y && before.button.y === during.button.y;
    record("Cancel keeps its width and its row stays put while it reads Cancelling…", steady && /^Cancelling/.test(during.label), { before, during });
    await page.getByText("Kew · Check early").waitFor({ state: "detached", timeout: 10_000 });
    record("Cancel removes the booking from Home at once (no reload)", true, { removed: "Check early" });
    await page.unroute("**/api/bookings/*");

    // A refused Cancel: the booking was cancelled elsewhere first, so the service answers 404.
    const gone = await call("DELETE", `/api/bookings/${middle.id}`, budi);
    const middleRow = page.locator("*").filter({ hasText: homeLine(middle.start, middle.end, LONDON) }).filter({ has: page.getByRole("button", { name: "Cancel" }) }).last();
    await middleRow.getByRole("button").click();
    const alert = page.getByRole("alert");
    await alert.first().waitFor({ timeout: 5000 }).catch(() => {});
    const alerts = await alert.allInnerTexts();
    const ariaLive = await page.evaluate(() => [...document.querySelectorAll("[role=alert],[aria-live]")].map((e) => ({ role: e.getAttribute("role"), live: e.getAttribute("aria-live"), text: e.textContent })));
    await page.waitForTimeout(500);
    const focus = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.slice(0, 60), tabIndex: document.activeElement?.getAttribute("tabindex") }));
    await page.screenshot({ path: `${HERE}budi-home-360-refused.png`, fullPage: true });
    record("a refused Cancel shows its notice in a role=alert element, and focus does not fall to the body", alerts.length > 0 && focus.tag !== "BODY", { serviceDelete: gone.status, alerts, ariaLive, focus });
    await context.close();
  }
} finally {
  await browser.close();
  for (const b of made) await call("DELETE", `/api/bookings/${b.id}`, budi);
  const left = (await call("GET", "/api/me/bookings", budi)).body.bookings.filter((b) => made.some((m) => m.id === b.id));
  record("cleanup: no booking this script made is left", left.length === 0, { left });
  writeFileSync(`${HERE}browser-check.out.json`, JSON.stringify({ ranAt: new Date().toISOString(), date, results }, null, 2) + "\n");
}
