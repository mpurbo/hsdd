// simple-login.integration.5's browser checks against `npm run dev` (the
// developer database `meeting_rooms`), for the phase's Verification line and
// the items earlier phases deferred here. Run from the repository root while
// `npm run dev` is up:
//   node docs/superpowers/evidence/simple-login.integration.5/browser-check.mjs
// The browser runs in America/Los_Angeles: neither account's zone, nor the
// suite's Asia/Kolkata, nor this laptop's Asia/Jakarta. Every booking the
// check makes is cancelled through booking-api@v1 before it ends.
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { LONDON, JAKARTA, addDays, britishWinterDays, nextClockChangeDays, rangeLabel, todayIn, wallTimeInstants } from "../../../../e2e/time.ts";
import { deleteBooking, getRooms, postBooking, tokenFor } from "../../../../e2e/api.ts";

const OUT = new URL(".", import.meta.url).pathname;
const BROWSER_ZONE = "America/Los_Angeles";
const PASSWORDS = { ayu: "sunrise-42", budi: "harbor-17" };
const log = [];
const note = (line) => {
  log.push(line);
  console.log(line);
};

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome" });
const made = []; // { who, id }

async function rooms(who, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ baseURL: "http://localhost:5173", timezoneId: BROWSER_ZONE, viewport });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Username").fill(who);
  await page.getByLabel("Password").fill(PASSWORDS[who]);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Book a room" }).click();
  await page.getByLabel("Rooms on").waitFor();
  return { context, page };
}

const starts = (page) => page.getByRole("combobox", { name: "start", exact: true }).locator("option").allInnerTexts();
const mainText = async (page) => (await page.getByRole("main").innerText()).split("Book:")[0].replace(/\n\s*\n/g, "\n").trim();

async function emptyThames(token, date) {
  const { start, end } = { start: wallTimeInstants(date, "00:00", LONDON)[0], end: wallTimeInstants(addDays(date, 1), "00:00", LONDON)[0] };
  const reply = await getRooms(token, start, end);
  return reply.body.rooms.every((room) => room.bookings.length === 0);
}

try {
  note(`browser zone ${BROWSER_ZONE}; today in London ${todayIn(LONDON)}`);

  // 1. Clock-change days for budi (the phase's Verification; web.9's deferred item).
  const { march, october } = nextClockChangeDays();
  const budi = await rooms("budi");
  const zone = await budi.page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  note(`budi's browser reports zone ${zone}`);
  await budi.page.getByLabel("Rooms on").fill(march);
  await budi.page.waitForTimeout(800);
  const marchStarts = await starts(budi.page);
  note(`${march} (March): ${marchStarts.length} starts; any 01:xx: ${marchStarts.some((s) => s.startsWith("01:"))}; around the gap: ${marchStarts.slice(2, 6).join(", ")}`);
  await budi.page.getByLabel("Rooms on").fill(october);
  await budi.page.waitForTimeout(800);
  const octoberStarts = await starts(budi.page);
  note(`${october} (October): ${octoberStarts.length} starts; the repeated hour: ${octoberStarts.slice(4, 12).join(", ")}`);
  await budi.page.screenshot({ path: `${OUT}budi-rooms-october-1280.png`, fullPage: true });

  // 2. The wireframe's content on a date of the check's own (web.8's deferred item).
  const ayuToken = await tokenFor("ayu");
  const budiToken = await tokenFor("budi");
  let date = britishWinterDays(addDays(todayIn(LONDON), 90), 1)[0];
  while (!(await emptyThames(budiToken, date))) date = britishWinterDays(addDays(date, 1), 1)[0];
  note(`check date ${date} (no bookings in any room before the check)`);
  const book = async (who, token, roomId, zone, from, to, title) => {
    const reply = await postBooking(token, { roomId, start: wallTimeInstants(date, from, zone)[0], end: wallTimeInstants(date, to, zone)[0], title });
    if (reply.status !== 201) throw new Error(`${who} ${roomId}: ${reply.status} ${JSON.stringify(reply.body)}`);
    made.push({ token, id: reply.body.id });
    return reply.body;
  };
  await book("ayu", ayuToken, "merapi", JAKARTA, "09:00", "10:00", "Sprint planning");
  await book("budi", budiToken, "thames", LONDON, "10:00", "11:00", "Design review");
  await budi.page.getByLabel("Rooms on").fill(date);
  await budi.page.waitForTimeout(800);
  note(`budi's Rooms on ${date}:\n${await mainText(budi.page)}`);
  await budi.page.screenshot({ path: `${OUT}budi-rooms-wireframe-1280.png`, fullPage: true });
  const narrow = await rooms("budi", { width: 360, height: 800 });
  await narrow.page.getByLabel("Rooms on").fill(date);
  await narrow.page.waitForTimeout(800);
  await narrow.page.screenshot({ path: `${OUT}budi-rooms-360.png`, fullPage: true });
  await narrow.context.close();

  // 3. Two browsers booking the same Thames hour at once (the phase's Verification).
  const raceDate = britishWinterDays(addDays(date, 1), 1)[0];
  if (!(await emptyThames(budiToken, raceDate))) throw new Error(`${raceDate} already has bookings`);
  const ayu = await rooms("ayu");
  const pages = [
    { who: "budi", page: budi.page, from: "12:00", to: "13:00", zone: LONDON },
    { who: "ayu", page: ayu.page, from: "19:00", to: "20:00", zone: JAKARTA },
  ];
  for (const p of pages) {
    await p.page.getByLabel("Rooms on").fill(raceDate);
    await p.page.waitForTimeout(800);
    await p.page.getByRole("combobox", { name: "room", exact: true }).selectOption({ label: "Thames" });
    await p.page.getByRole("combobox", { name: "start", exact: true }).selectOption({ label: p.from });
    await p.page.getByRole("combobox", { name: "end", exact: true }).selectOption({ label: p.to });
    await p.page.getByRole("textbox", { name: "title" }).fill(`Race ${p.who}`);
  }
  await Promise.all(pages.map((p) => p.page.getByRole("button", { name: "Book" }).click()));
  for (const p of pages) {
    const refused = `Thames is already booked from ${rangeLabel(wallTimeInstants(raceDate, "12:00", LONDON)[0], wallTimeInstants(raceDate, "13:00", LONDON)[0], p.zone, raceDate)}.`;
    const message = p.page.getByText("Booked.", { exact: true }).or(p.page.getByText(refused, { exact: true }));
    await message.waitFor();
    p.message = await message.innerText();
    note(`${p.who} sees: ${p.message}`);
  }
  await ayu.page.screenshot({ path: `${OUT}ayu-rooms-race-1280.png`, fullPage: true });
  await budi.page.screenshot({ path: `${OUT}budi-rooms-race-1280.png`, fullPage: true });
  const after = await getRooms(budiToken, wallTimeInstants(raceDate, "00:00", LONDON)[0], wallTimeInstants(addDays(raceDate, 1), "00:00", LONDON)[0]);
  const thames = after.body.rooms.find((room) => room.id === "thames").bookings;
  note(`Thames on ${raceDate} holds ${thames.length} booking(s): ${thames.map((b) => b.title).join(", ")}`);
  for (const b of thames) made.push({ token: b.title === "Race ayu" ? ayuToken : budiToken, id: b.id });
  await ayu.context.close();
  await budi.context.close();
} finally {
  for (const { token, id } of made) {
    const reply = await deleteBooking(token, id);
    note(`cancelled ${id}: ${reply.status}`);
  }
  await browser.close();
  writeFileSync(`${OUT}browser-check.out.txt`, log.join("\n") + "\n");
}
