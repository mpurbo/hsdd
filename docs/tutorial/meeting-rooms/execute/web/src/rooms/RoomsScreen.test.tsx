import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { atPath, loadFixture, stubFetch, stubFetchHanging, stubFetchUnreachable } from '../test/fetchStub'
import { RoomsScreen } from './RoomsScreen'

const TOKEN = 'q8Vn3xR2bT0kLw7YcZ1pHs5mJd9fAe4uGi6oNr2vXyQ'
const fixture = (name: string) => loadFixture('booking-api', name)
const bodyOf = (name: string) => fixture(name).response.body

const LONDON_NOW = '2026-11-05T09:30:00.000Z'
const ON_A_DATE_PATH = '/api/rooms?from=2026-11-05T00:00:00.000Z&to=2026-11-06T00:00:00.000Z'
const CLOCK_CHANGE_PATH = '/api/rooms?from=2027-10-30T23:00:00.000Z&to=2027-11-01T00:00:00.000Z'

// The lines roomViews pins for each fixture (roomViews.test.ts), here read off the screen.
const ON_A_DATE = [
  'Merapi · Jakarta · 8 seats',
  '02:00 to 03:00  Sprint planning',
  '(09:00 to 10:00 in Jakarta)',
  'Bromo · Jakarta · 4 seats',
  '(no bookings)',
  'Thames · London · 10 seats',
  '10:00 to 11:00  Design review',
  'Kew · London · 4 seats',
  '(no bookings)',
]
const RANGE_EDGES = [
  'Merapi · Jakarta · 8 seats',
  '06:00 to 07:00  Planning',
  '08:00 to 08:30  Standup',
  'Bromo · Jakarta · 4 seats',
  '23:45 to Fri 6 Nov 00:15  Wrap-up',
  'Thames · London · 10 seats',
  '(no bookings)',
  'Kew · London · 4 seats',
  'Wed 4 Nov 23:30 to 00:30  Handover',
  '(Wed 4 Nov 16:30 to Wed 4 Nov 17:30 in London)',
]
const CLOCK_CHANGE = [
  'Merapi · Jakarta · 8 seats',
  '(no bookings)',
  'Bromo · Jakarta · 4 seats',
  '(no bookings)',
  'Thames · London · 10 seats',
  '00:00 to 01:30 BST  Midnight launch',
  '01:00 GMT to 01:30 GMT  After the change',
  '23:30 to Mon 1 Nov 00:00  Last slot',
  'Kew · London · 4 seats',
  '(no bookings)',
]

const shown = () => Array.from(document.querySelectorAll('.rooms-list p'), (p) => p.textContent)
const list = () => document.querySelector('.rooms-list')
const dateInput = () => screen.getByLabelText<HTMLInputElement>('Rooms on')

/** The browser's clock reads `now`; only `Date` is faked, so timers stay real. */
const clockAt = (now: string) => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(now))
}

