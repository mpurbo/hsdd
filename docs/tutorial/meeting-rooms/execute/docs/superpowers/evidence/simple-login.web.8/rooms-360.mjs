// simple-login.web.8, phase Verification: "At 360 px wide each room and
// booking line stays on its own line." jsdom applies no stylesheet, so this
// check runs the production build in the installed Chrome at 360 px wide.
// `/api/*` is answered from the contract fixtures (no backend), the browser's
// clock is fixed per scenario, and the session is put in sessionStorage.
//
// Run from the repository root, after `npm install` (root) and
// `npm --prefix web run build`:
//   node docs/superpowers/evidence/simple-login.web.8/rooms-360.mjs
// It writes rooms-360.json and the screenshots beside itself and exits 1
// when a check fails: a sideways scroll, a line past the right edge, a line
// sharing a row with the one before it, a line not rendered as received
// (its spaces), or the date input moving when the date changes.
import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../../..')
const dist = join(root, 'web/dist')
const fixture = (api, name) => JSON.parse(readFileSync(join(root, 'hsdd/contract/fixture', api, `${name}.json`), 'utf8'))
const TOKEN = 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ'

const scenarios = [
  {
    name: 'budi-rooms-on-a-date',
    clock: '2026-11-05T09:30:00.000Z',
    fixtures: [
      fixture('profile-api.v2', 'me-budi'),
      fixture('booking-api', 'my-bookings-none'),
      fixture('booking-api', 'rooms-on-a-date'),
      fixture('booking-api', 'rooms-on-a-clock-change-day'),
    ],
    // A second date, to check the header stays put while the list changes.
    nextDate: { value: '2027-10-31', shows: 'Last slot' },
  },
  {
    name: 'ayu-rooms-range-edges',
    clock: '2026-11-04T18:00:00.000Z',
    fixtures: [fixture('profile-api.v2', 'me-ayu'), fixture('booking-api', 'my-bookings-none'), fixture('booking-api', 'rooms-range-edges')],
  },
]

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
const server = createServer((req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url.split('?')[0]
  try {
    const body = readFileSync(join(dist, path))
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const base = `http://127.0.0.1:${server.address().port}`

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })
const results = []
for (const scenario of scenarios) {
  const page = await browser.newPage({ viewport: { width: 360, height: 900 } })
  await page.clock.setFixedTime(new Date(scenario.clock))
  await page.addInitScript((token) => {
    sessionStorage.setItem('simple-login.session', JSON.stringify({ token, expiresAt: '2026-10-29T10:30:00.000Z' }))
  }, TOKEN)
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname + url.search
    const hit = scenario.fixtures.find((f) => f.request.method === route.request().method() && f.request.path === path)
    if (hit === undefined) return route.fulfill({ status: 599, body: `no fixture for ${path}` })
    return route.fulfill({ status: hit.response.status, contentType: 'application/json', body: JSON.stringify(hit.response.body) })
  })
  await page.goto(base)
  await page.getByRole('button', { name: 'Book a room' }).waitFor()
  await page.screenshot({ path: join(here, `${scenario.name}-home.png`), fullPage: true })
  await page.getByRole('button', { name: 'Book a room' }).click()
  await page.locator('.rooms-list').waitFor()
  const measured = await page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll('.rooms-list p'), (p) => {
      const r = p.getBoundingClientRect()
      const lineHeight = parseFloat(getComputedStyle(p).lineHeight)
      return {
        text: p.textContent,
        rendered: p.innerText,
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        rows: Math.round(r.height / lineHeight),
      }
    })
    return { viewport: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, lines }
  })
  await page.screenshot({ path: join(here, `${scenario.name}-rooms.png`), fullPage: true })
  const dateTop = () => page.getByLabel('Rooms on').evaluate((input) => input.getBoundingClientRect().top)
  const headerTops = [await dateTop()]
  if (scenario.nextDate !== undefined) {
    await page.getByLabel('Rooms on').fill(scenario.nextDate.value)
    await page.getByText(scenario.nextDate.shows, { exact: false }).waitFor()
    headerTops.push(await dateTop())
    await page.screenshot({ path: join(here, `${scenario.name}-next-date.png`), fullPage: true })
  }
  const failures = []
  if (new Set(headerTops).size > 1) failures.push(`the date input moved: ${headerTops.join(' -> ')}`)
  if (measured.scrollWidth > measured.viewport) failures.push(`page scrolls sideways: ${measured.scrollWidth} > ${measured.viewport}`)
  measured.lines.forEach((line, i) => {
    if (line.right > measured.viewport) failures.push(`line ${i} overflows: ${line.text}`)
    if (line.rendered !== line.text) failures.push(`line ${i} not rendered as received: ${JSON.stringify(line.rendered)}`)
    const previous = measured.lines[i - 1]
    if (previous !== undefined && line.top < previous.bottom - 0.5) failures.push(`line ${i} shares a row with line ${i - 1}: ${line.text}`)
  })
  results.push({ scenario: scenario.name, clock: scenario.clock, headerTops, ...measured, failures })
  await page.close()
}
await browser.close()
server.close()

writeFileSync(join(here, 'rooms-360.json'), `${JSON.stringify(results, null, 2)}\n`)
for (const r of results) {
  console.log(`${r.scenario}: ${r.lines.length} lines, scrollWidth ${r.scrollWidth} of ${r.viewport}, wrapped ${r.lines.filter((l) => l.rows > 1).length}, date input top ${r.headerTops.join(' -> ')}, failures ${r.failures.length}`)
  for (const f of r.failures) console.log(`  FAIL ${f}`)
}
process.exit(results.some((r) => r.failures.length > 0) ? 1 : 0)
