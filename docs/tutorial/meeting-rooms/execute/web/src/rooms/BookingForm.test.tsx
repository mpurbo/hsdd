import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Room } from '../api/types'
import { loadFixture, stubFetch, stubFetchHanging, stubFetchUnreachable, type FetchStub } from '../test/fetchStub'
import { BookingForm } from './BookingForm'

const TOKEN = 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ'
const fixture = (name: string) => loadFixture('booking-api', name)
const ROOMS = (fixture('rooms-on-a-date').response.body as { rooms: Room[] }).rooms
const titleOf = (name: string) => (fixture(name).request.body as { title: string }).title
const bodyOf = (name: string) => fixture(name).request.body
/** A fixture's answer as `[status, body]`, for a deferred call. */
const answerOf = (name: string) => {
  const { status, body } = fixture(name).response
  return [status, body] as const
}

interface DeferredCall {
  readonly route: string
  readonly resolve: (response: Response) => void
}

interface DeferredStub {
  /** `METHOD path` of each call, in the order sent. */
  readonly routes: () => string[]
  /** Answers call `index`, then lets everything the answer sets off settle inside act. */
  readonly answer: (index: number, status: number, body: unknown) => Promise<void>
}

/** Every fetch waits until the test answers it, so a test decides when the answer arrives. */
function stubFetchDeferred(): DeferredStub {
  const calls: DeferredCall[] = []
  vi.stubGlobal(
    'fetch',
    (input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((resolve) => {
        calls.push({ route: `${(init?.method ?? 'GET').toUpperCase()} ${String(input)}`, resolve })
      }),
  )
  return {
    routes: () => calls.map((call) => call.route),
    answer: (index, status, body) => {
      const call = calls[index]
      if (call === undefined) throw new Error(`no call ${index}`)
      return act(async () => {
        call.resolve(new Response(JSON.stringify(body), { status }))
        await new Promise((r) => setTimeout(r, 0))
      })
    },
  }
}

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

  it('a later clock moves a chosen start that is no longer offered to the first offered', async () => {
    const { user, view, props } = renderForm(JAKARTA)
    await user.selectOptions(select('start'), '09:00')
    expect(shownOption('start')).toBe('09:00')
    view.rerender(<BookingForm {...props} now="2026-11-05T02:00:00.000Z" />)
    expect(shownOption('start')).toBe('09:15')
    expect(optionTexts('end')[0]).toBe('09:30')
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

/** Picks each choice by its option text and pastes the title. */
const choose = async (user: UserEvent, room: string, start: string, end: string, title: string) => {
  await user.selectOptions(select('room'), room)
  await user.selectOptions(select('start'), start)
  await user.selectOptions(select('end'), end)
  await user.click(titleField())
  await user.paste(title)
}

const alert = () => screen.queryByRole('alert')
const answered = async () => (await screen.findByRole('alert')).textContent
const sentBodies = (stub: FetchStub) => stub.calls.map((call) => call.body)
/** Room, start and end values, then the title. */
const chosen = () => [select('room').value, select('start').value, select('end').value, titleField().value]

/**
 * A browser moves focus to the body when the focused Book button turns
 * disabled. jsdom keeps it on the disabled button, and `blur()` on a disabled
 * control does nothing there, so a probe outside the form takes focus and is
 * removed: jsdom's removal fixup leaves focus on the body.
 */
const focusFallsToBody = () =>
  act(() => {
    const probe = document.body.appendChild(document.createElement('input'))
    probe.focus()
    probe.remove()
  })

const LONDON_REPEATED_HOUR = { zone: 'Europe/London', date: '2027-10-31', now: '2027-10-01T09:00:00.000Z' }
const OVERLAP_MESSAGE = 'Merapi is already booked from 09:00 to 10:00.'

describe('BookingForm Book (D10, D1, D3)', () => {
  it('book-a-room (Verification)', async () => {
    const stub = stubFetch(fixture('book-a-room'))
    const { user, props } = renderForm(JAKARTA)
    await choose(user, 'Merapi', '09:00', '10:00', 'Sprint planning')
    await user.click(book())
    expect(await answered()).toBe('Booked.')
    expect(stub.calls).toEqual([
      {
        method: 'POST',
        path: '/api/bookings',
        headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
        body: bodyOf('book-a-room'),
      },
    ])
    expect(titleField().value).toBe('')
    expect(props.onBooked).toHaveBeenCalledTimes(1)
    expect(chosen()).toEqual(['merapi', '2026-11-05T02:00:00.000Z', '2026-11-05T03:00:00.000Z', ''])
  })

  it('book-overlap (AC-5.3, G18)', async () => {
    const stub = stubFetch(fixture('book-overlap'))
    const { user, props } = renderForm(JAKARTA)
    await choose(user, 'Merapi', '09:30', '10:30', 'Retro')
    await user.click(book())
    expect(await answered()).toBe(OVERLAP_MESSAGE)
    expect(sentBodies(stub)).toEqual([bodyOf('book-overlap')])
    expect(screen.queryByText('The room is already booked for part of that time.')).toBeNull()
    expect(chosen()).toEqual(['merapi', '2026-11-05T02:30:00.000Z', '2026-11-05T03:30:00.000Z', 'Retro'])
    expect(props.onBooked).not.toHaveBeenCalled()
  })

  it('book-in-the-repeated-hour (AC-4.4, AC-5.2)', async () => {
    const stub = stubFetch(fixture('book-in-the-repeated-hour'))
    const { user } = renderForm(LONDON_REPEATED_HOUR)
    await choose(user, 'Thames', '01:30 BST', '01:30 GMT', 'Clock change drill')
    await user.click(book())
    expect(await answered()).toBe('Booked.')
    expect(sentBodies(stub)).toEqual([bodyOf('book-in-the-repeated-hour')])
  })

  it('book-title-80-characters', async () => {
    const stub = stubFetch(fixture('book-title-80-characters'))
    const { user } = renderForm(JAKARTA)
    await choose(user, 'Merapi', '09:00', '10:00', titleOf('book-title-80-characters'))
    await user.click(book())
    expect(await answered()).toBe('Booked.')
    expect(sentBodies(stub)).toEqual([bodyOf('book-title-80-characters')])
  })

  it('a title is sent untrimmed (Review Focus 1)', async () => {
    const stub = stubFetch(fixture('book-a-room'))
    const { user } = renderForm(JAKARTA)
    await choose(user, 'Merapi', '09:00', '10:00', '  Sprint planning ')
    await user.click(book())
    expect(await answered()).toBe('Booked.')
    expect(stub.calls.map((call) => (call.body as { title: unknown }).title)).toEqual(['  Sprint planning '])
  })

  it('book-started', async () => {
    stubFetch(fixture('book-started'))
    const { user } = renderForm({ ...JAKARTA, now: '2026-11-05T01:50:00.000Z' })
    expect(optionTexts('start')[0]).toBe('09:00')
    await choose(user, 'Merapi', '09:00', '10:00', 'Retro')
    await user.click(book())
    expect(await answered()).toBe('That time has already started.')
    expect(chosen()).toEqual(['merapi', '2026-11-05T02:00:00.000Z', '2026-11-05T03:00:00.000Z', 'Retro'])
  })

  it('book-too-far-ahead', async () => {
    const stub = stubFetch(fixture('book-too-far-ahead'))
    const { user } = renderForm({ zone: 'Europe/London', date: '2027-11-04', now: '2026-11-04T00:00:00.000Z' })
    await choose(user, 'Thames', '00:15', '01:15', 'Annual planning')
    await user.click(book())
    expect(await answered()).toBe('A booking can start at most 365 days ahead.')
    expect(sentBodies(stub)).toEqual([bodyOf('book-too-far-ahead')])
  })

  // The form cannot send either body; the backend can still answer them.
  it.each([
    ['book-too-long', 'A booking can last at most 8 hours.'],
    ['book-title-blank', 'That booking is not valid. Check the times and the title.'],
  ])('%s answered: %s', async (name, message) => {
    stubFetch(fixture(name))
    const { user } = renderForm(JAKARTA)
    await choose(user, 'Merapi', '09:00', '10:00', 'Workshop')
    await user.click(book())
    expect(await answered()).toBe(message)
  })

  it('book-unknown-token (D1): ends the session, no message', async () => {
    stubFetch(fixture('book-unknown-token'))
    const { user, props } = renderForm(JAKARTA)
    await choose(user, 'Merapi', '09:00', '10:00', 'Retro')
    await user.click(book())
    // Settled: Book is back, so the check for no message runs after the answer rendered.
    await waitFor(() => expect(book()).toBeEnabled())
    expect(props.onSessionExpired).toHaveBeenCalledTimes(1)
    expect(alert()).toBeNull()
    expect(props.onBooked).not.toHaveBeenCalled()
  })

  it('unreachable (D3): the message, the choices and the title kept', async () => {
    stubFetchUnreachable()
    const { user } = renderForm(JAKARTA)
    await choose(user, 'Merapi', '09:00', '10:00', 'Retro')
    await user.click(book())
    expect(await answered()).toBe('Could not reach the server. Please try again.')
    expect(chosen()).toEqual(['merapi', '2026-11-05T02:00:00.000Z', '2026-11-05T03:00:00.000Z', 'Retro'])
  })

  it('one request per press (Review Focus 2)', async () => {
    const stub = stubFetchHanging()
    const { user } = renderForm(JAKARTA)
    await choose(user, 'Merapi', '09:00', '10:00', 'Retro')
    const button = book()
    await user.click(button)
    await user.click(button)
    await user.type(titleField(), '{Enter}')
    // A submit that bypasses the disabled button reaches the handler's own check.
    fireEvent.submit(titleField())
    expect(stub.calls).toHaveLength(1)
    expect(button.textContent).toBe('Booking…')
    expect(button.disabled).toBe(true)
  })

  it('a submit while a rule fails sends nothing', () => {
    const stub = stubFetchHanging()
    renderForm(JAKARTA)
    fireEvent.submit(titleField())
    expect(stub.calls).toHaveLength(0)
    expect(book().disabled).toBe(true)
  })

  it('a press clears the previous message', async () => {
    stubFetch(fixture('book-overlap'))
    const { user } = renderForm(JAKARTA)
    await choose(user, 'Merapi', '09:30', '10:30', 'Retro')
    await user.click(book())
    expect(await answered()).toBe(OVERLAP_MESSAGE)
    const stub = stubFetchDeferred()
    await user.click(book())
    expect(stub.routes()).toEqual(['POST /api/bookings'])
    expect(alert()).toBeNull()
    await stub.answer(0, ...answerOf('book-overlap'))
    expect(alert()?.textContent).toBe(OVERLAP_MESSAGE)
  })

  it.each(['book-unknown-token', 'book-a-room'])(
    'drops an answer after unmount, a 401 included (Review Focus 3): %s',
    async (name) => {
      const stub = stubFetchDeferred()
      const { user, view, props } = renderForm(JAKARTA)
      await choose(user, 'Merapi', '09:00', '10:00', 'Retro')
      await user.click(book())
      view.unmount()
      await stub.answer(0, ...answerOf(name))
      expect(props.onSessionExpired).not.toHaveBeenCalled()
      expect(props.onBooked).not.toHaveBeenCalled()
    },
  )

  it('focus left on the body returns to the title (Review Focus 4)', async () => {
    const stub = stubFetchDeferred()
    const { user } = renderForm(JAKARTA)
    await choose(user, 'Merapi', '09:30', '10:30', 'Retro')
    await user.click(book())
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Booking…' }))
    focusFallsToBody()
    expect(document.activeElement).toBe(document.body)
    await stub.answer(0, ...answerOf('book-overlap'))
    expect(document.activeElement).toBe(titleField())
  })

  it('focus the user moved elsewhere stays there (Review Focus 4)', async () => {
    const stub = stubFetchDeferred()
    const { user } = renderForm(JAKARTA)
    await choose(user, 'Merapi', '09:30', '10:30', 'Retro')
    await user.click(book())
    act(() => select('room').focus())
    await stub.answer(0, ...answerOf('book-overlap'))
    expect(document.activeElement).toBe(select('room'))
  })

  it('a title typed while Book is in flight survives the 201', async () => {
    const stub = stubFetchDeferred()
    const { user } = renderForm(JAKARTA)
    await choose(user, 'Merapi', '09:00', '10:00', 'Sprint planning')
    await user.click(book())
    await user.type(titleField(), ' and retro')
    await stub.answer(0, ...answerOf('book-a-room'))
    expect(titleField().value).toBe('Sprint planning and retro')
    expect(alert()?.textContent).toBe('Booked.')
  })
})
