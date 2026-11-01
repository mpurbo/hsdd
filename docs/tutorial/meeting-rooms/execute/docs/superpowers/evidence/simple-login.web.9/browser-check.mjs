// Browser check for simple-login.web.9: signs in as ayu (Asia/Jakarta), opens
// Rooms on 2026-11-05, books Merapi 09:00 to 10:00, then tries an overlap on
// Merapi 09:30 to 10:30. Screenshots at 360 px and 1280 px. Prints the lines
// it read so the verification doc can quote them.
import { chromium } from '<repo>/node_modules/playwright/index.mjs'

const out = process.argv[2]
const base = 'http://127.0.0.1:5179'
const browser = await chromium.launch({ channel: 'chrome' })

async function run(width, label, title, date) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Kolkata' })
  const page = await context.newPage()
  await page.goto(base)
  await page.getByLabel('Username').fill('ayu')
  await page.getByLabel('Password').fill('sunrise-42')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Book a room' }).click()
  await page.getByLabel('Rooms on').fill(date)
  await page.getByRole('button', { name: 'Book', exact: true }).waitFor()
  await page.getByRole('combobox', { name: 'room', exact: true }).selectOption({ label: 'Merapi' })
  await page.getByRole('combobox', { name: 'start', exact: true }).selectOption({ label: '09:00' })
  await page.getByRole('combobox', { name: 'end', exact: true }).selectOption({ label: '10:00' })
  await page.getByRole('textbox', { name: 'title', exact: true }).fill(title)
  await page.screenshot({ path: `${out}/${label}-1-filled.png`, fullPage: true })
  await page.getByRole('button', { name: 'Book', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: /./ }).waitFor()
  const booked = await page.getByRole('alert').textContent()
  await page.getByText(`09:00 to 10:00  ${title}`).waitFor()
  await page.screenshot({ path: `${out}/${label}-2-booked.png`, fullPage: true })
  await page.getByRole('combobox', { name: 'start', exact: true }).selectOption({ label: '09:30' })
  await page.getByRole('combobox', { name: 'end', exact: true }).selectOption({ label: '10:30' })
  await page.getByRole('textbox', { name: 'title', exact: true }).fill('Retro')
  await page.getByRole('button', { name: 'Book', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'already booked' }).waitFor()
  const conflict = await page.getByRole('alert').textContent()
  await page.screenshot({ path: `${out}/${label}-3-conflict.png`, fullPage: true })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  const merapi = await page.locator('.rooms-list li').first().innerText()
  console.log(JSON.stringify({ width, date, booked, conflict, horizontalScroll: overflow, merapi }))
  await context.close()
}

try {
  if (process.argv[3] !== 'desktop-only') await run(360, '360px', 'Sprint planning', '2026-11-05')
  await run(1280, '1280px', 'Design review', '2026-11-06')
} finally {
  await browser.close()
}
