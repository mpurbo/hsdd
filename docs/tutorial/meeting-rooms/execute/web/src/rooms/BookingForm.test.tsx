import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Room } from '../api/types'
import { loadFixture } from '../test/fetchStub'
import { BookingForm } from './BookingForm'

const TOKEN = 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ'
const fixture = (name: string) => loadFixture('booking-api', name)
const ROOMS = (fixture('rooms-on-a-date').response.body as { rooms: Room[] }).rooms
const titleOf = (name: string) => (fixture(name).request.body as { title: string }).title

interface Setup {
  readonly zone: string
  readonly date: string
  readonly now: string
  readonly rooms?: readonly Room[]
}

const renderForm = ({ zone, date, now, rooms = ROOMS }: Setup) => {
  const user = userEvent.setup()
  const props = { token: TOKEN, zone, date, rooms, now, onBooked: vi.fn(), onSessionExpired: vi.fn() }
  const view = render(<BookingForm {...props} />)
  return { user, view, props }
}

const select = (label: string) => screen.getByLabelText<HTMLSelectElement>(label)
const optionTexts = (label: string) => Array.from(select(label).options, (o) => o.text)
const shownOption = (label: string) => select(label).selectedOptions[0]?.text
const book = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Book' })
const titleField = () => screen.getByLabelText<HTMLInputElement>('title')

const JAKARTA = { zone: 'Asia/Jakarta', date: '2026-11-05', now: '2026-11-04T12:00:00.000Z' }

describe('BookingForm choices', () => {
  it('opens on the first room, the first start and the first end after it', () => {
    renderForm(JAKARTA)
    expect(optionTexts('room')).toEqual(['Merapi', 'Bromo', 'Thames', 'Kew'])
    expect(select('room').value).toBe('merapi')
    const starts = optionTexts('start')
    expect(starts).toHaveLength(96)
    expect(starts.slice(0, 2)).toEqual(['00:00', '00:15'])
    expect(select('start').value).toBe('2026-11-04T17:00:00.000Z')
    expect(shownOption('end')).toBe('00:15')
  })

  it('the end list follows the chosen start (D11)', async () => {
    const { user } = renderForm(JAKARTA)
    await user.selectOptions(select('start'), '09:00')
    const ends = optionTexts('end')
    expect(ends).toHaveLength(32)
    expect(ends[0]).toBe('09:15')
    expect(ends[ends.length - 1]).toBe('17:00')
    await user.selectOptions(select('end'), '10:00')
    await user.selectOptions(select('start'), '09:30')
    expect(shownOption('end')).toBe('10:00')
    await user.selectOptions(select('start'), '10:00')
    expect(shownOption('end')).toBe('10:15')
  })

  it('ends stop at the start of the next date', async () => {
    const { user } = renderForm(JAKARTA)
    await user.selectOptions(select('start'), '23:45')
    expect(optionTexts('end')).toEqual(['Fri 6 Nov 00:00'])
  })

  it('starts later than the clock (D11)', () => {
    renderForm({ ...JAKARTA, now: '2026-11-05T02:00:00.000Z' })
    expect(optionTexts('start')[0]).toBe('09:15')
  })

  it('no start left', async () => {
    const { user } = renderForm({ ...JAKARTA, date: '2026-11-04', now: '2026-11-05T02:00:00.000Z' })
    expect(screen.getByText('No times left on this date.')).toBeTruthy()
    expect(screen.queryByLabelText('start')).toBeNull()
    expect(screen.queryByLabelText('end')).toBeNull()
    await user.type(titleField(), 'Retro')
    expect(book().disabled).toBe(true)
  })

  it('the repeated hour offers two 01:30s; the skipped hour none', () => {
    const london = { zone: 'Europe/London', date: '2027-10-31', now: '2027-10-01T09:00:00.000Z' }
    const { view, props } = renderForm(london)
    const starts = optionTexts('start')
    expect(starts).toContain('01:30 BST')
    expect(starts).toContain('01:30 GMT')
    view.rerender(<BookingForm {...props} date="2027-03-28" now="2027-03-01T09:00:00.000Z" />)
    expect(optionTexts('start').filter((t) => t.startsWith('01:'))).toEqual([])
  })

  it('Book is disabled until the title has a character that is not whitespace, and at most 80 code points (AC-5.6)', async () => {
    const { user } = renderForm(JAKARTA)
    expect(book().disabled).toBe(true)
    await user.type(titleField(), '   ')
    expect(book().disabled).toBe(true)
    await user.clear(titleField())
    const tooLong = titleOf('book-title-too-long')
    await user.click(titleField())
    await user.paste(tooLong)
    expect(titleField().value).toBe(tooLong)
    expect(book().disabled).toBe(true)
    await user.clear(titleField())
    const ok = titleOf('book-title-80-characters')
    await user.paste(ok)
    expect(titleField().value).toBe(ok)
    expect(book().disabled).toBe(false)
  })
})
