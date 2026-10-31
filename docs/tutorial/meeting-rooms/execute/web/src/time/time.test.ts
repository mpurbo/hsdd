import { describe, expect, it } from 'vitest'
import { asTimeZone, sameZone, todayIn } from './time'

const LONDON = 'Europe/London'
const JAKARTA = 'Asia/Jakarta'

describe('todayIn', () => {
  it('gives 2026-11-04 for 2026-11-04T16:59:59.999Z in Asia/Jakarta', () => {
    expect(todayIn('2026-11-04T16:59:59.999Z', JAKARTA)).toBe('2026-11-04')
  })
  it('gives 2026-11-05 for 2026-11-04T17:00:00.000Z in Asia/Jakarta', () => {
    expect(todayIn('2026-11-04T17:00:00.000Z', JAKARTA)).toBe('2026-11-05')
  })
  it('gives London its own date for the same instant', () => {
    expect(todayIn('2026-11-04T17:00:00.000Z', LONDON)).toBe('2026-11-04')
  })
})

describe('asTimeZone', () => {
  it('gives the name when Intl accepts it', () => {
    expect(asTimeZone(JAKARTA)).toBe(JAKARTA)
    expect(asTimeZone(LONDON)).toBe(LONDON)
  })
  it('gives none for Mars/Olympus', () => {
    expect(asTimeZone('Mars/Olympus')).toBeUndefined()
  })
  it('gives none for an empty name', () => {
    expect(asTimeZone('')).toBeUndefined()
  })
  it('gives an offset Intl accepts unchanged (D7: a guard against a crash, not an IANA check)', () => {
    expect(asTimeZone('+07:00')).toBe('+07:00')
  })
})

describe('sameZone', () => {
  it('compares names as strings', () => {
    expect(sameZone(JAKARTA, JAKARTA)).toBe(true)
    expect(sameZone(JAKARTA, LONDON)).toBe(false)
    expect(sameZone(JAKARTA, 'asia/jakarta')).toBe(false)
  })
})
