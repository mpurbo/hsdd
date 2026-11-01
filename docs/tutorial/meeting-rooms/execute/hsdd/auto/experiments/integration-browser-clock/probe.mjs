// Probe: in the installed Chrome driven by Playwright 1.64.1 (the root's @playwright/test range),
// 1. does a context's timezoneId set the page's ambient zone (ADR-002: the browser tests run in a
//    zone that is neither account's nor UTC)?
// 2. does page.clock.setFixedTime put the page's clock behind the real one while timers still run,
//    so a form that leaves out passed starts offers the current quarter hour (PRD v2 AC-5.5)?
// 3. does it leave the test process's clock alone (the backend's clock is the real one)?
// Run from the repository root:
//   npm --prefix hsdd/auto/experiments/integration-browser-clock install
//   node hsdd/auto/experiments/integration-browser-clock/probe.mjs
// Not part of any build or workspace.
import { createServer } from "node:http";
import { chromium } from "@playwright/test";

const say = (...xs) => console.log(...xs);
const MIN = 60e3;
const PAGE = `<!doctype html><title>probe</title><script>
  window.firstNow = Date.now();
  window.ticks = 0; setInterval(() => window.ticks++, 50);
</script>`;
const server = createServer((_, res) => res.writeHead(200, { "content-type": "text/html" }).end(PAGE));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome" });
say(`node ${process.version}; browser ${browser.version()}; channel ${process.env.PW_CHANNEL ?? "chrome"}`);
try {
  const context = await browser.newContext({ timezoneId: "Asia/Kolkata" });
  const page = await context.newPage();

  // 1. the ambient zone
  await page.goto(url);
  const zone = await page.evaluate(() => ({
    resolved: Intl.DateTimeFormat().resolvedOptions().timeZone,
    offset: new Date("2026-11-05T02:00:00.000Z").getTimezoneOffset(),
    hours: new Date("2026-11-05T02:00:00.000Z").getHours(),
  }));
  say(`\n1. timezoneId Asia/Kolkata: resolved ${zone.resolved}, getTimezoneOffset ${zone.offset}, 02:00Z getHours ${zone.hours}`);

  // 2. a fixed clock 20 minutes behind, set before the page loads
  const real = Date.now();
  const behind = new Date(Math.floor(real / (15 * MIN)) * 15 * MIN - 5 * MIN); // 5 minutes before the current quarter hour
  await page.clock.setFixedTime(behind);
  await page.goto(url);
  const a = await page.evaluate(() => ({ now: Date.now(), first: window.firstNow, date: new Date().toISOString(), ticks: window.ticks }));
  await page.waitForTimeout(1000);
  const b = await page.evaluate(() => ({ now: Date.now(), ticks: window.ticks }));
  say(`\n2. setFixedTime(${behind.toISOString()}) before load; real clock ${new Date(real).toISOString()}`);
  say(`   page Date.now() at load ${new Date(a.first).toISOString()}, new Date() ${a.date}`);
  say(`   one second later: page Date.now() moved ${b.now - a.now} ms; setInterval ticks ${a.ticks} -> ${b.ticks} (timers run)`);
  say(`   page clock behind the real one by ${((Date.now() - b.now) / MIN).toFixed(2)} min`);
  const q0 = Math.floor(Date.now() / (15 * MIN)) * 15 * MIN;
  say(`   the current quarter hour ${new Date(q0).toISOString()} is after the page's clock: ${q0 > b.now}; it has started on the real clock: ${q0 <= Date.now()}`);

  // 3. the test process's clock
  say(`\n3. the test process's Date.now() is the real clock: ${Math.abs(Date.now() - new Date().getTime()) < 5} (drift from real at start ${((Date.now() - real) / 1000).toFixed(1)} s, the probe's own run time)`);
  await context.close();
} finally {
  await browser.close();
  server.close();
}