const renderRooms = (zone = 'Europe/London') => {
  const onHome = vi.fn()
  const onSessionExpired = vi.fn()
  const view = render(<RoomsScreen token={TOKEN} zone={zone} onHome={onHome} onSessionExpired={onSessionExpired} />)
  return { ...view, onHome, onSessionExpired }
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

/** Every fetch waits until the test answers it, so a test decides the order the answers arrive in. */
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

describe('RoomsScreen (AC-4.1 to AC-4.4, D1, D3, D8)', () => {
  it('opens on today in the user zone and shows rooms-on-a-date (AC-4.1, AC-4.2, AC-4.3)', async () => {
    clockAt(LONDON_NOW)
    const stub = stubFetch(fixture('rooms-on-a-date'))
    renderRooms('Europe/London')
    expect(screen.getByRole('heading', { level: 1, name: 'Rooms on' })).toBeInTheDocument()
    expect(dateInput().value).toBe('2026-11-05')
    await waitFor(() => expect(shown()).toEqual(ON_A_DATE))
    expect(stub.calls).toHaveLength(1)
    expect(stub.calls[0]).toMatchObject({
      method: 'GET',
      path: ON_A_DATE_PATH,
      headers: { authorization: `Bearer ${TOKEN}` },
    })
  })

  it('opens on the Jakarta date and shows rooms-range-edges', async () => {
    clockAt('2026-11-04T18:00:00.000Z')
    stubFetch(fixture('rooms-range-edges'))
    renderRooms('Asia/Jakarta')
    expect(dateInput().value).toBe('2026-11-05')
    await waitFor(() => expect(shown()).toEqual(RANGE_EDGES))
  })

  it('picking 2027-10-31 fetches the clock-change day (AC-4.4)', async () => {
    clockAt(LONDON_NOW)
    const stub = stubFetch(fixture('rooms-on-a-date'), fixture('rooms-on-a-clock-change-day'))
    renderRooms('Europe/London')
    await waitFor(() => expect(shown()).toEqual(ON_A_DATE))
    fireEvent.change(dateInput(), { target: { value: '2027-10-31' } })
    await waitFor(() => expect(shown()).toEqual(CLOCK_CHANGE))
    expect(stub.calls).toHaveLength(2)
    expect(stub.calls[1]?.path).toBe(CLOCK_CHANGE_PATH)
  })

  it('reads Loading… while the request is in flight', () => {
    clockAt(LONDON_NOW)
    stubFetchHanging()
    renderRooms()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(list()).toBeNull()
  })

  it("reads Loading… while a changed date is in flight, never the previous date's rooms (Scope)", async () => {
    clockAt(LONDON_NOW)
    const stub = stubFetchDeferred()
    renderRooms('Europe/London')
    await stub.answer(0, 200, bodyOf('rooms-on-a-date'))
    expect(shown()).toEqual(ON_A_DATE)
    fireEvent.change(dateInput(), { target: { value: '2027-10-31' } })
    expect(stub.routes()).toEqual([`GET ${ON_A_DATE_PATH}`, `GET ${CLOCK_CHANGE_PATH}`])
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(list()).toBeNull()
    // Exact lines catch the room headings; the titles catch a booking line relabelled against the new date.
    for (const line of ON_A_DATE) expect(screen.queryAllByText(line)).toHaveLength(0)
    expect(screen.queryAllByText(/Sprint planning|Design review/)).toHaveLength(0)
    await stub.answer(1, 200, bodyOf('rooms-on-a-clock-change-day'))
    expect(shown()).toEqual(CLOCK_CHANGE)
  })

  it('rooms-no-token: a 401 calls onSessionExpired (D1)', async () => {
    clockAt(LONDON_NOW)
    stubFetch(fixture('rooms-no-token'))
    const { onSessionExpired } = renderRooms()
    await vi.waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1))
  })

  it('unavailable: D3 message in place of the list, the date kept', async () => {
    clockAt(LONDON_NOW)
    stubFetchUnreachable()
    renderRooms()
    expect((await screen.findByRole('status')).textContent).toBe('Could not reach the server. Please try again.')
    expect(list()).toBeNull()
    expect(dateInput().value).toBe('2026-11-05')
  })

  it('Home calls onHome', () => {
    clockAt(LONDON_NOW)
    stubFetchHanging()
    const { onHome } = renderRooms()
    fireEvent.click(screen.getByRole('button', { name: 'Home' }))
    expect(onHome).toHaveBeenCalledTimes(1)
  })

  it('a cleared or half-typed date sends nothing and shows no list (Review Focus 1)', async () => {
    clockAt(LONDON_NOW)
    const stub = stubFetch(fixture('rooms-on-a-date'))
    renderRooms()
    await waitFor(() => expect(shown()).toEqual(ON_A_DATE))
    for (const typed of ['', '0002-10-31']) {
      fireEvent.change(dateInput(), { target: { value: typed } })
      expect(dateInput().value).toBe(typed)
      expect(stub.calls).toHaveLength(1)
      expect(list()).toBeNull()
      expect(screen.queryByText('Loading…')).toBeNull()
      expect(screen.queryByRole('status')).toBeNull()
    }
    fireEvent.change(dateInput(), { target: { value: '2026-11-05' } })
    await waitFor(() => expect(shown()).toEqual(ON_A_DATE))
    expect(stub.calls).toHaveLength(2)
    expect(stub.calls[1]?.path).toBe(ON_A_DATE_PATH)
  })

  it('shows the newest date when answers arrive out of order (Review Focus 2)', async () => {
    clockAt(LONDON_NOW)
    const stub = stubFetchDeferred()
    renderRooms()
    fireEvent.change(dateInput(), { target: { value: '2027-10-31' } })
    expect(stub.routes()).toEqual([`GET ${ON_A_DATE_PATH}`, `GET ${CLOCK_CHANGE_PATH}`])
    await stub.answer(1, 200, bodyOf('rooms-on-a-clock-change-day'))
    await stub.answer(0, 200, bodyOf('rooms-on-a-date'))
    expect(shown()).toEqual(CLOCK_CHANGE)
  })

  it('drops an answer that arrives after unmount, a 401 included', async () => {
    clockAt(LONDON_NOW)
    const stub = stubFetchDeferred()
    const { unmount, onSessionExpired } = renderRooms()
    unmount()
    await stub.answer(0, 401, bodyOf('rooms-no-token'))
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('renders the form below the list once the rooms have loaded', async () => {
    clockAt(LONDON_NOW)
    stubFetch(fixture('rooms-on-a-date'))
    renderRooms('Europe/London')
    await waitFor(() => expect(shown()).toEqual(ON_A_DATE))
    const book = screen.getByRole('button', { name: 'Book' })
    expect(list()?.compareDocumentPosition(book)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('has no form while loading or after the D3 message', async () => {
    clockAt(LONDON_NOW)
    stubFetchHanging()
    const first = renderRooms()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Book' })).toBeNull()
    first.unmount()
    stubFetchUnreachable()
    renderRooms()
    await screen.findByRole('status')
    expect(screen.queryByRole('button', { name: 'Book' })).toBeNull()
  })

  it("the form's starts come from the clock read when the rooms arrived", async () => {
    clockAt('2026-11-04T18:00:00.000Z')
    stubFetch(fixture('rooms-range-edges'))
    renderRooms('Asia/Jakarta')
    await waitFor(() => expect(shown()).toEqual(RANGE_EDGES))
    expect(screen.getByLabelText<HTMLSelectElement>('start').options[0]?.text).toBe('01:15')
  })

  describe('after a booking', () => {
    const RANGE_EDGES_PATH = '/api/rooms?from=2026-11-04T17:00:00.000Z&to=2026-11-05T17:00:00.000Z'
    const edges = fixture('rooms-range-edges')
    const booked = bodyOf('book-a-room')
    const edgesBody = edges.response.body as { rooms: { id: string; bookings: unknown[] }[] }
    const withBooking = {
      ...edges,
      response: {
        ...edges.response,
        body: {
          rooms: edgesBody.rooms.map((room) =>
            room.id === 'merapi' ? { ...room, bookings: [...room.bookings, booked] } : room,
          ),
        },
      },
    }
    const GET_EDGES = `GET ${RANGE_EDGES_PATH}`

    const chooseAndBook = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.selectOptions(screen.getByLabelText('room'), 'Merapi')
      await user.selectOptions(screen.getByLabelText('start'), '09:00')
      await user.selectOptions(screen.getByLabelText('end'), '10:00')
      await user.click(screen.getByLabelText('title'))
      await user.paste('Sprint planning')
      await user.click(screen.getByRole('button', { name: 'Book' }))
    }

    it('a 201 fetches the date again, the booking shows under Merapi, Booked. stays (Scope)', async () => {
      clockAt('2026-11-04T18:00:00.000Z')
      const stub = stubFetch(edges, withBooking, atPath(fixture('book-a-room'), '/api/bookings'))
      renderRooms('Asia/Jakarta')
      await waitFor(() => expect(shown()).toEqual(RANGE_EDGES))
      await chooseAndBook(userEvent.setup())
      await waitFor(() => expect(shown()).toContain('09:00 to 10:00  Sprint planning'))
      const lines = shown()
      const at = lines.indexOf('08:00 to 08:30  Standup')
      expect(lines[at + 1]).toBe('09:00 to 10:00  Sprint planning')
      expect(screen.getByRole('alert').textContent).toBe('Booked.')
      expect(stub.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
        GET_EDGES,
        'POST /api/bookings',
        GET_EDGES,
      ])
    })

    it('keeps the list and Booked. on screen while the date is fetched again', async () => {
      clockAt('2026-11-04T18:00:00.000Z')
      const stub = stubFetchDeferred()
      renderRooms('Asia/Jakarta')
      await stub.answer(0, 200, edges.response.body)
      await chooseAndBook(userEvent.setup())
      await stub.answer(1, 201, booked)
      expect(stub.routes()).toEqual([GET_EDGES, 'POST /api/bookings', GET_EDGES])
      expect(list()).not.toBeNull()
      expect(screen.queryByText('Loading…')).toBeNull()
      expect(screen.getByRole('alert').textContent).toBe('Booked.')
      await stub.answer(2, 200, withBooking.response.body)
      expect(shown()).toContain('09:00 to 10:00  Sprint planning')
      expect(screen.getByRole('alert').textContent).toBe('Booked.')
    })

    it('a date changed while Book is in flight drops the answer and refetches nothing for either date', async () => {
      clockAt('2026-11-04T18:00:00.000Z')
      const stub = stubFetchDeferred()
      renderRooms('Asia/Jakarta')
      await stub.answer(0, 200, edges.response.body)
      await chooseAndBook(userEvent.setup())
      fireEvent.change(dateInput(), { target: { value: '2026-11-06' } })
      await stub.answer(1, 201, booked)
      expect(stub.routes()).toEqual([
        GET_EDGES,
        'POST /api/bookings',
        'GET /api/rooms?from=2026-11-05T17:00:00.000Z&to=2026-11-06T17:00:00.000Z',
      ])
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('a refetch that answers 401 calls onSessionExpired', async () => {
      clockAt('2026-11-04T18:00:00.000Z')
      const noToken = atPath(fixture('rooms-no-token'), RANGE_EDGES_PATH)
      stubFetch(edges, noToken, atPath(fixture('book-a-room'), '/api/bookings'))
      const { onSessionExpired } = renderRooms('Asia/Jakarta')
      await waitFor(() => expect(shown()).toEqual(RANGE_EDGES))
      await chooseAndBook(userEvent.setup())
      await vi.waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1))
    })

    it('a refetch that fails shows the D3 message in place of the list and the form', async () => {
      clockAt('2026-11-04T18:00:00.000Z')
      const stub = stubFetchDeferred()
      renderRooms('Asia/Jakarta')
      await stub.answer(0, 200, edges.response.body)
      await chooseAndBook(userEvent.setup())
      await stub.answer(1, 201, booked)
      await stub.answer(2, 500, {})
      expect(screen.getByRole('status').textContent).toBe('Could not reach the server. Please try again.')
      expect(list()).toBeNull()
      expect(screen.queryByRole('button', { name: 'Book' })).toBeNull()
    })
  })
})
