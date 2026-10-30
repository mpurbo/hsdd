// profile-api@v1 `memberSince` is a calendar date, `YYYY-MM-DD`. The PRD shows
// it as "14 March 2024". No `Date` is built: `new Date('2024-03-14')` is UTC
// midnight, which is still 13 March west of UTC, and a fixed table avoids any
// locale or ICU dependency.
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** `2024-03-14` -> `14 March 2024`; anything else is returned unchanged. */
export function formatMemberSince(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (match === null) return date
  const [, year, month, day] = match
  const monthName = MONTHS[Number(month) - 1]
  const dayNumber = Number(day)
  return monthName !== undefined && dayNumber >= 1 && dayNumber <= 31 ? `${dayNumber} ${monthName} ${year}` : date
}
