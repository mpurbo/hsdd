import { describe, expect, it } from 'vitest'
import { formatMemberSince } from './memberSince'

describe('formatMemberSince', () => {
  it.each([
    ['2024-03-14', '14 March 2024'],
    ['2025-01-09', '9 January 2025'],
    ['2024-12-31', '31 December 2024'],
  ])('formats %s as %s', (date, expected) => {
    expect(formatMemberSince(date)).toBe(expected)
  })

  it('keeps the calendar date in every time zone', () => {
    const saved = process.env.TZ
    try {
      for (const tz of ['America/Los_Angeles', 'Asia/Jakarta', 'Pacific/Kiritimati']) {
        process.env.TZ = tz
        expect(formatMemberSince('2024-03-14')).toBe('14 March 2024')
      }
    } finally {
      process.env.TZ = saved
    }
  })

  it.each(['2024-3-14', '', '2024-13-01', '14 March 2024'])(
    'returns %j unchanged when it is not a YYYY-MM-DD date',
    (raw) => {
      expect(formatMemberSince(raw)).toBe(raw)
    },
  )
})
